import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="space-y-6">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
        ← back to search
      </Link>
      <h1 className="text-2xl font-semibold">
        Tattoo artists in {m.name}
        {m.state ? `, ${m.state}` : ""}
      </h1>

      {shopList.length === 0 ? (
        <p className="text-sm text-neutral-400">No shops crawled yet for this metro.</p>
      ) : (
        <div className="space-y-6">
          {shopList.map((shop) => (
            <section key={shop.id} className="space-y-2">
              <h2 className="font-medium">
                {shop.name}
                {shop.website && (
                  <a
                    href={shop.website}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-neutral-500 hover:underline"
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
                    className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-200 hover:border-rose-500 hover:text-rose-300"
                  >
                    {ar.name}
                  </Link>
                ))}
                {(byShop.get(shop.id) ?? []).length === 0 && (
                  <span className="text-xs text-neutral-600">no artists discovered</span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
