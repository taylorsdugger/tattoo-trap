import Link from "next/link";
import { displayImage } from "@/lib/images";
import type { ArtistMatch } from "@/lib/types";

export default function ArtistCard({ match }: { match: ArtistMatch }) {
  const pct = Math.round(match.similarity * 100);
  const images = (match.images ?? []).slice(0, 4);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="grid grid-cols-4 gap-px bg-neutral-800">
        {images.length > 0 ? (
          images.map((img, i) => {
            const src = displayImage(img.storage_path, img.source_url);
            return (
              <div key={i} className="aspect-square bg-neutral-950">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="col-span-4 flex aspect-[4/1] items-center justify-center bg-neutral-950 text-xs text-neutral-600">
            no images yet
          </div>
        )}
      </div>

      <div className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/artist/${match.artist_slug}`} className="font-semibold hover:text-rose-400">
            {match.artist_name}
          </Link>
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300">
            {pct}% match
          </span>
        </div>
        <div className="text-sm text-neutral-400">
          {match.shop_name}
          {match.shop_address ? ` · ${match.shop_address}` : ` · ${match.metro_name}`}
        </div>
        <div className="flex gap-3 pt-1 text-xs">
          {match.artist_instagram && (
            <a
              href={`https://instagram.com/${match.artist_instagram}`}
              target="_blank"
              rel="noreferrer"
              className="text-rose-400 hover:underline"
            >
              @{match.artist_instagram}
            </a>
          )}
          {match.shop_website && (
            <a
              href={match.shop_website}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:underline"
            >
              shop site ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
