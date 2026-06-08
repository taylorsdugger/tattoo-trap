import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentRole, hasMinRole } from "@/lib/auth";
import { fetchInstagramImageUrls, normalizeHandle } from "@/lib/instagram";
import { createServiceClient } from "@/lib/supabase/serviceClient";

/* Run the Python embed step for one artist so the queued candidates turn into displayable
   thumbnails immediately — same work as `make embed`, scoped to this artist via --artist.
   Best-effort, and crucially OPTIONAL: on a serverless host (Vercel) there is no pipeline venv,
   so `ran` comes back false and the caller reports "queued, embed runs later". Locally the venv
   exists and we embed inline. The `ran` flag lets the caller distinguish "embed deferred to the
   scheduled worker" (normal, on live) from "embed ran but failed" (a real problem, on dev). */
function embedArtist(artistId: number): Promise<{ ran: boolean; ok: boolean; detail: string }> {
  // next dev runs with cwd = apps/web; the pipeline is at <repo>/pipeline.
  const pipelineDir = path.resolve(process.cwd(), "..", "..", "pipeline");
  const py = path.join(pipelineDir, ".venv", "bin", "python");
  if (!existsSync(py)) {
    return Promise.resolve({ ran: false, ok: false, detail: `pipeline venv not found at ${py}` });
  }
  return new Promise((resolve) => {
    const child = spawn(py, ["-m", "tattoo_trap.embed_images", "--artist", String(artistId)], {
      cwd: pipelineDir,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ran: true, ok: false, detail: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ran: true, ok: code === 0, detail: out.slice(-500) });
    });
  });
}

/* Dev-only curation endpoint: backfill portfolio image candidates for one artist on demand,
   via a RapidAPI Instagram scraper instead of the Apify pipeline. Use it from the artist page
   when an artist has zero images and you don't want to burn Apify credits.

   This is Option A — it only DISCOVERS image URLs and writes them as un-embedded
   `portfolio_images` candidates (source_url only), then stamps `ig_scraped_at`. The existing
   `embed_images.py` stage downloads, content-gates, thumbnails and embeds them, exactly as it
   does for Apify/crawler rows. Nothing displays until that embed run completes.

   Unlike the recrawl-shop route (which spawns Python+Playwright and so is local-only), the work
   here is pure JS — a RapidAPI fetch plus Supabase inserts — so it runs fine on serverless. It's
   authorized by role (admin or owner) via the signed-in user's session: normal visitors get a 403,
   so the RapidAPI quota and service-role writes stay off-limits to the public. The inline embed
   no-ops on Vercel (no venv) — the scheduled worker embeds the queued rows out-of-band. Requires
   SUPABASE_SERVICE_ROLE_KEY (anon is read-only under RLS). */

export async function POST(req: Request) {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local to enable fetching." },
      { status: 500 },
    );
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

  const { data: artist, error: artErr } = await admin
    .from("artists")
    .select("id, instagram_handle")
    .eq("id", id)
    .maybeSingle();
  if (artErr) return NextResponse.json({ error: artErr.message }, { status: 500 });
  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const handle = normalizeHandle(artist.instagram_handle);
  if (!handle) {
    return NextResponse.json(
      { error: "Artist has no usable Instagram handle to fetch from." },
      { status: 422 },
    );
  }

  let urls: string[];
  try {
    urls = await fetchInstagramImageUrls(handle);
  } catch (e) {
    // Real config/transport failure — do NOT stamp ig_scraped_at, so it can be retried.
    const message = e instanceof Error ? e.message : "RapidAPI fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Insert candidates, ignoring the (artist_id, source_url) unique-constraint dupes — mirrors
  // db.add_candidate_image. embed_images.py picks these up on its next run.
  let inserted = 0;
  for (const sourceUrl of urls) {
    const { error: insErr } = await admin
      .from("portfolio_images")
      .insert({ artist_id: id, source_url: sourceUrl });
    if (!insErr) {
      inserted++;
    } else if (insErr.code !== "23505" && !/duplicate/i.test(insErr.message)) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  // Stamp attempted on every successful fetch — including an empty result — so the IG pipeline
  // treats this artist as already covered, matching mark_ig_scraped().
  const { error: stampErr } = await admin
    .from("artists")
    .update({ ig_scraped_at: new Date().toISOString() })
    .eq("id", id);
  if (stampErr) console.warn(`fetch-images: ig_scraped_at stamp failed: ${stampErr.message}`);

  // Auto-embed the freshly queued candidates so they appear without a manual `make embed`. On
  // serverless there's no venv, so this no-ops (ran=false) and the worker embeds them later.
  let embed = { ran: false, ok: true, detail: "" };
  if (inserted > 0) embed = await embedArtist(id);

  // Count what's actually displayable now (post content-gate; some candidates get dropped).
  const { count: visible } = await admin
    .from("portfolio_images")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", id)
    .not("storage_path", "is", null);

  let message: string;
  if (visible && visible > 0) {
    message = `Added ${visible} image${visible === 1 ? "" : "s"}.`;
  } else if (inserted > 0 && !embed.ran) {
    // Normal serverless path: candidates are queued; the scheduled embed worker turns them visible.
    message = `Queued ${inserted} image${inserted === 1 ? "" : "s"} — they'll appear after the next embed run.`;
  } else if (inserted > 0 && !embed.ok) {
    message = `Queued ${inserted}, but auto-embed failed — run \`make embed\`. (${embed.detail.slice(-160)})`;
  } else if (inserted > 0) {
    message = `Queued ${inserted}, but none passed the tattoo filter.`;
  } else {
    message = "No new images found for this handle.";
  }

  return NextResponse.json({ found: urls.length, inserted, visible: visible ?? 0, message });
}
