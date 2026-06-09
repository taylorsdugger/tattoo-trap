"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsLocalhost } from "@/lib/useIsLocalhost";
import { toast } from "@/lib/toast";

/* Bulk hard-delete of the whole hide queue — the "clear all" at the top of /admin/hidden. First
   click arms (turns red, no blocking confirm dialog); a second click within a few seconds hits
   /api/admin/delete-all-hidden, which permanently deletes every queued artist, its image rows, and
   storage thumbnails.

   Localhost-only, like TrashArtistButton: the delete route needs the service-role key, which only
   lives in apps/web/.env.local. Renders nothing on the deployed site (and the page already gates on
   admin). `count` just labels the button; the route re-reads the queue server-side. */
export default function ClearAllHiddenButton({ count }: { count: number }) {
  const router = useRouter();
  const isLocalhost = useIsLocalhost();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isLocalhost || count === 0) return null;

  const disarm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = null;
    setArmed(false);
  };

  const onClick = async () => {
    if (busy) return;

    // First click arms; the next click within the window actually deletes.
    if (!armed) {
      setArmed(true);
      toast(`Click again to permanently delete all ${count} hidden artists — cannot be undone.`, "info", 4000);
      disarmTimer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    disarm();

    setBusy(true);
    try {
      const res = await fetch("/api/admin/delete-all-hidden", { method: "POST" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        toast(`Clear all failed: ${error}`, "error");
        return;
      }
      const { deletedArtists } = await res.json().catch(() => ({ deletedArtists: count }));
      toast(`Deleted ${deletedArtists} hidden artists.`, "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseLeave={() => !busy && disarm()}
      disabled={busy}
      className={`cursor-pointer rounded-[1px] border px-3 py-2 font-mono text-xs tracking-[0.05em] transition-[color,border-color] duration-150 disabled:opacity-40 ${
        armed
          ? "border-red-600 text-red-600"
          : "border-line text-ink-faint hover:border-red-600 hover:text-red-600"
      }`}
    >
      {busy ? "deleting…" : armed ? `✕ click again to delete all ${count}` : `✕ delete all ${count}`}
    </button>
  );
}
