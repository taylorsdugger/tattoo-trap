"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Dev-only curation control: re-run the Python crawler against this artist's SHOP website, then
   embed whatever new candidates it finds. Use it to re-ingest a shop after a crawler change (the
   JS-gallery settle + relaxed name heuristics) without touching Apify/RapidAPI.

   Compact 9×9 glyph for the list cards' action row. Self-gates to dev — renders nothing in
   production, and the /api/recrawl-shop route 404s there anyway. */
export default function RecrawlShopButton({
  artistId,
  className = "",
}: {
  artistId: number;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  const onClick = async (e: React.MouseEvent) => {
    // Cards navigate on click — keep the crawl from triggering that.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    if (!window.confirm("Re-crawl this shop's website? May add new artists and images.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/recrawl-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artistId }),
      });
      const data = await res.json().catch(() => ({}));
      window.alert(res.ok ? (data.message ?? "Done.") : `Re-crawl failed: ${data.error ?? res.status}`);
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Re-crawl this artist's shop website"
      title="Re-crawl shop website"
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border border-line font-mono text-[15px] leading-none text-ink-faint transition-colors hover:border-ink hover:text-ink disabled:opacity-40 ${className}`}
    >
      <span aria-hidden>{busy ? "…" : "⟲"}</span>
    </button>
  );
}
