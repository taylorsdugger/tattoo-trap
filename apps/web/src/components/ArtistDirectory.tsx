"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryArtist, Metro } from "@/lib/types";
import ArtistDirectoryList from "./ArtistDirectoryList";
import { Label } from "./ui";

/* Client-side directory browser. The server ships the full artist list once;
   all filtering (metro / name / has-pics) happens here in memory, so toggling a
   filter is instant — no navigation, no refetch. ArtistDirectoryList still
   windows the *filtered* result (24-at-a-time infinite scroll), so the DOM
   never holds more than a screenful regardless of how large the list is.

   The active filters are mirrored into the URL via history.replaceState so the
   page stays shareable and survives a refresh — but, unlike router navigation,
   replaceState doesn't re-run the server component, so there's no round-trip. */
export default function ArtistDirectory({
  metros,
  artists,
  initialMetro,
  initialQuery,
  initialPicsOnly,
}: {
  metros: Metro[];
  artists: DirectoryArtist[];
  initialMetro: string;
  initialQuery: string;
  initialPicsOnly: boolean;
}) {
  const [metro, setMetro] = useState(initialMetro);
  const [query, setQuery] = useState(initialQuery);
  const [picsOnly, setPicsOnly] = useState(initialPicsOnly);

  // Mirror filters into the address bar without triggering a navigation.
  useEffect(() => {
    const params = new URLSearchParams();
    if (metro) params.set("metro", metro);
    if (query.trim()) params.set("q", query.trim());
    if (picsOnly) params.set("pics", "1");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/artists?${qs}` : "/artists");
  }, [metro, query, picsOnly]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      artists.filter((a) => {
        if (metro && a.shop?.metro?.slug !== metro) return false;
        if (q && !a.name.toLowerCase().includes(q)) return false;
        // Match the card's definition of "has pics": only rows with a real
        // thumbnail (storage_path). Un-embedded rows are shop logos/dead links.
        if (picsOnly && !a.images?.some((img) => img.storage_path)) return false;
        return true;
      }),
    [artists, metro, q, picsOnly],
  );

  const activeMetro = metros.find((m) => m.slug === metro) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Label>browse mode · {activeMetro ? activeMetro.name : "all metros"}</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          {activeMetro ? `Artists in ${activeMetro.name}` : "All artists"}
        </h1>
        <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
          Browse every artist in the database. Tap through to a portfolio, or jump straight to
          their Instagram or shop. Looking for a specific style?{" "}
          <Link href="/" className="border-b border-line-strong text-ink">
            search by image
          </Link>
          .
        </p>
      </div>

      {metros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={!metro} onClick={() => setMetro("")}>
            All metros
          </Chip>
          {metros.map((m) => (
            <Chip key={m.id} active={m.slug === metro} onClick={() => setMetro(m.slug)}>
              {m.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip active={picsOnly} onClick={() => setPicsOnly((v) => !v)}>
          {picsOnly ? "✓ " : ""}With pics only
        </Chip>
      </div>

      <div className="relative max-w-[360px]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists by name…"
          aria-label="Search artists by name"
          className="w-full rounded-[2px] border border-line-strong bg-transparent px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No artists found
          {activeMetro ? ` in ${activeMetro.name}` : ""}
          {query.trim() ? ` matching “${query.trim()}”` : ""}.{" "}
          {query.trim()
            ? "Try a different name."
            : "Run the crawl/embed pipeline to populate the database."}
        </p>
      ) : (
        <ArtistDirectoryList
          artists={filtered}
          filterKey={`${metro}|${q}|${picsOnly ? "1" : ""}`}
        />
      )}
    </div>
  );
}

/* Pill toggle — same look as the old <Link> chips, but a plain button that
   flips client state instantly (no navigation). */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
        active
          ? "border-ink text-ink"
          : "border-line text-ink-soft hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
