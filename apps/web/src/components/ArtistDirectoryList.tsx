"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { DirectoryArtist } from "@/lib/types";
import ArtistDirectoryCard from "./ArtistDirectoryCard";
import { Label } from "./ui";

const PAGE_SIZE = 24;

/* Progressive (infinite-scroll) renderer for the artist directory. The full
   filtered list arrives from the server; we only paint a window of it and grow
   that window as a sentinel scrolls into view — otherwise ~600 rows × 4 images
   each would all paint up front.

   We also persist how many rows were visible and the scroll position in
   sessionStorage, keyed by the active filter. That way tapping into a portfolio
   and hitting back rebuilds the same amount of list and restores your place,
   instead of snapping back to the top of page one. */
export default function ArtistDirectoryList({
  artists,
  filterKey,
}: {
  artists: DirectoryArtist[];
  filterKey: string;
}) {
  const storageKey = `artists:${filterKey}`;

  // Start at PAGE_SIZE so the server-rendered markup and first client render
  // match (no hydration mismatch); the saved count is restored in the layout
  // effect below, before the browser paints.
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Restore the saved window size + scroll position whenever the filter changes
  // (and on first mount). Runs before paint, so there's no flash of page one.
  useLayoutEffect(() => {
    const savedCount = Number(sessionStorage.getItem(`${storageKey}:count`));
    setVisible(savedCount > 0 ? Math.min(savedCount, artists.length) : PAGE_SIZE);

    const savedScroll = Number(sessionStorage.getItem(`${storageKey}:scroll`));
    if (savedScroll > 0) {
      // Wait for the restored rows to commit before jumping to the old offset.
      requestAnimationFrame(() => window.scrollTo(0, savedScroll));
    }

    const onScroll = () => {
      sessionStorage.setItem(`${storageKey}:scroll`, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [storageKey, artists.length]);

  // Grow the window as the sentinel nears the viewport.
  useLayoutEffect(() => {
    if (visible >= artists.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => {
            const next = Math.min(v + PAGE_SIZE, artists.length);
            sessionStorage.setItem(`${storageKey}:count`, String(next));
            return next;
          });
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, artists.length, storageKey]);

  const shown = artists.slice(0, visible);

  return (
    <>
      <Label>
        {artists.length} artist{artists.length === 1 ? "" : "s"}
      </Label>
      <div>
        {shown.map((a, i) => (
          <ArtistDirectoryCard key={a.id} artist={a} rank={i + 1} />
        ))}
      </div>
      {visible < artists.length && <div ref={sentinelRef} aria-hidden className="h-px w-full" />}
    </>
  );
}
