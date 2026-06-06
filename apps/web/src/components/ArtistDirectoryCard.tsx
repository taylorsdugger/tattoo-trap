import Link from "next/link";
import { displayImage } from "@/lib/images";
import type { DirectoryArtist } from "@/lib/types";

/* Artist card per the design's "more in metro" cards: bordered card on paper,
   padded 3-up thumbnail grid, serif name row, quiet mono metadata. */
export default function ArtistDirectoryCard({ artist }: { artist: DirectoryArtist }) {
  const images = (artist.images ?? []).slice(0, 3);
  const shop = artist.shop;
  // Prefer the artist's own IG handle; fall back to the shop's.
  const instagram = artist.instagram_handle ?? shop?.instagram_handle ?? null;

  return (
    <div className="tt-row flex flex-col gap-2.5 rounded-[2px] border border-line p-3.5">
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => {
          const img = images[i];
          const src = img ? displayImage(img.storage_path, img.source_url) : null;
          return (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-[1px] bg-paper-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/artist/${artist.slug}`}
          className="font-display text-lg font-[420] tracking-display text-ink"
        >
          {artist.name}
        </Link>
        {shop?.metro?.name && (
          <span className="whitespace-nowrap font-mono text-xs text-ink-soft">
            {shop.metro.name}
          </span>
        )}
      </div>
      <div className="-mt-1.5 text-sm text-ink-soft">{shop?.name ?? "Independent"}</div>

      <div className="flex flex-wrap gap-3 font-mono text-xs">
        {instagram && (
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noreferrer"
            className="text-ink-soft hover:text-ink"
          >
            @{instagram} ↗
          </a>
        )}
        {shop?.website && (
          <a
            href={shop.website}
            target="_blank"
            rel="noreferrer"
            className="text-ink-faint hover:text-ink"
          >
            shop site ↗
          </a>
        )}
      </div>
    </div>
  );
}
