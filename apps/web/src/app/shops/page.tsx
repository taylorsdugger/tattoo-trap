import Link from "next/link";
import ShopDirectoryCard from "@/components/ShopDirectoryCard";
import NameSearch from "@/components/NameSearch";
import { Label } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { DirectoryShop, Metro } from "@/lib/types";

// Data comes from the DB at request time; don't fetch during the build.
export const dynamic = "force-dynamic";

async function getMetros(): Promise<Metro[]> {
  try {
    const { data, error } = await supabase.from("metros").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Metro[];
  } catch (err) {
    console.error("Failed to load metros:", err);
    return [];
  }
}

async function getShops(): Promise<DirectoryShop[]> {
  try {
    // Anon RLS allows read-only on all display tables, so we can embed the
    // metro and each shop's artists (with a sample of portfolio images) in one query.
    const { data, error } = await supabase
      .from("shops")
      .select(
        `id, name, address, website, instagram_handle,
         metro:metros ( name, slug ),
         artists ( id, name, slug, instagram_handle,
           images:portfolio_images ( storage_path ) )`,
      )
      .order("name");
    if (error) throw error;
    const shops = (data ?? []) as unknown as DirectoryShop[];
    // Only shops that artists are actually a part of.
    return shops.filter((s) => (s.artists?.length ?? 0) > 0);
  } catch (err) {
    console.error("Failed to load shops:", err);
    return [];
  }
}

export default async function ShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ metro?: string; q?: string }>;
}) {
  const { metro: metroFilter, q: nameQuery } = await searchParams;
  const [metros, allShops] = await Promise.all([getMetros(), getShops()]);

  const query = nameQuery?.trim().toLowerCase() ?? "";
  const shops = allShops.filter((s) => {
    if (metroFilter && s.metro?.slug !== metroFilter) return false;
    if (query && !s.name.toLowerCase().includes(query)) return false;
    return true;
  });

  const activeMetro = metros.find((m) => m.slug === metroFilter) ?? null;

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <div>
        <Label>browse mode · {activeMetro ? activeMetro.name : "all metros"}</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          {activeMetro ? `Shops in ${activeMetro.name}` : "All shops"}
        </h1>
        <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
          Every shop our artists work out of. Tap an artist to see their portfolio, or jump
          straight to the shop&apos;s site or Instagram. Looking for a specific style?{" "}
          <Link href="/" className="border-b border-line-strong text-ink">
            search by image
          </Link>
          .
        </p>
      </div>

      {metros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/shops"
            className={`rounded-full border px-3 py-1 font-mono text-xs ${
              metroFilter
                ? "border-line text-ink-soft hover:border-ink hover:text-ink"
                : "border-ink text-ink"
            }`}
          >
            All metros
          </Link>
          {metros.map((m) => {
            const active = m.slug === metroFilter;
            return (
              <Link
                key={m.id}
                href={`/shops?metro=${m.slug}`}
                className={`rounded-full border px-3 py-1 font-mono text-xs ${
                  active
                    ? "border-ink text-ink"
                    : "border-line text-ink-soft hover:border-ink hover:text-ink"
                }`}
              >
                {m.name}
              </Link>
            );
          })}
        </div>
      )}

      <NameSearch placeholder="Search shops by name…" />

      {shops.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No shops found
          {activeMetro ? ` in ${activeMetro.name}` : ""}
          {query ? ` matching “${nameQuery?.trim()}”` : ""}.{" "}
          {query
            ? "Try a different name."
            : "Run the crawl/embed pipeline to populate the database."}
        </p>
      ) : (
        <>
          <Label>
            {shops.length} shop{shops.length === 1 ? "" : "s"}
          </Label>
          <div>
            {shops.map((s, i) => (
              <ShopDirectoryCard key={s.id} shop={s} rank={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
