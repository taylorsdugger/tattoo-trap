"use client";

import { useState } from "react";
import { embedImage } from "@/lib/embedder";
import { searchArtistsByImage } from "@/lib/search";
import type { ArtistMatch, Metro } from "@/lib/types";
import ImageDropzone from "./ImageDropzone";
import MetroPicker from "./MetroPicker";
import SearchResults from "./SearchResults";

export default function SearchExperience({ metros }: { metros: Metro[] }) {
  const [metroSlug, setMetroSlug] = useState<string | null>(metros[0]?.slug ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ArtistMatch[] | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResults(null);
    setBusy(true);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const embedding = await embedImage(file, setStatus);
      setStatus("Searching artists…");
      const matches = await searchArtistsByImage(embedding, metroSlug, 24);
      setResults(matches);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Which artists near you make work like this?
        </h1>
        <p className="text-neutral-400">
          Upload a tattoo inspiration image. We match it against local artists&apos; portfolios by
          visual similarity — all embedding happens in your browser.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetroPicker metros={metros} value={metroSlug} onChange={setMetroSlug} disabled={busy} />
        {metros.length === 0 && (
          <span className="text-sm text-amber-400">
            No metros found — apply the Supabase migrations first.
          </span>
        )}
      </div>

      <ImageDropzone onFile={handleFile} disabled={busy} previewUrl={previewUrl} />

      {status && (
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          {status}
        </div>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}

      {results && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-400">
            {results.length} artist{results.length === 1 ? "" : "s"} ranked by similarity
          </h2>
          <SearchResults results={results} />
        </section>
      )}
    </div>
  );
}
