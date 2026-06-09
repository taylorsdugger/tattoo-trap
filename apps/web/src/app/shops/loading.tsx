import { Label } from "@/components/ui";

/* Streamed instantly while the server component fetches shops and renders the
   directory. Mirrors the real page's layout so the swap is near-seamless. */
function ShopCardSkeleton() {
  return (
    <article className="grid gap-5 border-t border-line py-[clamp(28px,4vw,44px)] first:border-t-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:gap-4">
          <span className="w-6 pt-1 font-mono text-[13px] text-ink-faint sm:w-7 sm:pt-2">
            ··
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-7 w-1/2 rounded-[1px] bg-paper-2" />
            <div className="h-4 w-2/3 rounded-[1px] bg-paper-2" />
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="h-4 w-20 rounded-[1px] bg-paper-2" />
              <div className="h-4 w-24 rounded-[1px] bg-paper-2" />
              <div className="h-4 w-16 rounded-[1px] bg-paper-2" />
            </div>
          </div>
        </div>
        <div className="hidden flex-col items-end gap-1.5 pt-1 sm:flex">
          <div className="h-3 w-24 rounded-[1px] bg-paper-2" />
          <div className="h-3 w-20 rounded-[1px] bg-paper-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-[1px] bg-paper-2" />
        ))}
      </div>
    </article>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6 py-[clamp(28px,5vw,60px)]">
      <div>
        <Label>browse mode · loading</Label>
        <div className="mt-3 h-[clamp(30px,5vw,52px)] w-3/4 max-w-[420px] animate-pulse rounded-[1px] bg-paper-2" />
        <div className="mt-4 max-w-[560px] space-y-2">
          <div className="h-4 w-full animate-pulse rounded-[1px] bg-paper-2" />
          <div className="h-4 w-4/5 animate-pulse rounded-[1px] bg-paper-2" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded-full bg-paper-2"
            style={{ width: `${64 + ((i * 23) % 56)}px` }}
          />
        ))}
      </div>

      <div className="h-10 w-full animate-pulse rounded-[1px] bg-paper-2" />

      <div className="animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShopCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
