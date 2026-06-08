import { createClient } from "@supabase/supabase-js";

/* Service-role Supabase client (bypasses RLS). Server-side only — never import from a client
   component. Used by the curation routes to perform privileged writes AFTER they've authorized
   the caller by role. Returns null when the key is unconfigured so routes can surface a clear
   500 rather than constructing a broken client. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
