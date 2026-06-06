import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface misconfiguration early in dev rather than failing cryptically at query time.
  // eslint-disable-next-line no-console
  console.warn(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
  );
}

// createClient throws on an empty URL, which would break `next build` in environments
// without env vars. Fall back to a harmless placeholder so the module loads; real queries
// only run at request time, where the real env is present (and otherwise fail gracefully).
const PLACEHOLDER_URL = "https://placeholder.supabase.co";

// Anon client. RLS restricts this to read-only on display tables + the search RPC.
// Safe to use in both server and client components.
export const supabase = createClient(url || PLACEHOLDER_URL, anonKey || "placeholder-anon-key", {
  auth: { persistSession: false },
});

// Empty when unconfigured, so image helpers can detect missing config and return null.
export const SUPABASE_URL = url ?? "";
