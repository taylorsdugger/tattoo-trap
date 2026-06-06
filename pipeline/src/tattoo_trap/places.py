"""Google Places API (New, v1) client — tattoo-shop discovery for seeding.

Wraps the Text Search endpoint:
    POST https://places.googleapis.com/v1/places:searchText

We bias results to a circle around the metro's center (lat/lng from the `metros` table)
and page through results. Only the fields in FIELD_MASK are requested, so we pay for just
what we use. Instagram handles are NOT available from Places — those are filled in later by
the crawl stage; `instagram_handle` is left None here.

Requires GOOGLE_PLACES_API_KEY. Callers should skip this source when the key is blank.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from . import config

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# Field mask drives billing — request only what upsert_shop needs.
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.websiteUri",
        "nextPageToken",
    ]
)

PAGE_DELAY_S = 2.0  # nextPageToken needs a short moment to become valid


@dataclass(frozen=True)
class PlaceResult:
    place_id: str
    name: str
    address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    website: Optional[str]


def _parse_place(place: dict[str, Any]) -> Optional[PlaceResult]:
    place_id = place.get("id")
    name = (place.get("displayName") or {}).get("text")
    if not place_id or not name:
        return None
    loc = place.get("location") or {}
    return PlaceResult(
        place_id=place_id,
        name=name.strip(),
        address=(place.get("formattedAddress") or None),
        lat=loc.get("latitude"),
        lng=loc.get("longitude"),
        website=(place.get("websiteUri") or None),
    )


def search_tattoo_shops(
    *,
    lat: float,
    lng: float,
    text_query: str = "tattoo shop",
    radius_m: Optional[float] = None,
    max_pages: Optional[int] = None,
    max_results: Optional[int] = None,
) -> list[PlaceResult]:
    """Text Search for tattoo shops biased to a circle around (lat, lng).

    Cost is bounded by two caps (defaults from config): `max_pages` limits billable requests
    and `max_results` stops paging early once enough shops are collected. Returns
    de-duplicated PlaceResults (by place_id). Raises if the key is missing or the API returns
    a non-2xx response.
    """
    radius_m = config.PLACES_RADIUS_M if radius_m is None else radius_m
    max_pages = config.PLACES_MAX_PAGES_PER_METRO if max_pages is None else max_pages
    max_results = (
        config.PLACES_MAX_RESULTS_PER_METRO if max_results is None else max_results
    )
    if not config.GOOGLE_PLACES_API_KEY:
        raise SystemExit(
            "GOOGLE_PLACES_API_KEY is not set. Add it to pipeline/.env to use --source places."
        )

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body: dict[str, Any] = {
        "textQuery": text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_m,
            }
        },
    }

    results: dict[str, PlaceResult] = {}
    page_token: Optional[str] = None

    with httpx.Client(timeout=config.REQUEST_TIMEOUT_S) as http:
        for page in range(max_pages):
            if page_token:
                body["pageToken"] = page_token
                time.sleep(PAGE_DELAY_S)
            resp = http.post(SEARCH_URL, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

            for place in data.get("places", []):
                parsed = _parse_place(place)
                if parsed:
                    results[parsed.place_id] = parsed

            # Stop paging once we've hit the cost cap — don't request another page we'd discard.
            if len(results) >= max_results:
                break

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return list(results.values())[:max_results]
