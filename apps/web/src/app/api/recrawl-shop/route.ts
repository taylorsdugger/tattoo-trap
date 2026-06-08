import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentRole, hasMinRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/serviceClient";

/* Admin curation endpoint: re-run the Python crawler against one artist's SHOP website, then embed
   whatever new candidates it discovers. Triggered by the cards' "re-crawl shop" button so a site
   can be re-ingested after a crawler change (JS-gallery settle, relaxed name heuristics) straight
   from the UI — no Apify/RapidAPI involved.

   Authorized by role (admin or owner). NOTE: this spawns Python + Playwright from <repo>/pipeline,
   so it only actually works where that venv exists (local dev) — on serverless the spawn fails
   gracefully with a clear message. Requires SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local. */

// next dev runs with cwd = apps/web; the pipeline is at <repo>/pipeline.
const PIPELINE_DIR = path.resolve(process.cwd(), "..", "..", "pipeline");
const PY = path.join(PIPELINE_DIR, ".venv", "bin", "python");

/** Run a pipeline module to completion, capturing tail output. Best-effort: resolves rather than
    throws so the caller can surface partial progress. */
function runPython(args: string[], timeoutMs: number): Promise<{ ok: boolean; detail: string }> {
  if (!existsSync(PY)) {
    return Promise.resolve({ ok: false, detail: `pipeline venv not found at ${PY}` });
  }
  return new Promise((resolve) => {
    const child = spawn(PY, args, { cwd: PIPELINE_DIR });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: e.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, detail: out.slice(-500) });
    });
  });
}

export async function POST(req: Request) {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local to enable re-crawling." },
      { status: 500 },
    );
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

  // Resolve the artist's shop — the crawler works per shop website.
  const { data: artist, error: artErr } = await admin
    .from("artists")
    .select("shop_id")
    .eq("id", id)
    .maybeSingle();
  if (artErr) return NextResponse.json({ error: artErr.message }, { status: 500 });
  if (!artist?.shop_id) {
    return NextResponse.json({ error: "Artist has no shop to crawl." }, { status: 422 });
  }
  const shopId: number = artist.shop_id;

  // Crawl (Playwright launch + up to a dozen pages with settle waits), then embed the shop's new
  // candidates. Generous timeouts: the crawl is the slow leg.
  // --real-ua: a manual single-shop re-crawl uses a real Chrome UA so Cloudflare-challenged sites
  // (which serve the polite TattooTrapBot UA an "Attention Required!" page) load their real roster.
  const crawl = await runPython(
    ["-m", "tattoo_trap.crawl_shops", "--shop", String(shopId), "--real-ua"],
    240_000,
  );
  if (!crawl.ok) {
    return NextResponse.json(
      { error: `Crawl failed. ${crawl.detail.slice(-200)}` },
      { status: 502 },
    );
  }
  const embed = await runPython(["-m", "tattoo_trap.embed_images", "--shop", String(shopId)], 240_000);

  // Count what's actually displayable across the shop now (post content-gate).
  const { data: shopArtists } = await admin.from("artists").select("id").eq("shop_id", shopId);
  const artistIds = (shopArtists ?? []).map((a) => a.id);
  let visible = 0;
  if (artistIds.length > 0) {
    const { count } = await admin
      .from("portfolio_images")
      .select("id", { count: "exact", head: true })
      .in("artist_id", artistIds)
      .not("storage_path", "is", null);
    visible = count ?? 0;
  }

  const message = embed.ok
    ? `Re-crawled shop · ${artistIds.length} artist(s), ${visible} image(s) now visible.`
    : `Re-crawled, but embed failed — run \`make embed\`. (${embed.detail.slice(-160)})`;

  return NextResponse.json({ shopId, artists: artistIds.length, visible, message });
}
