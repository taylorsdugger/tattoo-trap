import { supabase } from "./supabase";
import type { ArtistMatch } from "./types";

/**
 * Artist ids the operator has hidden (queued for local deletion). Excluded from every public
 * listing. Best-effort: if the table/read fails, we surface everything rather than hiding the app.
 */
export async function getHiddenArtistIds(): Promise<Set<number>> {
  const { data, error } = await supabase.from("hidden_artists").select("artist_id");
  if (error) {
    console.warn("Failed to load hidden artists:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.artist_id as number));
}

/**
 * Run a visual-similarity search. `embedding` is an L2-normalized 512-d CLIP vector.
 * Returns artists ranked by cosine similarity, optionally scoped to a metro. Hidden artists are
 * filtered out so a search never surfaces a row the operator has already queued for deletion.
 */
export async function searchArtistsByImage(
  embedding: number[],
  metroSlug: string | null,
  matchCount = 24,
): Promise<ArtistMatch[]> {
  const [{ data, error }, hidden] = await Promise.all([
    supabase.rpc("search_artists_by_image", {
      query_embedding: embedding,
      metro_slug: metroSlug,
      match_count: matchCount,
    }),
    getHiddenArtistIds(),
  ]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ArtistMatch[]).filter((m) => !hidden.has(m.artist_id));
}
