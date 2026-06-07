import Link from "next/link";
import { displayImage } from "@/lib/images";
import type { DirectoryArtist } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import TrashArtistButton from "./TrashArtistButton";

/* Full-width editorial row per the browse design: rank number, large italic
   serif name, shop · metro line, uppercase metro + handle on the right, and
   a 4-up row of large square images. On hover the rank inks in, the name
   underlines, and the images zoom slowly inside their frames. */
export default function ArtistDirectoryCard({
  artist,
  rank,
}: {
  artist: DirectoryArtist;
  rank: number;
}) {
  // Only real, thumbnailed images — un-embedded rows are shop-site logos/headshots/dead links.
  const images = (artist.images ?? [])
    .filter((img) => img.storage_path)
    .slice(0, 4);
  const shop = artist.shop;
  // Prefer the artist's own IG handle; fall back to the shop's.
  const instagram = artist.instagram_handle ?? shop?.instagram_handle ?? null;

  return (
    <article className="group grid gap-5 border-t border-line py-[clamp(28px,4vw,44px)] first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-[260px] flex-1 items-baseline gap-4">
          <span className="w-7 pt-2 font-mono text-[13px] text-ink-faint transition-colors duration-300 group-hover:text-ink">
            {String(rank).padStart(2, "0")}
          </span>
          <div>
            <Link
              href={`/artist/${artist.slug}`}
              className="font-display text-[clamp(24px,3.2vw,36px)] font-[420] italic leading-[1.05] tracking-display text-ink decoration-line-strong decoration-1 underline-offset-[7px] group-hover:underline"
            >
              {artist.name}
            </Link>
            <div className="mt-1.5 text-sm text-ink-soft">
              {shop?.name ?? "Independent"}
              {shop?.metro?.name ? ` · ${shop.metro.name}` : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 pt-1">
          {shop?.metro?.name && (
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
              {shop.metro.name}
            </span>
          )}
          <span className="flex items-center gap-2.5">
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap font-mono text-[13px] text-ink-soft hover:text-ink"
              >
                @{instagram} ↗
              </a>
            )}
            <FavoriteButton slug={artist.slug} name={artist.name} />
            <TrashArtistButton id={artist.id} name={artist.name} />
          </span>
          {shop?.website && (
            <a
              href={shop.website}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-ink-faint hover:text-ink"
            >
              shop site ↗
            </a>
          )}
        </div>
      </div>

      <Link
        href={`/artist/${artist.slug}`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => {
          const img = images[i];
          const src = img ? displayImage(img.storage_path) : null;
          return (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-[1px] bg-paper-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              ) : null}
            </div>
          );
        })}
      </Link>
    </article>
  );
}
