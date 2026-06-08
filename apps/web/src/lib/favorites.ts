"use client";

import { useSyncExternalStore } from "react";
import { signInWithGoogle } from "@/lib/signIn";
import { createClient } from "@/lib/supabase/browser";

/* Favorites are user-owned: rows in the `favorites` table keyed by artist_id, scoped to the
   logged-in user by RLS. This module keeps an in-memory Set of the current user's favorite
   artist ids as a useSyncExternalStore store — hydrated on first use and re-hydrated on auth
   changes. Toggling does an optimistic update, then the DB write (reverting on error). When
   logged out, toggling triggers Google sign-in instead. */

const supabase = createClient();

const EMPTY: ReadonlySet<number> = new Set();

// Current snapshot — replaced (new reference) on every change so useSyncExternalStore re-renders.
let favoriteIds: ReadonlySet<number> = EMPTY;
// Cached so toggling can flip the heart synchronously without an auth round-trip per click.
// null = unknown (pre-hydration or logged out); resolved lazily on the first toggle.
let currentUserId: string | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setIds(ids: Iterable<number>) {
  favoriteIds = new Set(ids);
  emit();
}

async function hydrate() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  currentUserId = user?.id ?? null;
  if (!user) {
    setIds([]);
    return;
  }
  const { data, error } = await supabase.from("favorites").select("artist_id");
  if (error) {
    setIds([]);
    return;
  }
  setIds((data ?? []).map((row) => row.artist_id as number));
}

/** Hydrate once and keep in sync with auth state. Triggered lazily by the first subscriber. */
function ensureStarted() {
  if (started) return;
  started = true;
  void hydrate();
  supabase.auth.onAuthStateChange(() => void hydrate());
}

/** Add or remove an artist from the current user's favorites. Logged out → prompt sign-in. */
export async function toggleFavorite(artistId: number) {
  // Resolve the user only when we don't already have it cached (logged out, or a click that
  // landed before hydration finished). Once cached, the heart flips with zero network wait.
  if (currentUserId === null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      await signInWithGoogle();
      return;
    }
    currentUserId = user.id;
  }
  const userId = currentUserId;

  const wasFav = favoriteIds.has(artistId);
  const optimistic = new Set(favoriteIds);
  if (wasFav) optimistic.delete(artistId);
  else optimistic.add(artistId);
  favoriteIds = optimistic;
  emit();

  const { error } = wasFav
    ? await supabase.from("favorites").delete().eq("user_id", userId).eq("artist_id", artistId)
    : await supabase.from("favorites").insert({ user_id: userId, artist_id: artistId });

  if (error) {
    // Revert the optimistic change.
    const reverted = new Set(favoriteIds);
    if (wasFav) reverted.add(artistId);
    else reverted.delete(artistId);
    favoriteIds = reverted;
    emit();
    // eslint-disable-next-line no-console
    console.error("toggleFavorite failed:", error.message);
  }
}

function subscribe(onChange: () => void) {
  ensureStarted();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Reactive set of the current user's favorite artist ids. Empty on the server / before hydration. */
export function useFavoriteIds(): ReadonlySet<number> {
  return useSyncExternalStore(
    subscribe,
    () => favoriteIds,
    () => EMPTY,
  );
}

export function useIsFavorite(artistId: number): boolean {
  return useFavoriteIds().has(artistId);
}
