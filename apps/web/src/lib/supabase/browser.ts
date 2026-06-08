"use client";

import { createBrowserClient } from "@supabase/ssr";

/* Auth-aware Supabase client for client components. Reads/writes the session from cookies
   (set by the server during the OAuth callback + refreshed by middleware), so the logged-in
   user's JWT rides along on queries — RLS then sees `auth.uid()`. Distinct from the anon
   read-only client in `lib/supabase.ts`, which has no session. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
