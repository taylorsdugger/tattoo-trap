"use client";

import { createClient } from "@/lib/supabase/browser";

/* Kick off Google OAuth, returning the user to wherever they are after the round-trip. Shared by
   the header AccountMenu, the favorites CTA, and the favorite button's logged-out path.

   We stash the return path in a short-lived, same-origin cookie (read by the /auth/callback route)
   rather than a `redirectTo` query string. Supabase's redirect allow-list can't reliably match a
   dynamic query string, and an unmatched redirectTo silently falls back to the Site URL — the
   deployed domain — which is exactly what breaks sign-in on localhost. A bare path matches cleanly. */
export function signInWithGoogle() {
  const supabase = createClient();
  document.cookie = `tt_auth_next=${encodeURIComponent(
    window.location.pathname,
  )}; path=/; max-age=600; samesite=lax`;
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
