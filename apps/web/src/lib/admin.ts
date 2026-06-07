/* Lightweight admin gate for the live-deployed site. There's no real auth here — just a shared
   secret the solo operator carries in the URL once (`?admin=<token>`), which we stash in
   localStorage and replay as the `x-admin-token` header on privileged routes. The server compares
   it to ADMIN_TOKEN. This is enough to keep the RapidAPI quota and service-role writes away from
   normal visitors; it is NOT a substitute for real auth, so don't gate anything destructive behind
   it beyond what's already here.

   Client-only: localStorage and window don't exist during SSR, so callers must read the token
   inside an effect (see useAdminToken) to avoid hydration mismatches. */

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tt_admin_token";

/** Resolve the admin token: if the URL carries `?admin=<token>`, persist it (so it survives
    navigation) and strip it from the address bar; otherwise fall back to the stored value.
    Returns null when there's no token or we're not in the browser. */
export function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("admin");
    if (fromUrl) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl);
      // Drop ?admin from the URL so the secret isn't left sitting in the address bar / history.
      params.delete("admin");
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState(null, "", clean);
      return fromUrl;
    }
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** React hook: null on first render (matches SSR), then the resolved token after mount. Gate
    admin-only UI on this so nothing flashes for normal visitors. */
export function useAdminToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(readAdminToken());
  }, []);
  return token;
}
