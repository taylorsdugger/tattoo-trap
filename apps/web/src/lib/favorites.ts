"use client";

import { useSyncExternalStore } from "react";

/* Favorites are anonymous (the app has no auth), so they live in localStorage,
   keyed by artist slug. A custom event keeps same-tab listeners in sync; the
   native `storage` event covers other tabs. */

const STORAGE_KEY = "tt:favorite-artists";
const CHANGE_EVENT = "tt:favorites-change";

const EMPTY: string[] = [];

// Cache the parsed snapshot so useSyncExternalStore sees a stable reference.
let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function readFavorites(): string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY; // storage disabled (private mode etc.)
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function writeFavorites(slugs: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // Storage full or disabled — the toggle still updates the in-memory cache
    // below so the UI responds; it just won't persist.
    cachedRaw = null;
    cachedList = slugs;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Add or remove an artist (by slug) from favorites. Newest additions go last. */
export function toggleFavorite(slug: string) {
  const current = readFavorites();
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug];
  writeFavorites(next);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Reactive list of favorited artist slugs, in the order they were saved.
    Returns [] on the server / first paint, so SSR markup stays stable. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, readFavorites, () => EMPTY);
}

export function useIsFavorite(slug: string): boolean {
  return useFavorites().includes(slug);
}
