import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/* Server-side auth + role resolution. Roles rank owner > admin > user. The owner is hardcoded via
   the OWNER_EMAIL env var (resolved by email at request time, no DB row needed); admins are
   elevated in the `profiles` table via SQL. Use these from Server Components and Route Handlers. */

export type Role = "user" | "admin" | "owner";

const RANK: Record<Role, number> = { user: 1, admin: 2, owner: 3 };

/** True if `role` meets or exceeds `min` in the owner > admin > user ranking. */
export function hasMinRole(role: Role | null, min: Role): boolean {
  return role != null && RANK[role] >= RANK[min];
}

/** The currently signed-in user, or null. Validates the JWT against Supabase (not just the cookie). */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Resolve the current user's role: owner if their email matches OWNER_EMAIL, otherwise their
    `profiles.role` (defaulting to "user"). Returns null when no one is signed in. */
export async function getCurrentRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const owner = process.env.OWNER_EMAIL;
  if (owner && user.email && user.email.toLowerCase() === owner.toLowerCase()) {
    return "owner";
  }

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return (data?.role as Role | undefined) ?? "user";
}
