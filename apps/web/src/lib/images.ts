import { SUPABASE_URL } from "./supabase";

const BUCKET = "portfolios";

/** Public URL for a thumbnail stored in the `portfolios` bucket. */
export function thumbUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

/** Best displayable image URL for a portfolio image: thumbnail first, else original source. */
export function displayImage(
  storagePath: string | null | undefined,
  sourceUrl: string | null | undefined,
): string | null {
  return thumbUrl(storagePath) ?? sourceUrl ?? null;
}
