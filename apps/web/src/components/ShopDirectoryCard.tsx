import Link from "next/link";
import { displayImage } from "@/lib/images";
import type { DirectoryShop } from "@/lib/types";

/* Full-width editorial row matching the artist directory: rank number, large
   italic serif shop name, address · metro line, uppercase metro + handle on
   the right, a linked list of the shop's artists, and a 4-up row of images
   sampled across those artists' portfolios. */
export default function ShopDirectoryCard({ shop, rank }: { shop: DirectoryShop; rank: number }) {
  const artists = shop.artists ?? [];

  // Sample images round-robin across artists so one prolific portfolio
  // doesn't fill the whole strip. Only real, thumbnailed images.
  const pools = artists.map((a) => (a.images ?? []).filter((img) => img.storage_path));
  const images: { storage_path: string | null }[] = [];
  for (let i = 0; images.length < 4; i++) {
    const before = images.length;
    for (const pool of pools) {
      if (pool[i]) images.push(pool[i]);
      if (images.length === 4) break;
    }
    if (images.length === before) break; // all pools exhausted
  }

  return (
    <article className="group grid gap-5 border-t border-line py-[clamp(28px,4vw,44px)] first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-5">
        <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:gap-4">
          <span className="w-6 pt-1 font-mono text-[13px] text-ink-faint transition-colors duration-300 group-hover:text-ink sm:w-7 sm:pt-2">
            {String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <span className="font-display text-[clamp(22px,3.2vw,36px)] font-[420] italic leading-[1.05] tracking-display text-ink">
              {shop.name}
            </span>
            <div className="mt-1.5 text-sm text-ink-soft">
              {shop.address ?? "Address unknown"}
              {shop.metro?.name ? ` · ${shop.metro.name}` : ""}
            </div>
            {artists.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {artists.map((a) => (
                  <Link
                    key={a.id}
                    href={`/artist/${a.slug}`}
                    className="text-ink-soft underline decoration-line-strong decoration-1 underline-offset-[4px] hover:text-ink"
                  >
                    {a.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 pl-9 sm:items-end sm:pl-0 sm:pt-1">
          {shop.metro?.name && (
            <span className="hidden font-mono text-xs uppercase tracking-[0.18em] text-ink-faint sm:inline">
              {shop.metro.name}
            </span>
          )}
          {shop.instagram_handle && (
            <a
              href={`https://instagram.com/${shop.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap font-mono text-[13px] text-ink-soft hover:text-ink"
            >
              @{shop.instagram_handle} ↗
            </a>
          )}
          {shop.website && (
            <a
              href={shop.website}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-ink-faint hover:text-ink"
            >
              shop site ↗
            </a>
          )}
          <span className="font-mono text-xs text-ink-faint">
            {artists.length} artist{artists.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>
    </article>
  );
}
