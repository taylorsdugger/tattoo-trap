"""Supabase data-access helpers (service-role).

Thin wrappers around supabase-py for the upserts the pipeline needs. Embeddings are written
as pgvector string literals (e.g. "[0.1,0.2,...]"), which pgvector parses on insert.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any, Iterable, Optional

import numpy as np
from supabase import Client, create_client

from . import config


@lru_cache(maxsize=1)
def client() -> Client:
    config.require_supabase_env()
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or "unknown"


def vector_literal(vec: np.ndarray) -> str:
    """Format a numpy vector as a pgvector text literal."""
    return "[" + ",".join(f"{float(x):.6f}" for x in vec.tolist()) + "]"


# --- metros ----------------------------------------------------------------------------

def get_metro_by_slug(slug: str) -> Optional[dict[str, Any]]:
    res = client().table("metros").select("*").eq("slug", slug).limit(1).execute()
    return res.data[0] if res.data else None


# --- shops -----------------------------------------------------------------------------

def upsert_shop(
    *,
    metro_id: int,
    name: str,
    address: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    website: Optional[str] = None,
    instagram_handle: Optional[str] = None,
    google_place_id: Optional[str] = None,
    source: str = "csv",
) -> dict[str, Any]:
    """Insert a shop, or fetch the existing one.

    Dedupe order: google_place_id (stable across name/source variations) first, then
    (metro_id, name). This lets a Places run reconcile with a CSV-seeded shop instead of
    creating a duplicate.
    """
    if google_place_id:
        by_place = (
            client()
            .table("shops")
            .select("*")
            .eq("google_place_id", google_place_id)
            .limit(1)
            .execute()
        )
        if by_place.data:
            return by_place.data[0]

    existing = (
        client()
        .table("shops")
        .select("*")
        .eq("metro_id", metro_id)
        .eq("name", name)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    row = {
        "metro_id": metro_id,
        "name": name,
        "address": address,
        "lat": lat,
        "lng": lng,
        "website": website,
        "instagram_handle": instagram_handle,
        "google_place_id": google_place_id,
        "source": source,
    }
    res = client().table("shops").insert(row).execute()
    return res.data[0]


def shops_for_metro(metro_id: int) -> list[dict[str, Any]]:
    res = client().table("shops").select("*").eq("metro_id", metro_id).execute()
    return res.data or []


# --- artists ---------------------------------------------------------------------------

def upsert_artist(
    *,
    shop_id: int,
    name: str,
    slug: str,
    instagram_handle: Optional[str] = None,
    bio: Optional[str] = None,
    profile_url: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> dict[str, Any]:
    existing = client().table("artists").select("*").eq("slug", slug).limit(1).execute()
    if existing.data:
        return existing.data[0]
    row = {
        "shop_id": shop_id,
        "name": name,
        "slug": slug,
        "instagram_handle": instagram_handle,
        "bio": bio,
        "profile_url": profile_url,
        "avatar_url": avatar_url,
    }
    res = client().table("artists").insert(row).execute()
    return res.data[0]


def artists_for_shops(shop_ids: Iterable[int]) -> list[dict[str, Any]]:
    ids = list(shop_ids)
    if not ids:
        return []
    res = client().table("artists").select("*").in_("shop_id", ids).execute()
    return res.data or []


def mark_ig_scraped(artist_id: int) -> None:
    """Stamp an artist as IG-attempted (success OR empty) so dead handles aren't re-billed."""
    client().table("artists").update({"ig_scraped_at": "now()"}).eq("id", artist_id).execute()


def ig_scraped_artist_ids(artist_ids: Iterable[int]) -> set[int]:
    """Subset of `artist_ids` already attempted by the IG puller (ig_scraped_at is set)."""
    ids = list(artist_ids)
    if not ids:
        return set()
    res = (
        client()
        .table("artists")
        .select("id")
        .in_("id", ids)
        .not_.is_("ig_scraped_at", "null")
        .execute()
    )
    return {row["id"] for row in (res.data or [])}


def image_counts_for_artists(artist_ids: Iterable[int]) -> dict[int, int]:
    """Map artist_id -> number of portfolio_images, for 'thinnest first' scrape ordering."""
    ids = list(artist_ids)
    if not ids:
        return {}
    res = client().table("portfolio_images").select("artist_id").in_("artist_id", ids).execute()
    counts: dict[int, int] = {}
    for row in res.data or []:
        counts[row["artist_id"]] = counts.get(row["artist_id"], 0) + 1
    return counts


# --- portfolio_images ------------------------------------------------------------------

def add_candidate_image(artist_id: int, source_url: str) -> None:
    """Insert a portfolio image URL with no embedding yet. Ignores duplicates."""
    try:
        client().table("portfolio_images").insert(
            {"artist_id": artist_id, "source_url": source_url}
        ).execute()
    except Exception as exc:  # noqa: BLE001 — unique violation on (artist_id, source_url)
        if "duplicate" not in str(exc).lower() and "23505" not in str(exc):
            raise


def artists_with_instagram_images(artist_ids: Iterable[int]) -> set[int]:
    """Subset of `artist_ids` that already have at least one IG-sourced portfolio image.

    IG CDN URLs are signed and change every scrape, so they can't be deduped by `source_url` —
    re-scraping an artist would create duplicate images/embeddings. Detect prior IG ingest by
    the CDN host (`cdninstagram`/`fbcdn`), which is retained in `source_url` after embedding,
    and skip those artists. `source_url` survives embedding, so this catches both pending and
    already-embedded IG rows."""
    ids = list(artist_ids)
    if not ids:
        return set()
    res = (
        client()
        .table("portfolio_images")
        .select("artist_id, source_url")
        .in_("artist_id", ids)
        .or_("source_url.ilike.%cdninstagram%,source_url.ilike.%fbcdn%")
        .execute()
    )
    return {row["artist_id"] for row in (res.data or [])}


def unembedded_images_for_artists(artist_ids: Iterable[int]) -> list[dict[str, Any]]:
    ids = list(artist_ids)
    if not ids:
        return []
    res = (
        client()
        .table("portfolio_images")
        .select("*")
        .in_("artist_id", ids)
        .is_("embedding", "null")
        .execute()
    )
    return res.data or []


def set_image_embedding(
    image_id: int,
    *,
    storage_path: str,
    width: int,
    height: int,
    embedding: np.ndarray,
    model: str,
) -> None:
    client().table("portfolio_images").update(
        {
            "storage_path": storage_path,
            "width": width,
            "height": height,
            "embedding": vector_literal(embedding),
            "embedding_model": model,
        }
    ).eq("id", image_id).execute()


def delete_image(image_id: int) -> None:
    """Remove a candidate image row (dead URL, undecodable, too small, or non-tattoo)."""
    client().table("portfolio_images").delete().eq("id", image_id).execute()


# --- storage ---------------------------------------------------------------------------

def upload_thumbnail(path: str, data: bytes) -> None:
    """Upload a JPEG thumbnail to the portfolios bucket (overwrites if present)."""
    client().storage.from_(config.STORAGE_BUCKET).upload(
        path,
        data,
        {"content-type": "image/jpeg", "upsert": "true"},
    )
