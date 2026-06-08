"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

/* Admin-only trash toggle for junk rows the crawler ingested ("ATHLETIC EVENT PERMITS" et al).
   First click arms (turns red, no blocking confirm dialog); a second click within a few seconds
   hits the admin delete route, which removes the artist, its image rows, and storage thumbnails.
   Renders nothing for non-admins — the route 403s for them anyway. */
export default function TrashArtistButton({
  id,
  name,
  onDeleted,
  className = "",
}: {
  id: number;
  name: string;
  /** For client-rendered lists (search results) — hide the card locally instead of refreshing. */
  onDeleted?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!isAdmin) return null;

  const disarm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = null;
    setArmed(false);
  };

  const onClick = async (e: React.MouseEvent) => {
    // Cards navigate on click — keep the trash action from triggering that.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;

    // First click arms; the next click within the window actually deletes.
    if (!armed) {
      setArmed(true);
      toast(`Click again to delete "${name}" and all its images — cannot be undone.`, "info", 4000);
      disarmTimer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    disarm();

    setBusy(true);
    try {
      const res = await fetch("/api/admin/delete-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        toast(`Delete failed: ${error}`, "error");
        return;
      }
      toast(`Deleted "${name}".`, "success");
      if (onDeleted) onDeleted();
      else router.refresh();
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
      aria-label={`Delete ${name} (junk data)`}
      title={armed ? `Click again to delete ${name}` : `Delete ${name} (junk data)`}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border font-mono text-[17px] leading-none transition-[color,border-color,transform] duration-150 active:scale-90 disabled:opacity-40 disabled:active:scale-100 ${
        armed
          ? "border-red-600 text-red-600"
          : "border-line text-ink-faint hover:border-red-600 hover:text-red-600"
      } ${className}`}
    >
      <span aria-hidden>{busy ? "…" : "✕"}</span>
    </button>
  );
}
