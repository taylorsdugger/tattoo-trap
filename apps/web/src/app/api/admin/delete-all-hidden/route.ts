import { NextResponse } from "next/server";
import { getCurrentRole, hasMinRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/serviceClient";

/* Admin curation endpoint: hard-delete *every* artist currently in the hide queue in one shot —
   the "clear all" on /admin/hidden. Same mechanics as delete-artist (image rows → artist rows →
   storage thumbnails), just batched over all hidden ids. Deleting the artists cascade-removes their
   hidden_artists rows (see 0008_hidden_artists.sql).

   Authorized by role; the delete runs with the service-role key, which only lives in
   apps/web/.env.local — so this is a localhost-only capability, same as delete-artist. */

const STORAGE_BUCKET = "portfolios"; // matches pipeline config.STORAGE_BUCKET

export async function POST() {
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

  const { data: hiddenRows, error: hiddenErr } = await admin
    .from("hidden_artists")
    .select("artist_id");
  if (hiddenErr) return NextResponse.json({ error: hiddenErr.message }, { status: 500 });

  const ids = (hiddenRows ?? []).map((r) => r.artist_id as number);
  if (ids.length === 0) {
    return NextResponse.json({ deletedArtists: 0, deletedImages: 0, deletedThumbnails: 0 });
  }

  const { data: images, error: imgErr } = await admin
    .from("portfolio_images")
    .select("storage_path")
    .in("artist_id", ids);
  if (imgErr) return NextResponse.json({ error: imgErr.message }, { status: 500 });

  const { error: delImgErr } = await admin.from("portfolio_images").delete().in("artist_id", ids);
  if (delImgErr) return NextResponse.json({ error: delImgErr.message }, { status: 500 });

  // Cascade on hidden_artists.artist_id clears the queue rows when the artists go.
  const { error: delArtErr } = await admin.from("artists").delete().in("id", ids);
  if (delArtErr) return NextResponse.json({ error: delArtErr.message }, { status: 500 });

  // Storage cleanup is best-effort, same as delete-artist — DB rows are already gone.
  const paths = (images ?? []).map((im) => im.storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET).remove(paths);
    if (rmErr) console.warn(`delete-all-hidden: storage remove failed: ${rmErr.message}`);
  }

  return NextResponse.json({
    deletedArtists: ids.length,
    deletedImages: images?.length ?? 0,
    deletedThumbnails: paths.length,
  });
}
