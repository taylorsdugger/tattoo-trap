import ArtistCard from "./ArtistCard";
import type { ArtistMatch } from "@/lib/types";

export default function SearchResults({ results }: { results: ArtistMatch[] }) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-400">
        No matches yet for this metro. Once the pipeline has crawled and embedded some shops,
        results will appear here.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {results.map((m) => (
        <ArtistCard key={m.artist_id} match={m} />
      ))}
    </div>
  );
}
