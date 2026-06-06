import { displayImage } from "@/lib/images";
import type { PortfolioImage } from "@/lib/types";

export default function PortfolioGrid({ images }: { images: PortfolioImage[] }) {
  if (images.length === 0) {
    return <p className="text-sm text-ink-soft">No portfolio images yet.</p>;
  }
  // Masonry-style columns, per the design's artist-detail portfolio.
  return (
    <div className="gap-3.5 columns-[240px]">
      {images.map((img) => {
        const src = displayImage(img.storage_path, img.source_url);
        if (!src) return null;
        return (
          <div
            key={img.id}
            className="mb-3.5 break-inside-avoid overflow-hidden rounded-[1px] bg-paper-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block w-full" loading="lazy" />
          </div>
        );
      })}
    </div>
  );
}
