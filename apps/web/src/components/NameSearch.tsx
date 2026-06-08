"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "./ui";

/* Debounced search-by-name box. Writes the query into the `q` URL param (preserving
   any active `metro` filter) so the server component can filter the list. */
export default function NameSearch({ placeholder = "Search by name…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();

  // Keep the input in sync when the URL changes from elsewhere (e.g. metro chips).
  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onChange = (next: string) => {
    setValue(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 250);
  };

  return (
    <div className="relative max-w-[360px]">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-[2px] border border-line-strong bg-transparent px-3 py-2 pr-9 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
      />
      {isPending && (
        <Spinner className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
      )}
    </div>
  );
}
