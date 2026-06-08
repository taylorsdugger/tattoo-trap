"""Real-browser fallback crawl for shops the polite bot UA couldn't read.

The main crawler identifies itself as `TattooTrapBot/0.1`. Most shop sites serve that fine,
but sites behind Cloudflare (and similar bot management) return an "Attention Required!"
challenge page instead of the real homepage. The crawler then sees zero artist links and falls
back to a single empty "house artist" (the shop's own name, 0 portfolio images) — e.g. 7 Day
Gallery Tattoo, whose /bob-gray/, /derrick-bourg/, … pages were never read.

Rather than make the *whole* crawl impersonate Chrome (rude to the sites that don't need it),
this script retries ONLY the shops that came back empty, using a real Chrome user-agent so the
challenge clears and the actual roster + on-site portfolio images load.

Candidate = a shop with a real (non-Instagram) website whose artists hold ZERO stored portfolio
images. That's the blocked signature; it also harmlessly re-tries shops that are genuinely empty.

Safe by default: prints the candidate list and crawls nothing. Add --run to actually re-crawl.

    .venv/bin/python recrawl_blocked.py                      # list candidates (all metros)
    .venv/bin/python recrawl_blocked.py --metro chicago      # list candidates in one metro
    .venv/bin/python recrawl_blocked.py --shop 270           # just one shop
    .venv/bin/python recrawl_blocked.py --run                # re-crawl all candidates
    .venv/bin/python recrawl_blocked.py --metro chicago --run --limit 25
"""

from __future__ import annotations

import argparse
from urllib.parse import urlparse

from tattoo_trap import db
from tattoo_trap.crawl_shops import REAL_CHROME_UA, _crawl_shops


def _has_real_website(shop: dict) -> bool:
    site = (shop.get("website") or "").strip()
    if not site:
        return False
    host = urlparse(site).netloc.lower().removeprefix("www.")
    # Instagram-only "sites" aren't crawlable (robots disallow); the IG scrape stage owns those.
    return host != "instagram.com"


def _candidate_shops(*, metro_slug: str | None, shop_id: int | None) -> list[dict]:
    """Shops with a crawlable website whose artists currently hold zero stored portfolio images."""
    c = db.client()

    if shop_id is not None:
        shop = db.get_shop(shop_id)
        shops = [shop] if shop else []
    elif metro_slug:
        metro = db.get_metro_by_slug(metro_slug)
        if not metro:
            raise SystemExit(f"Metro '{metro_slug}' not found.")
        shops = db.shops_for_metro(metro["id"])
    else:
        shops = c.table("shops").select("*").execute().data

    shops = [s for s in shops if _has_real_website(s)]
    if not shops:
        return []

    shop_ids = [s["id"] for s in shops]
    artists = db.artists_for_shops(shop_ids)  # [{id, shop_id, ...}]
    artist_to_shop = {a["id"]: a["shop_id"] for a in artists}
    if not artists:
        # No artists at all for these shops -> definitely never crawled successfully.
        return shops

    # Artist ids that already have at least one *stored* (downloaded) portfolio image.
    stored_rows = (
        c.table("portfolio_images")
        .select("artist_id")
        .not_.is_("storage_path", "null")
        .in_("artist_id", list(artist_to_shop.keys()))
        .execute()
        .data
    )
    shops_with_images = {artist_to_shop[r["artist_id"]] for r in stored_rows if r["artist_id"] in artist_to_shop}

    # Keep shops where NONE of their artists have a stored image.
    return [s for s in shops if s["id"] not in shops_with_images]


def main() -> None:
    parser = argparse.ArgumentParser(description="Real-browser fallback crawl for blocked shops.")
    parser.add_argument("--metro", help="limit to one metro slug, e.g. chicago")
    parser.add_argument("--shop", type=int, help="single shop id")
    parser.add_argument("--limit", type=int, help="cap the number of shops crawled")
    parser.add_argument("--run", action="store_true", help="actually re-crawl (default: list only)")
    args = parser.parse_args()

    candidates = _candidate_shops(metro_slug=args.metro, shop_id=args.shop)
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"{len(candidates)} candidate shop(s) with a website and 0 stored images:")
    for s in candidates:
        print(f"  #{s['id']:>4}  {s['name'][:42]:<42}  {s.get('website')}")

    if not candidates:
        return
    if not args.run:
        print("\n(dry-run; pass --run to re-crawl these with a real-browser UA)")
        return

    print(f"\nRe-crawling {len(candidates)} shop(s) with a real Chrome UA...\n")
    _crawl_shops(candidates, user_agent=REAL_CHROME_UA)


if __name__ == "__main__":
    main()
