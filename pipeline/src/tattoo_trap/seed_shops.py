"""Stage 1 — seed shops for a metro.

Two sources, combinable via --source:
  - csv    : a hand-curated CSV at seeds/<metro>.csv with columns
             name, address, website, instagram_handle, lat, lng  (free, default)
  - places : Google Places API (New) Text Search, biased to the metro center.
             Requires GOOGLE_PLACES_API_KEY. Cost is capped in config
             (PLACES_MAX_PAGES_PER_METRO / PLACES_MAX_RESULTS_PER_METRO).

Both sources upsert into `shops` and dedupe by google_place_id then (metro_id, name), so
running csv then places (or --source both) reconciles instead of duplicating.

Run:
    python -m tattoo_trap.seed_shops --metro chicago                 # csv (default)
    python -m tattoo_trap.seed_shops --metro chicago --source places
    python -m tattoo_trap.seed_shops --metro chicago --source both
"""

from __future__ import annotations

import argparse
import csv

from . import config, db, places


def _f(val: str | None) -> float | None:
    try:
        return float(val) if val not in (None, "") else None
    except ValueError:
        return None


def seed_from_csv(metro: dict) -> int:
    csv_path = config.SEEDS_DIR / f"{metro['slug']}.csv"
    if not csv_path.exists():
        raise SystemExit(f"Seed file not found: {csv_path}")

    count = 0
    with csv_path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            db.upsert_shop(
                metro_id=metro["id"],
                name=name,
                address=(row.get("address") or "").strip() or None,
                website=(row.get("website") or "").strip() or None,
                instagram_handle=(row.get("instagram_handle") or "").strip() or None,
                lat=_f(row.get("lat")),
                lng=_f(row.get("lng")),
                source="csv",
            )
            count += 1
    return count


def seed_from_places(metro: dict) -> int:
    if metro.get("lat") is None or metro.get("lng") is None:
        raise SystemExit(
            f"Metro '{metro['slug']}' has no lat/lng; cannot bias a Places search."
        )

    found = places.search_tattoo_shops(lat=metro["lat"], lng=metro["lng"])
    _upsert_places(metro, found)
    return len(found)


# Places pads result pages with adjacent businesses (med spas, piercing-only studios, laser
# removal, even coffee shops). Skip names that match a junk category — unless the name also
# says tattoo, which marks a legit dual shop ("X Tattoo & Piercing").
NON_TATTOO_NAME_KEYWORDS = (
    # food / drink
    "coffee", "ice cream", "pizza", "subs", "cafe", "bakery", "restaurant", "taproom", "brew",
    # beauty / spa / hair
    "lash", "brow", "salon", "med spa", "medical spa", "aesthetics", "laseraway",
    "hair restoration", "nails", "waxing", "facial", "skincare", "microblading",
    "permanent makeup", "massage", "barber",
    # removal services
    "removery", "laser removal", "tattoo removal",
    # smoke shops
    "smoke", "vape", "dispensary", "cbd",
    # piercing-only
    "piercing",
)
TATTOO_NAME_WORDS = ("tattoo", "ink", "tat2", "tatu", "needle", "electric")


def is_tattoo_shop_name(name: str) -> bool:
    low = name.lower()
    if any(w in low for w in TATTOO_NAME_WORDS) and "removal" not in low:
        return True
    return not any(k in low for k in NON_TATTOO_NAME_KEYWORDS)


def _upsert_places(metro: dict, found: list) -> None:
    for p in found:
        if not is_tattoo_shop_name(p.name):
            print(f"    · skipped non-tattoo business: {p.name}")
            continue
        db.upsert_shop(
            metro_id=metro["id"],
            name=p.name,
            address=p.address,
            website=p.website,
            lat=p.lat,
            lng=p.lng,
            google_place_id=p.place_id,
            source="places",
        )


def seed_from_areas(metro: dict) -> int:
    """One Places search per sub-area in seeds/<metro>-areas.csv (name, lat, lng[, radius_m]).

    Text Search caps at ~60 results per query, so a single metro-center search undercounts a
    large metro no matter the radius. Searching per suburb/neighborhood — with the locality in
    the query text — gets depth; upsert_shop's place_id dedupe makes overlapping circles safe.
    Cost is bounded: each area is its own search capped at PLACES_MAX_PAGES_PER_METRO requests.
    """
    areas_path = config.SEEDS_DIR / f"{metro['slug']}-areas.csv"
    if not areas_path.exists():
        raise SystemExit(f"Areas file not found: {areas_path}")

    total = 0
    with areas_path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip()
            lat, lng = _f(row.get("lat")), _f(row.get("lng"))
            if not name or lat is None or lng is None:
                continue
            found = places.search_tattoo_shops(
                lat=lat,
                lng=lng,
                text_query=f"tattoo shop in {name}",
                radius_m=_f(row.get("radius_m")) or 8000.0,
            )
            _upsert_places(metro, found)
            print(f"  {name}: {len(found)} shop(s)")
            total += len(found)
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed tattoo shops for a metro.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    parser.add_argument(
        "--source",
        choices=("csv", "places", "both", "areas"),
        default="csv",
        help="where to seed shops from (default: csv); 'areas' searches per sub-area "
        "from seeds/<metro>-areas.csv for broad-metro coverage",
    )
    args = parser.parse_args()

    metro = db.get_metro_by_slug(args.metro)
    if not metro:
        raise SystemExit(
            f"Metro '{args.metro}' not found. Apply supabase/migrations/0004_seed_metros.sql first."
        )

    if args.source in ("csv", "both"):
        n = seed_from_csv(metro)
        print(f"Seeded {n} shop(s) from CSV for '{args.metro}'.")
    if args.source in ("places", "both"):
        n = seed_from_places(metro)
        print(f"Seeded/reconciled {n} shop(s) from Google Places for '{args.metro}'.")
    if args.source == "areas":
        n = seed_from_areas(metro)
        print(f"Seeded/reconciled {n} shop(s) across sub-areas for '{args.metro}'.")


if __name__ == "__main__":
    main()
