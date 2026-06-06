"use client";

import { useRef, useState } from "react";

export default function ImageDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) pick(e.dataTransfer.files);
      }}
      className={[
        "cursor-pointer rounded-lg border-[1.5px] border-dashed px-6 py-[clamp(34px,6vw,56px)] text-center transition-all",
        dragOver ? "border-ink bg-card" : "border-line-strong bg-transparent",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
        disabled={disabled}
      />
      <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full border border-line-strong text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      </div>
      <div className="text-base font-medium text-ink">Drag an image here, or click to browse</div>
      <div className="mt-2 font-mono text-[11px] tracking-[0.03em] text-ink-faint">
        jpg / png / heic · stays on your device
      </div>
    </div>
  );
}
