import ArtistDirectory from "@/components/ArtistDirectory";
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
  const { metro, q, pics } = await searchParams;
  // The full list is loaded once; ArtistDirectory filters it client-side so
  // toggling metros/name/has-pics is instant (no refetch). The URL params only
  // seed the initial filter state for shareable/refresh-safe links.
  const [metros, artists] = await Promise.all([getMetros(), getArtists()]);

  return (
    <div className="py-[clamp(28px,5vw,60px)]">
      <ArtistDirectory
        metros={metros}
        artists={artists}
        initialMetro={metro ?? ""}
        initialQuery={q ?? ""}
        initialPicsOnly={pics === "1"}
      />
    </div>
  );
}
