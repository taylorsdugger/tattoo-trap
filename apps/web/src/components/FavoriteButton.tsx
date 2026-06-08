"use client";

import { toggleFavorite, useIsFavorite } from "@/lib/favorites";
import { btnGhost } from "./ui";

/* Heart toggle for saving an artist. `icon` is the quiet card-corner variant;
   `button` matches the outlined mono buttons (artist page header). Favorites are user-owned;
   clicking while logged out prompts Google sign-in (handled in toggleFavorite). */
export default function FavoriteButton({
  artistId,
  name,
  variant = "icon",
  className = "",
}: {
  artistId: number;
  name: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  const fav = useIsFavorite(artistId);
  const label = fav ? `Remove ${name} from favorites` : `Save ${name} to favorites`;

  const onClick = (e: React.MouseEvent) => {
    // Cards navigate on click — keep the toggle from triggering that.
    e.stopPropagation();
    e.preventDefault();
    void toggleFavorite(artistId);
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={fav}
        aria-label={label}
        className={`${btnGhost} ${className}`}
      >
        <span aria-hidden className="mr-1.5">
          {fav ? "♥" : "♡"}
        </span>
        {fav ? "saved" : "save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={fav}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[1px] border text-[19px] leading-none transition-[color,border-color,transform] duration-150 active:scale-90 ${
        fav ? "border-ink text-ink" : "border-line text-ink-faint hover:border-ink hover:text-ink"
      } ${className}`}
    >
      <span aria-hidden>{fav ? "♥" : "♡"}</span>
    </button>
  );
}
