import { NextResponse } from "next/server";
import { getCurrentRole, hasMinRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/serviceClient";

/* Admin curation endpoint: trash a junk "artist" the crawler ingested (nav buttons, permit pages,
   etc.) straight from the UI. Mirrors prune_junk_artists.py --apply: delete image rows, then the
   artist row, then the storage thumbnails (best-effort).

   Authorized by role (admin or owner) via the signed-in user's session; the actual delete runs
   with the service-role key (display tables have no anon write policy). Requires
   SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local — server-side only. */

const STORAGE_BUCKET = "portfolios"; // matches pipeline config.STORAGE_BUCKET

export async function POST(req: Request) {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Set SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local to enable deletion." },
      { status: 500 },
    );
  }

  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Body must be { id: number }" }, { status: 400 });
  }

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
