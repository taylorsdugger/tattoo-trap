"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

/* Revert a hide from the /admin/hidden queue — removes the `hidden_artists` row so the artist
   reappears in public listings. Admin-gated by the page it lives on (and the route 403s otherwise);
   unlike Hide/Delete it shows regardless of hostname, since reviewing the queue happens anywhere. */
export default function UnhideArtistButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/hide-artist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        toast(`Unhide failed: ${error}`, "error");
        return;
      }
      toast(`Restored "${name}".`, "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="cursor-pointer font-mono text-xs text-ink-soft underline-offset-2 transition-colors hover:text-ink hover:underline disabled:opacity-40"
    >
      {busy ? "restoring…" : "↺ unhide"}
    </button>
  );
}
