"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

/* Admin-only "hide" control — the deployed-site counterpart to TrashArtistButton. Hard deletion
   needs the service-role key (localhost only), so in production the operator hides a junk artist
   instead: one click records it in `hidden_artists`, which drops it from every public listing and
   queues it for local deletion at /admin/hidden.

   Shown for admins everywhere, including localhost, so the hide flow is testable locally (where it
   sits alongside the ✕ delete button). Hiding is reversible, so there's no arm/confirm step like
   delete has. */
export default function HideArtistButton({
  id,
  name,
  onHidden,
  className = "",
}: {
  id: number;
  name: string;
  /** For client-rendered lists (search results) — drop the card locally instead of refreshing. */
  onHidden?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const onClick = async (e: React.MouseEvent) => {
    // Cards navigate on click — keep the hide action from triggering that.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/hide-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        toast(`Hide failed: ${error}`, "error");
        return;
      }
      toast(`Hid "${name}". Delete it locally from /admin/hidden.`, "success");
      if (onHidden) onHidden();
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`Hide ${name}`}
      title={`Hide ${name} (queues it for deletion)`}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border border-line font-mono text-[15px] leading-none text-ink-faint transition-[color,border-color,transform] duration-150 hover:border-ink hover:text-ink active:scale-90 disabled:opacity-40 disabled:active:scale-100 ${className}`}
    >
      <span aria-hidden>{busy ? "…" : "⊘"}</span>
    </button>
  );
}
