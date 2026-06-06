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
    for p in found:
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
    return len(found)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed tattoo shops for a metro.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    parser.add_argument(
        "--source",
        choices=("csv", "places", "both"),
        default="csv",
        help="where to seed shops from (default: csv)",
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


if __name__ == "__main__":
    main()
