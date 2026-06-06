import Link from "next/link";
import ArtistDirectoryCard from "@/components/ArtistDirectoryCard";
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
  } catch {
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
  } catch {
    return [];
  }
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ metro?: string }>;
}) {
  const { metro: metroFilter } = await searchParams;
  const [metros, allArtists] = await Promise.all([getMetros(), getArtists()]);

  const artists = metroFilter
    ? allArtists.filter((a) => a.shop?.metro?.slug === metroFilter)
    : allArtists;

  const activeMetro = metros.find((m) => m.slug === metroFilter) ?? null;

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

      {artists.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No artists found
          {activeMetro ? ` in ${activeMetro.name}` : ""}. Run the crawl/embed pipeline to populate
          the database.
        </p>
      ) : (
        <>
          <Label>
            {artists.length} artist{artists.length === 1 ? "" : "s"}
          </Label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((a) => (
              <ArtistDirectoryCard key={a.id} artist={a} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
