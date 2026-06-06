"use client";

import type { Metro } from "@/lib/types";

export default function MetroPicker({
  metros,
  value,
  onChange,
  disabled,
}: {
  metros: Metro[];
  value: string | null;
  onChange: (slug: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-400">Near</span>
      <select
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-neutral-100 disabled:opacity-50"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {metros.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}
            {m.state ? `, ${m.state}` : ""}
          </option>
        ))}
        <option value="">All metros</option>
      </select>
    </label>
  );
}
