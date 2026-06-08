import Link from "next/link";
import ArtistDirectoryCard from "@/components/ArtistDirectoryCard";
import { Label } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryArtist } from "@/lib/types";

/* Favorites are user-owned, so this is a server component: resolve the user, read their favorite
   artist ids (RLS scopes to their own rows), then fetch those artists with the same embedded
   shop -> metro + images shape the directory uses. Logged out → a sign-in prompt. */
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
        <div>
          <Label>your account</Label>
          <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
            Favorite artists
          </h1>
          <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
            Sign in with the <span className="text-ink">Sign in</span> button up top to save artists
            with the ♡ button and see them here — your favorites follow you across devices.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: favRows } = await supabase
    .from("favorites")
    .select("artist_id")
    .order("created_at", { ascending: false });
  const ids = (favRows ?? []).map((row) => row.artist_id as number);

  let artists: DirectoryArtist[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("artists")
      .select(
        `id, name, slug, instagram_handle, avatar_url,
         shop:shops ( id, name, address, website, instagram_handle, metro:metros ( name, slug ) ),
         images:portfolio_images ( storage_path, source_url )`,
      )
      .in("id", ids);
    // Preserve newest-saved-first order from the favorites query.
    const order = new Map(ids.map((id, i) => [id, i]));
    artists = ((data ?? []) as unknown as DirectoryArtist[]).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <div>
        <Label>saved to your account</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          Favorite artists
        </h1>
        <p className="mt-3 max-w-[560px] leading-[1.55] text-ink-soft">
          Artists you&apos;ve saved with the ♡ button.
        </p>
      </div>

      {artists.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No favorites yet. Save artists from{" "}
          <Link href="/" className="border-b border-line-strong text-ink">
            search results
          </Link>{" "}
          or the{" "}
          <Link href="/artists" className="border-b border-line-strong text-ink">
            artist directory
          </Link>
          .
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
