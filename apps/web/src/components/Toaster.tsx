"use client";

import { dismissToast, useToasts } from "@/lib/toast";

/* Renders the active toasts bottom-right, stacked. Mounted once in the root layout. Each toast
   slides in, auto-dismisses (see lib/toast.ts), and can be clicked away early. Styling follows the
   mono/paper/ink design system; errors get a red accent bar. */
export default function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={`tt-toast-in pointer-events-auto flex items-start gap-2.5 rounded-[2px] border bg-paper px-3.5 py-2.5 text-left font-mono text-[12.5px] leading-[1.45] shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.99] ${
            t.kind === "error"
              ? "border-red-600/40 text-ink"
              : t.kind === "success"
                ? "border-line-strong text-ink"
                : "border-line text-ink-soft"
          }`}
        >
          <span
            aria-hidden
            className={`mt-[1px] size-[7px] shrink-0 rounded-full ${
              t.kind === "error" ? "bg-red-600" : t.kind === "success" ? "bg-accent" : "bg-ink-faint"
            }`}
          />
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
