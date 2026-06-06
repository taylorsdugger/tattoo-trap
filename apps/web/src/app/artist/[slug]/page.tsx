import Link from "next/link";
import { notFound } from "next/navigation";
import PortfolioGrid from "@/components/PortfolioGrid";
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
  const imgs = (images ?? []) as PortfolioImage[];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
        ← back to search
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{a.name}</h1>
        {s && (
          <p className="text-neutral-400">
            {s.name}
            {s.address ? ` · ${s.address}` : ""}
          </p>
        )}
        <div className="flex gap-4 pt-1 text-sm">
          {a.instagram_handle && (
            <a
              href={`https://instagram.com/${a.instagram_handle}`}
              target="_blank"
              rel="noreferrer"
              className="text-rose-400 hover:underline"
            >
              @{a.instagram_handle}
            </a>
          )}
          {a.profile_url && (
            <a
              href={a.profile_url}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:underline"
            >
              artist page ↗
            </a>
          )}
          {s?.website && (
            <a
              href={s.website}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:underline"
            >
              shop site ↗
            </a>
          )}
        </div>
        {a.bio && <p className="max-w-2xl pt-2 text-sm text-neutral-300">{a.bio}</p>}
      </header>

      <PortfolioGrid images={imgs} />
    </div>
  );
}
