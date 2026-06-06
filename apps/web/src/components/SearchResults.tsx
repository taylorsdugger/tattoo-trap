import ArtistCard from "./ArtistCard";
import type { ArtistMatch } from "@/lib/types";

export default function SearchResults({ results }: { results: ArtistMatch[] }) {
  if (results.length === 0) {
    return (
      <div className="rounded-[2px] border border-line bg-card p-6 text-center text-sm text-ink-soft">
        No matches yet for this metro. Once the pipeline has crawled and embedded some shops,
        results will appear here.
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {results.map((m, i) => (
        <ArtistCard key={m.artist_id} match={m} rank={i + 1} />
      ))}
    </div>
  );
}
