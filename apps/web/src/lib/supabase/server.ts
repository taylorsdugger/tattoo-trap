import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/* Auth-aware Supabase client for Server Components and Route Handlers. Reads the session from
   the request cookies (Next 15: `cookies()` is async) so server code can resolve the current
   user + their RLS context. `setAll` is a no-op when called from a Server Component (cookies are
   read-only there); the middleware does the actual token refresh + Set-Cookie. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
