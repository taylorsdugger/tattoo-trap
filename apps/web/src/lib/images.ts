import { SUPABASE_URL } from "./supabase";

const BUCKET = "portfolios";

/** Public URL for a thumbnail stored in the `portfolios` bucket. */
export function thumbUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/**
 * Displayable image URL for a portfolio image. Only ever returns our own stored thumbnail —
 * we deliberately do NOT fall back to the original `source_url`, because un-embedded rows point
 * at the shop site's raw assets (logos, social icons, lazy-load placeholders, dead links) which
 * render as junk or broken images. No thumbnail → show nothing.
 */
export function displayImage(storagePath: string | null | undefined): string | null {
  return thumbUrl(storagePath);
}

/** True when a portfolio image has a real, displayable thumbnail. */
export function hasThumb(img: { storage_path?: string | null }): boolean {
  return Boolean(img.storage_path);
}
