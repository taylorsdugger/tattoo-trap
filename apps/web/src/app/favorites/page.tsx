"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ArtistDirectoryCard from "@/components/ArtistDirectoryCard";
import { Label } from "@/components/ui";
import { useFavorites } from "@/lib/favorites";
import { supabase } from "@/lib/supabase";
import type { DirectoryArtist } from "@/lib/types";

/* Favorites live in localStorage (no auth), so this page renders client-side:
   read the saved slugs, then fetch those artists with the same embedded
   shop -> metro + images shape the directory uses. */
export default function FavoritesPage() {
  const favorites = useFavorites();
  const [artists, setArtists] = useState<DirectoryArtist[] | null>(null);

  useEffect(() => {
    if (favorites.length === 0) {
      setArtists([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("artists")
          .select(
            `id, name, slug, instagram_handle, avatar_url,
             shop:shops ( id, name, address, website, instagram_handle, metro:metros ( name, slug ) ),
             images:portfolio_images ( storage_path, source_url )`,
          )
          .in("slug", favorites);
        if (error) throw error;
        if (cancelled) return;
        // Show most recently saved first (favorites stores oldest -> newest).
        const order = new Map(favorites.map((slug, i) => [slug, i]));
        const list = ((data ?? []) as unknown as DirectoryArtist[]).sort(
          (a, b) => (order.get(b.slug) ?? 0) - (order.get(a.slug) ?? 0),
        );
        setArtists(list);
      } catch (err) {
        console.error("Failed to load favorited artists:", err);
        if (!cancelled) setArtists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [favorites]);

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <div>
        <Label>saved on this device</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          Favorite artists
        </h1>
        <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
          Artists you&apos;ve saved with the ♡ button. Favorites are stored in this browser only.
        </p>
      </div>

      {artists === null ? (
        <p className="tt-pulse font-mono text-xs text-ink-faint">loading favorites…</p>
      ) : artists.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No favorites yet. Save artists from{" "}
          <Link href="/" className="border-b border-line-strong text-ink">
            search results
          </Link>{" "}
          or the{" "}
          <Link href="/artists" className="border-b border-line-strong text-ink">
            artist directory
          </Link>
          .
        </p>
      ) : (
        <>
          <Label>
            {artists.length} artist{artists.length === 1 ? "" : "s"}
          </Label>
          <div>
            {artists.map((a, i) => (
              <ArtistDirectoryCard key={a.id} artist={a} rank={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
