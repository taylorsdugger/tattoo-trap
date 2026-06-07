"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Dev-only trash toggle for junk rows the crawler ingested ("ATHLETIC EVENT PERMITS" et al).
   Confirms, then hits the admin delete route, which removes the artist, its image rows, and
   storage thumbnails. Renders nothing in production builds — the route 404s there anyway. */
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
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  const onClick = async (e: React.MouseEvent) => {
    // Cards navigate on click — keep the trash action from triggering that.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    if (!window.confirm(`Delete "${name}" and all of its images? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/delete-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        window.alert(`Delete failed: ${error}`);
        return;
      }
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
      disabled={busy}
      aria-label={`Delete ${name} (junk data)`}
      title={`Delete ${name} (junk data)`}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border border-line font-mono text-[17px] leading-none text-ink-faint transition-colors hover:border-red-600 hover:text-red-600 disabled:opacity-40 ${className}`}
    >
      <span aria-hidden>{busy ? "…" : "✕"}</span>
    </button>
  );
}
