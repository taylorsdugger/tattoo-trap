import { NextResponse } from "next/server";
import { getCurrentRole, getCurrentUser } from "@/lib/auth";

/* Lightweight identity endpoint for client-side gating (AuthProvider). Returns the signed-in
   user's email + resolved role, or nulls when logged out. Role logic stays server-side. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ email: null, role: null, name: null, avatarUrl: null });
  const role = await getCurrentRole();
  const meta = user.user_metadata ?? {};
  return NextResponse.json({
    email: user.email ?? null,
    role,
    name: meta.full_name ?? meta.name ?? null,
    avatarUrl: meta.avatar_url ?? meta.picture ?? null,
  });
}
