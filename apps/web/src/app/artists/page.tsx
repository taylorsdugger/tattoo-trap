import Link from "next/link";
import ArtistDirectoryCard from "@/components/ArtistDirectoryCard";
import NameSearch from "@/components/NameSearch";
import { Label } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import type { DirectoryArtist, Metro } from "@/lib/types";

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

async function getArtists(): Promise<DirectoryArtist[]> {
  try {
    // Anon RLS allows read-only on all display tables, so we can embed the related
    // shop -> metro and a sample of portfolio images in one query.
    const { data, error } = await supabase
      .from("artists")
      .select(
        `id, name, slug, instagram_handle, avatar_url,
         shop:shops ( id, name, address, website, instagram_handle, metro:metros ( name, slug ) ),
         images:portfolio_images ( storage_path, source_url )`,
      )
      .order("name");
    if (error) throw error;
    return (data ?? []) as unknown as DirectoryArtist[];
  } catch (err) {
    console.error("Failed to load artists:", err);
    return [];
  }
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ metro?: string; q?: string; pics?: string }>;
}) {
  const { metro: metroFilter, q: nameQuery, pics } = await searchParams;
  const [metros, allArtists] = await Promise.all([getMetros(), getArtists()]);

  const picsOnly = pics === "1";
  const query = nameQuery?.trim().toLowerCase() ?? "";
  const artists = allArtists.filter((a) => {
    if (metroFilter && a.shop?.metro?.slug !== metroFilter) return false;
    if (query && !a.name.toLowerCase().includes(query)) return false;
    if (picsOnly && !(a.images && a.images.length > 0)) return false;
    return true;
  });

  const activeMetro = metros.find((m) => m.slug === metroFilter) ?? null;

  // Build a pics-toggle href that preserves the current metro/name filters.
  const picsToggleParams = new URLSearchParams();
  if (metroFilter) picsToggleParams.set("metro", metroFilter);
  if (nameQuery?.trim()) picsToggleParams.set("q", nameQuery.trim());
  if (!picsOnly) picsToggleParams.set("pics", "1");
  const picsToggleHref = `/artists${picsToggleParams.toString() ? `?${picsToggleParams}` : ""}`;

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <div>
        <Label>browse mode · {activeMetro ? activeMetro.name : "all metros"}</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          {activeMetro ? `Artists in ${activeMetro.name}` : "All artists"}
        </h1>
        <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
          Browse every artist in the database. Tap through to a portfolio, or jump straight to
          their Instagram or shop. Looking for a specific style?{" "}
          <Link href="/" className="border-b border-line-strong text-ink">
            search by image
          </Link>
          .
        </p>
      </div>

      {metros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/artists"
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
                href={`/artists?metro=${m.slug}`}
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

      <div className="flex flex-wrap gap-2">
        <Link
          href={picsToggleHref}
          className={`rounded-full border px-3 py-1 font-mono text-xs ${
            picsOnly
              ? "border-ink text-ink"
              : "border-line text-ink-soft hover:border-ink hover:text-ink"
          }`}
        >
          {picsOnly ? "✓ " : ""}With pics only
        </Link>
      </div>

      <NameSearch placeholder="Search artists by name…" />

      {artists.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No artists found
          {activeMetro ? ` in ${activeMetro.name}` : ""}
          {query ? ` matching “${nameQuery?.trim()}”` : ""}.{" "}
          {query
            ? "Try a different name."
            : "Run the crawl/embed pipeline to populate the database."}
        </p>
      ) : (
        <>
          <Label>
            {artists.length} artist{artists.length === 1 ? "" : "s"}
          </Label>
          <div>
            {artists.map((a, i) => (
              <ArtistDirectoryCard key={a.id} artist={a} rank={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
