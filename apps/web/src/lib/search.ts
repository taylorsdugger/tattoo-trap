import { supabase } from "./supabase";
import type { ArtistMatch } from "./types";

/**
 * Run a visual-similarity search. `embedding` is an L2-normalized 512-d CLIP vector.
 * Returns artists ranked by cosine similarity, optionally scoped to a metro.
 */
export async function searchArtistsByImage(
  embedding: number[],
  metroSlug: string | null,
  matchCount = 24,
): Promise<ArtistMatch[]> {
  const { data, error } = await supabase.rpc("search_artists_by_image", {
    query_embedding: embedding,
    metro_slug: metroSlug,
    match_count: matchCount,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArtistMatch[];
}
