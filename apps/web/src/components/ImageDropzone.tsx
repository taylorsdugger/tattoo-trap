"use client";

import { useRef, useState } from "react";

export default function ImageDropzone({
  onFile,
  disabled,
  previewUrl,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  previewUrl?: string | null;
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
        "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition",
        dragOver ? "border-rose-500 bg-rose-500/5" : "border-neutral-700 hover:border-neutral-500",
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
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Your inspiration"
          className="max-h-72 rounded-lg object-contain"
        />
      ) : (
        <>
          <div className="text-2xl">🖼️</div>
          <div className="font-medium">Drop a tattoo inspiration image</div>
          <div className="text-sm text-neutral-400">or click to upload — it never leaves your browser</div>
        </>
      )}
    </div>
  );
}
