import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* OAuth callback: Supabase redirects here with a `?code` after Google sign-in. We exchange it for
   a session (which sets the auth cookies via the server client) and bounce the user back to wherever
   they started — read from the `tt_auth_next` cookie set at sign-in time, defaulting home. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const raw = cookieStore.get("tt_auth_next")?.value;
  let next = "/";
  if (raw) {
    try {
      const decoded = decodeURIComponent(raw);
      // Same-origin pathname only — reject protocol-relative (`//host`) open redirects.
      if (decoded.startsWith("/") && !decoded.startsWith("//")) next = decoded;
    } catch {
      // Malformed cookie value — fall back to home.
    }
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete("tt_auth_next");
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
