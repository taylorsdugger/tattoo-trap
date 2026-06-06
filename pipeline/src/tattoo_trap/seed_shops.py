"""Stage 1 — seed shops for a metro.

Primary source: a hand-curated CSV at seeds/<metro>.csv with columns:
    name, address, website, instagram_handle, lat, lng

Run:
    python -m tattoo_trap.seed_shops --metro chicago
"""

from __future__ import annotations

import argparse
import csv

from . import config, db


def _f(val: str | None) -> float | None:
    try:
        return float(val) if val not in (None, "") else None
    except ValueError:
        return None


def seed_from_csv(metro_slug: str) -> int:
    metro = db.get_metro_by_slug(metro_slug)
    if not metro:
        raise SystemExit(
            f"Metro '{metro_slug}' not found. Apply supabase/migrations/0004_seed_metros.sql first."
        )

    csv_path = config.SEEDS_DIR / f"{metro_slug}.csv"
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed tattoo shops for a metro from CSV.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    args = parser.parse_args()

    n = seed_from_csv(args.metro)
    print(f"Seeded {n} shop(s) for '{args.metro}'.")


if __name__ == "__main__":
    main()
