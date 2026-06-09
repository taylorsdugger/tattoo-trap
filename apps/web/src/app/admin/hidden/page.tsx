import Link from "next/link";
import { redirect } from "next/navigation";
import ArtistDirectoryCard from "@/components/ArtistDirectoryCard";
import ClearAllHiddenButton from "@/components/ClearAllHiddenButton";
import UnhideArtistButton from "@/components/UnhideArtistButton";
import { Label } from "@/components/ui";
import { getCurrentRole, hasMinRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DirectoryArtist } from "@/lib/types";

// Read the hide queue live; never prerender it.
export const dynamic = "force-dynamic";

/* The hide queue. On the deployed site the operator hides junk artists (HideArtistButton) since the
   hard delete needs the localhost-only service-role key. This page is where those hidden artists
   collect: review them, restore a misclick (unhide), and — when run locally — delete them for real
   with the same trash button as the rest of the app (it self-gates to localhost). Viewable anywhere
   as the queue; deletable only locally. */
export default async function HiddenArtistsPage() {
  const role = await getCurrentRole();
  if (!hasMinRole(role, "admin")) redirect("/");

  const { data: hiddenRows } = await supabase
    .from("hidden_artists")
    .select("artist_id")
    .order("created_at", { ascending: false });
  const ids = (hiddenRows ?? []).map((r) => r.artist_id as number);

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
    // Preserve the queue order (most-recently hidden first).
    const order = new Map(ids.map((id, i) => [id, i]));
    artists = ((data ?? []) as unknown as DirectoryArtist[]).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <Link
        href="/artists"
        className="font-mono text-xs tracking-[0.05em] text-ink-soft transition-colors hover:text-ink"
      >
        ← back to artists
      </Link>

      <div>
        <Label>admin · hide queue</Label>
        <h1 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
          Hidden artists
        </h1>
        <p className="mt-3 max-w-[600px] leading-[1.55] text-ink-soft">
          Junk artists hidden from the live site, queued for deletion. Open this page on{" "}
          <span className="font-mono text-ink">localhost</span> to permanently delete them with the
          ✕ button (deletion needs the service-role key, which only exists locally). Restore a
          mistake with unhide.
        </p>
        {artists.length > 0 && (
          <div className="mt-5">
            <ClearAllHiddenButton count={artists.length} />
          </div>
        )}
      </div>

      {artists.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing hidden right now.</p>
      ) : (
        <div>
          {artists.map((artist, i) => (
            <div key={artist.id} className="relative">
              <ArtistDirectoryCard artist={artist} rank={i + 1} />
              <div className="-mt-3 pb-3 pl-9">
                <UnhideArtistButton id={artist.id} name={artist.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
