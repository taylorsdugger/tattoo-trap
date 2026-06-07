import Link from "next/link";
import { notFound } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";
import FetchImagesButton from "@/components/FetchImagesButton";
import PortfolioGrid from "@/components/PortfolioGrid";
import { Label, btnPrimary } from "@/components/ui";
import { displayImage } from "@/lib/images";
import { supabase } from "@/lib/supabase";
import type { Artist, PortfolioImage, Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!artist) notFound();
  const a = artist as Artist;

  const [{ data: shop }, { data: images }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", a.shop_id).maybeSingle(),
    supabase.from("portfolio_images").select("*").eq("artist_id", a.id),
  ]);

  const s = (shop ?? null) as Shop | null;
  // Only images we downloaded + thumbnailed count as real portfolio; un-embedded rows point at
  // shop-site logos/headshots/dead links, so they're excluded from the featured slot and count.
  const imgs = ((images ?? []) as PortfolioImage[]).filter((img) => img.storage_path);
  const featured = imgs[0] ? displayImage(imgs[0].storage_path) : null;
  const firstName = a.name.split(" ")[0];

  return (
    <div className="py-[clamp(28px,5vw,60px)]">
      <Link
        href="/"
        className="font-mono text-xs tracking-[0.05em] text-ink-soft transition-colors hover:text-ink"
      >
        ← back to search
      </Link>

      {/* featured work panel */}
      {featured && (
        <div className="mt-6 mb-10 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px overflow-hidden rounded-[2px] border border-line bg-line">
          <div className="bg-card p-[18px]">
            <Label>featured work · {firstName}</Label>
            <div className="mt-3 aspect-[4/5] overflow-hidden rounded-[1px] bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 bg-card p-[22px]">
            <Label>working at</Label>
            <div className="font-display text-4xl font-[420] italic leading-[1.05] tracking-display text-ink">
              {s?.name ?? "Independent"}
            </div>
            {s?.address && <div className="text-sm text-ink-soft">{s.address}</div>}
            <p className="text-[13px] leading-[1.5] text-ink-soft">
              Upload a reference image on the search page to see how closely {firstName}&apos;s
              work matches yours.
            </p>
          </div>
        </div>
      )}

      {/* identity */}
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-[260px] flex-1">
          <h1 className="font-display text-[clamp(36px,6vw,64px)] font-[420] italic leading-none tracking-display text-ink">
            {a.name}
          </h1>
          {s && (
            <div className="mt-2.5 text-[17px] text-ink-soft">
              {s.name}
              {s.address ? ` · ${s.address}` : ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <FavoriteButton slug={a.slug} name={a.name} variant="button" />
          {a.instagram_handle && (
            <a
              href={`https://instagram.com/${a.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className={btnPrimary}
            >
              @{a.instagram_handle} ↗
            </a>
          )}
        </div>
      </div>

      {/* meta strip */}
      <div className="mb-7 flex flex-wrap gap-7 border-y border-line py-[18px]">
        {a.profile_url && (
          <div className="min-w-[90px]">
            <Label>artist page</Label>
            <div className="mt-[7px]">
              <a
                href={a.profile_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-ink-soft hover:text-ink"
              >
                view ↗
              </a>
            </div>
          </div>
        )}
        {s?.website && (
          <div className="min-w-[90px]">
            <Label>shop site</Label>
            <div className="mt-[7px]">
              <a
                href={s.website}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-ink-soft hover:text-ink"
              >
                {new URL(s.website).hostname} ↗
              </a>
            </div>
          </div>
        )}
        <div className="min-w-[90px]">
          <Label>portfolio</Label>
          <div className="mt-[7px] text-base text-ink">
            {imgs.length} piece{imgs.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {a.bio && (
        <p className="mb-11 max-w-[620px] text-[clamp(16px,2vw,19px)] leading-[1.6] text-pretty text-ink">
          {a.bio}
        </p>
      )}

      {/* portfolio */}
      <Label>portfolio</Label>
      <div className="mt-4">
        <PortfolioGrid images={imgs} />
        {/* Dev-only backfill: when an artist has no images and a handle to scrape, offer an
            on-demand RapidAPI fetch (no Apify credits). FetchImagesButton self-gates in prod. */}
        {imgs.length === 0 && a.instagram_handle && (
          <div className="mt-4">
            <FetchImagesButton artistId={a.id} />
          </div>
        )}
      </div>
    </div>
  );
}
