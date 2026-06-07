"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { displayImage } from "@/lib/images";
import type { ArtistMatch } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import TrashArtistButton from "./TrashArtistButton";
import { Label, Meter } from "./ui";

export default function ArtistCard({ match, rank }: { match: ArtistMatch; rank: number }) {
  const router = useRouter();
  // Results are client-side search state, so a trashed row hides locally rather than refetching.
  const [trashed, setTrashed] = useState(false);
  const pct = Math.round(match.similarity * 100);
  const images = (match.images ?? []).filter((img) => img.storage_path).slice(0, 4);

  if (trashed) return null;

  return (
    <article
      onClick={() => router.push(`/artist/${match.artist_slug}`)}
      className="tt-row grid cursor-pointer gap-[18px] border-t border-line py-[30px] first:border-t-0"
    >
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[220px] flex-1 items-baseline gap-3.5">
          <span className="w-6 font-mono text-[13px] text-ink-faint">
            {String(rank).padStart(2, "0")}
          </span>
          <div>
            <h3 className="font-display text-[clamp(22px,3vw,30px)] font-[420] italic leading-[1.05] tracking-display text-ink">
              {match.artist_name}
            </h3>
            <div className="mt-[5px] text-sm text-ink-soft">
              {match.shop_name}
              {match.shop_address ? ` · ${match.shop_address}` : ` · ${match.metro_name}`}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-[9px]">
            <Label>match</Label>
            <Meter v={match.similarity} />
            <span className="font-mono text-[13px] font-medium text-ink">
              {pct}
              <span className="text-ink-faint">%</span>
            </span>
            <FavoriteButton slug={match.artist_slug} name={match.artist_name} />
            <TrashArtistButton
              id={match.artist_id}
              name={match.artist_name}
              onDeleted={() => setTrashed(true)}
            />
          </div>
          {match.artist_instagram && (
            <a
              href={`https://instagram.com/${match.artist_instagram}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="whitespace-nowrap font-mono text-xs text-ink-soft"
            >
              @{match.artist_instagram} ↗
            </a>
          )}
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2.5">
          {images.map((img, i) => {
            const src = displayImage(img.storage_path);
            return (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-[1px] bg-paper-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
