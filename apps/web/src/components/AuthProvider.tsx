"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Role } from "@/lib/auth";
import { createClient } from "@/lib/supabase/browser";

/* Client-side auth context. Resolves the current user's email + role from /api/me (server keeps
   the role logic), and re-fetches whenever the Supabase auth state changes (sign in/out, token
   refresh). Gate admin-only UI on useIsAdmin(); show account state with useAuth(). */

type AuthState = {
  email: string | null;
  role: Role | null;
  name: string | null;
  avatarUrl: string | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  email: null,
  role: null,
  name: null,
  avatarUrl: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    email: null,
    role: null,
    name: null,
    avatarUrl: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setState({
            email: data.email ?? null,
            role: data.role ?? null,
            name: data.name ?? null,
            avatarUrl: data.avatarUrl ?? null,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ email: null, role: null, name: null, avatarUrl: null, loading: false });
        }
      }
    };

    void load();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void load());

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function useRole(): Role | null {
  return useContext(AuthContext).role;
}

/** True for admin or owner — the gate for curation controls. */
export function useIsAdmin(): boolean {
  const role = useRole();
  return role === "admin" || role === "owner";
}
