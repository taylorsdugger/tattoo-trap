import { displayImage } from "@/lib/images";
import type { PortfolioImage } from "@/lib/types";

export default function PortfolioGrid({ images }: { images: PortfolioImage[] }) {
  if (images.length === 0) {
    return <p className="text-sm text-neutral-500">No portfolio images yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {images.map((img) => {
        const src = displayImage(img.storage_path, img.source_url);
        if (!src) return null;
        return (
          <div key={img.id} className="aspect-square overflow-hidden rounded-lg bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        );
      })}
    </div>
  );
}
