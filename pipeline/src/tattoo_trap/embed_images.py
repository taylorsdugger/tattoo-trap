"""Stage 3 — download candidate portfolio images, embed them, and store thumbnails.

For each `portfolio_images` row with no embedding: download the source image, embed it with
CLIP (full resolution), upload a downscaled JPEG thumbnail to Supabase Storage, and write the
embedding + dimensions back to the row.

Run:
    python -m tattoo_trap.embed_images --metro chicago
"""

from __future__ import annotations

import argparse
import hashlib
import io

import httpx
from PIL import Image, UnidentifiedImageError

from . import config, db
from .embedder import get_embedder


def _download(url: str) -> bytes | None:
    try:
        resp = httpx.get(
            url,
            timeout=config.REQUEST_TIMEOUT_S,
            follow_redirects=True,
            headers={"User-Agent": config.USER_AGENT},
        )
        resp.raise_for_status()
        return resp.content
    except Exception as exc:  # noqa: BLE001
        print(f"    ! download failed {url}: {exc}")
        return None


def _make_thumbnail(image: Image.Image) -> bytes:
    thumb = image.convert("RGB").copy()
    thumb.thumbnail((config.THUMB_MAX, config.THUMB_MAX))
    buf = io.BytesIO()
    thumb.save(buf, format="JPEG", quality=80, optimize=True)
    return buf.getvalue()


def _storage_path(artist_id: int, url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return f"{artist_id}/{digest}.jpg"


def embed_metro(metro_slug: str) -> None:
    metro = db.get_metro_by_slug(metro_slug)
    if not metro:
        raise SystemExit(f"Metro '{metro_slug}' not found. Seed it first.")

    shops = db.shops_for_metro(metro["id"])
    artists = db.artists_for_shops([s["id"] for s in shops])
    artist_ids = [a["id"] for a in artists]
    rows = db.unembedded_images_for_artists(artist_ids)
    print(f"Embedding {len(rows)} image(s) across {len(artists)} artist(s) in '{metro_slug}'...")

    embedder = get_embedder()
    done = 0
    for row in rows:
        url = row["source_url"]
        data = _download(url)
        if not data:
            continue
        try:
            image = Image.open(io.BytesIO(data))
            image.load()
        except (UnidentifiedImageError, OSError) as exc:
            print(f"    ! not an image {url}: {exc}")
            continue

        width, height = image.size
        if width < 64 or height < 64:  # skip icons/spacers that slipped through
            continue

        vec = embedder.embed(image)
        path = _storage_path(row["artist_id"], url)
        try:
            db.upload_thumbnail(path, _make_thumbnail(image))
        except Exception as exc:  # noqa: BLE001
            print(f"    ! thumbnail upload failed {url}: {exc}")
            continue

        db.set_image_embedding(
            row["id"],
            storage_path=path,
            width=width,
            height=height,
            embedding=vec,
            model=config.EMBED_MODEL,
        )
        done += 1
        if done % 10 == 0:
            print(f"    embedded {done}/{len(rows)}")

    print(f"Done. Embedded {done} image(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download + embed candidate portfolio images.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    args = parser.parse_args()
    embed_metro(args.metro)


if __name__ == "__main__":
    main()
