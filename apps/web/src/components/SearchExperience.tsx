"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { embedImage } from "@/lib/embedder";
import { searchArtistsByImage } from "@/lib/search";
import type { ArtistMatch, Metro } from "@/lib/types";
import ImageDropzone from "./ImageDropzone";
import SearchResults from "./SearchResults";
import { Label, RefPlate, btnGhostSm } from "./ui";

type Screen = "home" | "metro" | "searching" | "results";

// Persist a finished search in sessionStorage so navigating to an artist and
// hitting back restores the results instead of dumping you on the home screen.
const SESSION_KEY = "tt:lastSearch";

type SavedSearch = {
  embedding: number[];
  metroSlug: string | null;
  previewUrl: string | null;
  results: ArtistMatch[];
};

function saveSession(s: SavedSearch) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Quota exceeded (large preview) — keep the results, drop the thumbnail.
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, previewUrl: null }));
    } catch {
      /* give up silently; the live in-memory state still works this visit */
    }
  }
}

function loadSession(): SavedSearch | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SavedSearch;
    if (!Array.isArray(s.results) || !Array.isArray(s.embedding)) return null;
    return s;
  } catch {
    return null;
  }
}

// Downscale the reference to a small JPEG data URL: small enough for sessionStorage
// and it survives navigation (object URLs are revoked / don't persist).
async function makeThumb(file: File, max = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function SearchExperience({ metros }: { metros: Metro[] }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [metroSlug, setMetroSlug] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ArtistMatch[]>([]);

  // Restore the last search on mount (e.g. after viewing an artist and going back).
  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;
    setEmbedding(saved.embedding);
    setMetroSlug(saved.metroSlug);
    setPreviewUrl(saved.previewUrl);
    setResults(saved.results);
    setScreen("results");
  }, []);

  function metroName(slug: string | null) {
    if (!slug) return "All metros";
    return metros.find((m) => m.slug === slug)?.name ?? slug;
  }

  async function handleFile(f: File) {
    setError(null);
    setResults([]);
    setEmbedding(null);
    setFile(f);
    try {
      setPreviewUrl(await makeThumb(f));
    } catch {
      setPreviewUrl(URL.createObjectURL(f));
    }
    setScreen("metro");
  }

  function reset() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setScreen("home");
    setFile(null);
    setPreviewUrl(null);
    setEmbedding(null);
    setMetroSlug(null);
    setResults([]);
    setError(null);
  }

  async function runSearch(slug: string | null) {
    // Need either a fresh file to embed or an embedding restored from a prior search.
    if (!file && !embedding) return;
    setMetroSlug(slug);
    setError(null);
    setScreen("searching");
    setStep(0);
    setDetail(null);
    try {
      let emb = embedding;
      if (!emb) {
        emb = await embedImage(file!, setDetail);
        setEmbedding(emb);
      }
      setStep(1);
      setDetail(null);
      const matches = await searchArtistsByImage(emb, slug, 24);
      setStep(2);
      setResults(matches);
      setScreen("results");
      saveSession({ embedding: emb, metroSlug: slug, previewUrl, results: matches });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setScreen("metro");
    }
  }

  /* ------------------------------------------------------------- HOME */
  if (screen === "home") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center py-[min(8vh,80px)]">
        <div className="w-full max-w-[720px] text-center">
          <Label>Upload a tattoo you love</Label>
          <h1 className="mt-[18px] font-display text-[clamp(38px,7vw,76px)] font-[420] italic leading-[1.02] tracking-display text-balance text-ink">
            Find Artists near you
          </h1>
          <p className="mx-auto mt-5 max-w-[480px] text-[clamp(15px,1.6vw,18px)] leading-[1.55] text-pretty text-ink-soft">
            Drop a reference image. We compare it against thousands of portfolio pieces and rank
            the artists near you whose style is the closest match.
          </p>

          <div className="mt-10">
            <ImageDropzone onFile={handleFile} />
          </div>

          <Link
            href="/artists"
            className="mt-[22px] inline-block border-b border-line-strong pb-0.5 font-mono text-xs tracking-[0.04em] text-ink-soft"
          >
            Just browsing? Explore artists by metro →
          </Link>

          <div className="mt-[30px] flex flex-wrap justify-center gap-[22px]">
            {[
              ["01", "Embed"],
              ["02", "Compare"],
              ["03", "Rank near you"],
            ].map(([n, t]) => (
              <div key={n} className="flex items-baseline gap-[7px]">
                <span className="font-mono text-[11px] text-ink-faint">{n}</span>
                <Label className="text-ink-soft">{t}</Label>
              </div>
            ))}
          </div>

          {error && <div className="mt-4 font-mono text-xs text-red-800">{error}</div>}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- METRO PICK */
  if (screen === "metro") {
    return (
      <div className="py-[clamp(36px,6vw,72px)]">
        <div className="mb-8 flex flex-wrap items-start gap-7">
          {previewUrl && (
            <div className="w-[132px] shrink-0">
              <RefPlate src={previewUrl} ratio="4/5" />
              <button
                onClick={reset}
                className="mt-2 cursor-pointer font-mono text-[10.5px] tracking-[0.04em] text-ink-soft"
              >
                ↺ replace image
              </button>
            </div>
          )}
          <div className="min-w-[260px] flex-1">
            <Label>your reference is ready</Label>
            <h2 className="mt-3 font-display text-[clamp(30px,5vw,52px)] font-[420] italic leading-[1.05] tracking-display text-ink">
              Where are you looking?
            </h2>
            <p className="mt-3 max-w-[460px] leading-[1.55] text-ink-soft">
              Search every metro at once, or narrow to one. We rank artists by visual match to
              your reference.
            </p>
            {error && <div className="mt-3 font-mono text-xs text-red-800">{error}</div>}
            {metros.length === 0 && (
              <div className="mt-3 font-mono text-xs text-ink-soft">
                No metros found — apply the Supabase migrations first.
              </div>
            )}
          </div>
        </div>

        {/* search all metros */}
        <button
          onClick={() => runSearch(null)}
          className="tt-row mb-px flex w-full cursor-pointer items-center justify-between gap-[18px] rounded-[2px] bg-ink px-[26px] py-[22px] text-left text-paper"
        >
          <div className="min-w-0 flex-auto">
            <span className="font-mono text-[10.5px] uppercase tracking-label text-paper/60">
              every city · widest net
            </span>
            <div className="mt-1.5 font-display text-[clamp(24px,3.5vw,34px)] font-[420] italic leading-[1.05] tracking-display">
              Search all metros
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            <span className="whitespace-nowrap font-mono text-[12.5px] text-paper/80">
              {metros.length} metro{metros.length === 1 ? "" : "s"}
            </span>
            <span className="font-mono text-base">→</span>
          </div>
        </button>

        <div className="my-[22px] mb-4 flex items-center gap-3.5">
          <span className="h-px flex-1 bg-line" />
          <Label>or pick one metro</Label>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-px overflow-hidden rounded-[2px] border border-line bg-line">
          {metros.map((m) => (
            <button
              key={m.slug}
              onClick={() => runSearch(m.slug)}
              className="flex min-h-[132px] cursor-pointer flex-col gap-[9px] bg-card p-6 text-left transition-colors hover:bg-paper-2"
            >
              <Label>{m.state ?? "—"}</Label>
              <span className="font-display text-[27px] font-[420] leading-[1.05] tracking-display text-ink">
                {m.name}
              </span>
              <span className="mt-auto flex justify-end font-mono text-sm text-accent">→</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------- SEARCHING */
  if (screen === "searching") {
    const steps = [
      "Embedding your image · CLIP ViT-B/32",
      `Comparing against portfolio images · ${metroName(metroSlug)}`,
      "Ranking artists by cosine similarity",
    ];
    return (
      <div className="grid min-h-[70vh] place-items-center py-6">
        <div className="w-full max-w-[380px] text-center">
          <div className="relative mx-auto mb-[30px] w-[188px]">
            <RefPlate src={previewUrl} ratio="4/5" />
            <div className="tt-scan pointer-events-none absolute inset-0 overflow-hidden rounded-[1px]">
              <div className="absolute inset-x-0 h-[70px] bg-gradient-to-b from-transparent via-accent/30 to-transparent" />
            </div>
          </div>
          <Label>searching · {metroName(metroSlug)}</Label>
          <div className="mt-[18px] flex flex-col gap-[11px]">
            {steps.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 text-left transition-opacity duration-300"
                style={{ opacity: idx <= step ? 1 : 0.32 }}
              >
                <span
                  className={[
                    "grid size-3.5 shrink-0 place-items-center rounded-full",
                    idx < step ? "bg-accent" : "border-[1.5px] border-ink-faint",
                  ].join(" ")}
                >
                  {idx < step && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--color-paper)" strokeWidth="4">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  {idx === step && (
                    <span className="tt-pulse size-[5px] rounded-full bg-accent" />
                  )}
                </span>
                <span className="font-mono text-[12.5px] text-ink">{s}</span>
              </div>
            ))}
          </div>
          {detail && <div className="mt-4 font-mono text-[11px] text-ink-faint">{detail}</div>}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- RESULTS */
  return (
    <div className="py-[clamp(20px,4vw,44px)]">
      {/* context bar */}
      <div className="flex flex-wrap items-center gap-[18px] rounded-[2px] border border-line bg-paper-2 px-5 py-4">
        {previewUrl && (
          <div className="w-[58px]">
            <RefPlate src={previewUrl} ratio="1/1" />
          </div>
        )}
        <div className="min-w-[200px] flex-1">
          <Label>your reference</Label>
          <div className="mt-1 text-[15px] text-ink">
            Ranked by visual similarity to your image
          </div>
        </div>
        <button
          onClick={() => setScreen("metro")}
          className="cursor-pointer font-mono text-[11.5px] tracking-[0.04em] text-ink-soft"
        >
          ↺ change metro
        </button>
        <button onClick={reset} className={btnGhostSm}>
          New search
        </button>
      </div>

      <div className="mt-6 mb-2">
        <Label>
          {metroName(metroSlug)} · {results.length} artist{results.length === 1 ? "" : "s"}
        </Label>
      </div>

      <SearchResults results={results} />
    </div>
  );
}
