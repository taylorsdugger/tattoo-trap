"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

/* Admin-only curation control: re-run the Python crawler against this artist's SHOP website, then
   embed whatever new candidates it finds. Use it to re-ingest a shop after a crawler change (the
   JS-gallery settle + relaxed name heuristics) without touching Apify/RapidAPI.

   Compact 9×9 glyph for the list cards' action row. Gated to admins — renders nothing otherwise.
   First click arms (no blocking confirm dialog); a second click within a few seconds runs it.
   NOTE: the route spawns local Python+Playwright, so it only works in local dev (serverless has
   no pipeline venv); the button still shows for admins on live but the call fails gracefully. */
export default function RecrawlShopButton({
  artistId,
  className = "",
}: {
  artistId: number;
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
    // Cards navigate on click — keep the crawl from triggering that.
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;

    // First click arms; the next click within the window actually re-crawls.
    if (!armed) {
      setArmed(true);
      toast("Click again to re-crawl this shop — may add new artists and images.", "info", 3500);
      disarmTimer.current = setTimeout(() => setArmed(false), 3500);
      return;
    }
    disarm();

    setBusy(true);
    try {
      const res = await fetch("/api/recrawl-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artistId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(data.message ?? "Done.", "success");
        router.refresh();
      } else {
        toast(`Re-crawl failed: ${data.error ?? res.status}`, "error");
      }
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
      aria-label="Re-crawl this artist's shop website"
      title={armed ? "Click again to confirm re-crawl" : "Re-crawl shop website"}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border font-mono text-[15px] leading-none transition-[color,border-color,transform] duration-150 active:scale-90 disabled:opacity-40 disabled:active:scale-100 ${
        armed
          ? "border-ink text-ink"
          : "border-line text-ink-faint hover:border-ink hover:text-ink"
      } ${className}`}
    >
      <span aria-hidden>{busy ? "…" : armed ? "?" : "⟲"}</span>
    </button>
  );
}
