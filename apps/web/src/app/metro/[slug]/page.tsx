import Link from "next/link";
import { notFound } from "next/navigation";
import { Label } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { Artist, Metro, Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: metro } = await supabase
    .from("metros")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!metro) notFound();
  const m = metro as Metro;

  const { data: shops } = await supabase.from("shops").select("*").eq("metro_id", m.id).order("name");
  const shopList = (shops ?? []) as Shop[];

  const { data: artists } = await supabase
    .from("artists")
    .select("*")
    .in("shop_id", shopList.length ? shopList.map((s) => s.id) : [-1])
    .order("name");
  const artistList = (artists ?? []) as Artist[];
  const byShop = new Map<number, Artist[]>();
  for (const ar of artistList) {
    byShop.set(ar.shop_id, [...(byShop.get(ar.shop_id) ?? []), ar]);
  }

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <Link
        href="/"
        className="font-mono text-xs tracking-[0.05em] text-ink-soft transition-colors hover:text-ink"
      >
        ← back to search
      </Link>

      <div>
        <Label>{m.state ?? "metro"}</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          Tattoo artists in {m.name}
        </h1>
      </div>

      {shopList.length === 0 ? (
        <p className="text-sm text-ink-soft">No shops crawled yet for this metro.</p>
      ) : (
        <div className="space-y-7">
          {shopList.map((shop) => (
            <section key={shop.id} className="space-y-2.5 border-t border-line pt-5">
              <h2 className="font-display text-xl font-[420] tracking-display text-ink">
                {shop.name}
                {shop.website && (
                  <a
                    href={shop.website}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2.5 align-middle font-mono text-[11px] text-ink-faint hover:text-ink"
                  >
                    site ↗
                  </a>
                )}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(byShop.get(shop.id) ?? []).map((ar) => (
                  <Link
                    key={ar.id}
                    href={`/artist/${ar.slug}`}
                    className="rounded-full border border-line px-3 py-1 font-mono text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    {ar.name}
                  </Link>
                ))}
                {(byShop.get(shop.id) ?? []).length === 0 && (
                  <span className="font-mono text-[11px] text-ink-faint">
                    no artists discovered
                  </span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
