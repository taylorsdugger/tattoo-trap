"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* Debounced search-by-name box. Writes the query into the `q` URL param (preserving
   any active `metro` filter) so the server component can filter the list. */
export default function NameSearch({ placeholder = "Search by name…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

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
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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
        className="w-full rounded-[2px] border border-line-strong bg-transparent px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
      />
    </div>
  );
}
