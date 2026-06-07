import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Dev-only curation endpoint: trash a junk "artist" the crawler ingested (nav buttons,
   permit pages, etc.) straight from the UI. Mirrors prune_junk_artists.py --apply:
   delete image rows, then the artist row, then the storage thumbnails (best-effort).

   Requires SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local — server-side only, and the
   route 404s outside `next dev`, so the key/ability can never ship to a deployed site. */

const STORAGE_BUCKET = "portfolios"; // matches pipeline config.STORAGE_BUCKET

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local to enable deletion." },
      { status: 500 },
    );
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: images, error: imgErr } = await admin
    .from("portfolio_images")
    .select("id, storage_path")
    .eq("artist_id", id);
  if (imgErr) return NextResponse.json({ error: imgErr.message }, { status: 500 });

  const { error: delImgErr } = await admin.from("portfolio_images").delete().eq("artist_id", id);
  if (delImgErr) return NextResponse.json({ error: delImgErr.message }, { status: 500 });

  const { error: delArtErr } = await admin.from("artists").delete().eq("id", id);
  if (delArtErr) return NextResponse.json({ error: delArtErr.message }, { status: 500 });

  // Storage cleanup is best-effort, same as the pipeline script — DB rows are already gone.
  const paths = (images ?? []).map((im) => im.storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
    if (rmErr) console.warn(`delete-artist: storage remove failed: ${rmErr.message}`);
  }

  return NextResponse.json({ deletedImages: images?.length ?? 0, deletedThumbnails: paths.length });
}
