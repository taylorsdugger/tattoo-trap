import type { ReactNode } from "react";

/* Shared atoms from the design system (designs/src/screens.jsx + plates.jsx). */

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono text-[10.5px] font-medium uppercase tracking-label text-ink-faint ${className}`}
    >
      {children}
    </span>
  );
}

/* Tiny inline spinner for pending/optimistic UI. Sizes to the current font via em. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`h-[1em] w-[1em] animate-spin ${className}`}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Meter({ v }: { v: number }) {
  return (
    <div className="h-1 w-[54px] overflow-hidden rounded-full bg-line">
      <div className="h-full bg-accent" style={{ width: `${Math.round(v * 100)}%` }} />
    </div>
  );
}

/* Button styles — mono uppercase, ink-on-paper or outlined. */
const btnBase =
  "cursor-pointer whitespace-nowrap rounded-[2px] border font-mono text-xs uppercase tracking-[0.06em] transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:active:scale-100";
export const btnPrimary = `${btnBase} border-ink bg-ink px-5 py-[11px] text-paper`;
export const btnGhost = `${btnBase} border-line-strong bg-transparent px-5 py-[11px] text-ink hover:border-ink`;
export const btnGhostSm = `${btnBase} border-line-strong bg-transparent px-3.5 py-2 text-[11px] text-ink hover:border-ink`;

/* The user's uploaded reference image (or a placeholder prompting upload). */
export function RefPlate({
  src,
  ratio = "4/5",
  className = "",
}: {
  src: string | null;
  ratio?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div
        style={{ aspectRatio: ratio }}
        className={`relative overflow-hidden rounded-[1px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10)] ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="your reference" className="block h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      style={{ aspectRatio: ratio }}
      className={`grid place-items-center rounded-[1px] bg-paper-2 shadow-[inset_0_0_0_1px_var(--color-line)] ${className}`}
    >
      <span className="font-mono text-[11px] text-ink-faint">your reference</span>
    </div>
  );
}
