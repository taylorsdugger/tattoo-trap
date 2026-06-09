"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "@/components/AuthProvider";
import { useIsLocalhost } from "@/lib/useIsLocalhost";
import { toast } from "@/lib/toast";
import { btnPrimary } from "./ui";

/* Admin-only curation control: source portfolio image candidates for one artist from RapidAPI
   (no Apify credits). Two shapes:
     - "full"  → big labelled button + status line, for the artist detail page's empty portfolio.
     - "icon"  → compact 9×9 glyph for the list cards' action row (next to favorite/trash).
   Both gate to admins on localhost: they render nothing otherwise (the route needs the local-only
   service-role key), and it 403s for non-admins anyway.

   This is Option A: it only queues `portfolio_images` candidates (source_url). They become
   visible thumbnails after the next `embed_images.py` run (inline locally, or via the scheduled
   worker on live), so the feedback says so rather than promising instant images. */
export default function FetchImagesButton({
  artistId,
  variant = "full",
  onQueued,
  className = "",
}: {
  artistId: number;
  variant?: "full" | "icon";
  /** For client-rendered lists (search results) that manage their own state. */
  onQueued?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isLocalhost = useIsLocalhost();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  // Admins on localhost only — the route needs the service-role key (local-only), so it'd error on
  // live. Renders null for everyone else, so nothing flashes for the public.
  if (!isAdmin || !isLocalhost) return null;

  async function run(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch("/api/fetch-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artistId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      return { ok: true, message: data.message ?? "Done." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
    }
  }

  // --- icon variant (list cards) -----------------------------------------------------------
  if (variant === "icon") {
    const onClick = async (e: React.MouseEvent) => {
      // Cards navigate on click — keep the fetch from triggering that.
      e.stopPropagation();
      e.preventDefault();
      if (state === "loading") return;
      setState("loading");
      const { ok, message: msg } = await run();
      setState(ok ? "done" : "error");
      toast(msg, ok ? "success" : "error");
      if (ok) {
        onQueued?.();
        router.refresh();
      }
    };
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        aria-label={`Fetch images from Instagram for this artist`}
        title="Fetch images from Instagram"
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border border-line font-mono text-[15px] leading-none text-ink-faint transition-[color,border-color,transform] duration-150 hover:border-ink hover:text-ink active:scale-90 disabled:opacity-40 disabled:active:scale-100 ${className}`}
      >
        <span aria-hidden>{state === "loading" ? "…" : "↧"}</span>
      </button>
    );
  }

  // --- full variant (detail page) ----------------------------------------------------------
  const onClick = async () => {
    setState("loading");
    setMessage("");
    const { ok, message: msg } = await run();
    setState(ok ? "done" : "error");
    setMessage(msg);
    if (ok) router.refresh();
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        className={`${btnPrimary} disabled:opacity-50`}
      >
        {state === "loading" ? "Fetching + embedding…" : "Fetch images from Instagram"}
      </button>
      {message && (
        <p
          className={`text-[13px] leading-[1.5] ${state === "error" ? "text-red-600" : "text-ink-soft"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
