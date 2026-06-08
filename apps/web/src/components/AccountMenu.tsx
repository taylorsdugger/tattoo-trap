"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/signIn";
import { createClient } from "@/lib/supabase/browser";

/* Header account control. Styled to sit inside the mono nav: a "Sign in" trigger when logged out,
   or the Google avatar + name + "Sign out" when logged in, so it's clear you're signed in. */
export default function AccountMenu() {
  const { email, name, avatarUrl, loading } = useAuth();
  const router = useRouter();
  const [imgOk, setImgOk] = useState(true);

  // Avoid flashing "Sign in" before we know the state.
  if (loading) return null;

  if (!email) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="transition-colors hover:text-ink"
      >
        Sign in
      </button>
    );
  }

  const displayName = name ?? email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <span className="flex items-center gap-2.5">
      {avatarUrl && imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={22}
          height={22}
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          className="h-[22px] w-[22px] rounded-full object-cover ring-1 ring-line"
        />
      ) : (
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-ink text-[10px] font-medium text-paper">
          {initial}
        </span>
      )}
      <span className="max-w-[120px] truncate normal-case text-ink" title={email}>
        {displayName}
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-ink-faint transition-colors hover:text-ink"
      >
        Sign out
      </button>
    </span>
  );
}
