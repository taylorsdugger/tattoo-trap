"""Stage 2b — source portfolio images from artists' public Instagram posts.

For each artist with an Instagram handle, fetch recent post image URLs from a paid scraper and
store them as `portfolio_images` candidates (same rows the shop-site crawler produces). The
embed stage then downloads, content-gates, thumbnails and embeds them — no changes there.

Instagram is where tattoo artists post their best, current work, so these images make both
browsing and visual search markedly better than sparse shop-site photos.

Important: IG CDN URLs are signed and expire within hours, and `embed_images` drops any row
whose URL 404s. So run embed right after scraping — `make pipeline-ig` chains the two. Once
embedded, the thumbnail lives in Storage and the dead URL no longer matters.

Spend is bounded at the free monthly credit; see `image_sources.ApifyInstagramSource` and the
Apify console spend limit (config). Run:

    python -m tattoo_trap.scrape_instagram --metro chicago            # backfill
    python -m tattoo_trap.scrape_instagram --metro chicago --probe    # 4 handles, print, no writes
"""

from __future__ import annotations

import argparse

from . import config, db
from .image_sources import (
    ApifyInstagramSource,
    BudgetExceeded,
    ImageSource,
    normalize_handle,
)


def _artists_with_handles(metro_slug: str) -> list[dict]:
    metro = db.get_metro_by_slug(metro_slug)
    if not metro:
        raise SystemExit(f"Metro '{metro_slug}' not found. Seed it first.")
    shops = db.shops_for_metro(metro["id"])
    artists = db.artists_for_shops([s["id"] for s in shops])
    out = []
    for a in artists:
        handle = normalize_handle(a.get("instagram_handle"))
        if handle:
            out.append({**a, "_handle": handle})
    return out


def _select_pending(
    metro_slug: str, *, rescrape: bool, order: str
) -> tuple[list[dict], int, int]:
    """Return (pending artists, skipped count, total-with-handles), gated and ordered.

    Gate (unless --rescrape): skip artists already attempted by the puller. "Attempted" =
    `ig_scraped_at` set (covers private/empty/404 handles that yielded nothing) OR already has
    IG images (backstop for artists scraped before the marker existed). Both are needed: the
    marker is authoritative going forward; the image check catches the pre-migration backlog.

    Order: 'thin' = fewest existing portfolio images first, so a budget-limited run spends on
    the artists who most need images; 'id' = stable insertion order.
    """
    artists = _artists_with_handles(metro_slug)
    total = len(artists)
    ids = [a["id"] for a in artists]

    skipped = 0
    if not rescrape:
        done = db.ig_scraped_artist_ids(ids) | db.artists_with_instagram_images(ids)
        artists = [a for a in artists if a["id"] not in done]
        skipped = total - len(artists)

    if order == "thin":
        counts = db.image_counts_for_artists([a["id"] for a in artists])
        artists.sort(key=lambda a: (counts.get(a["id"], 0), a["id"]))
    else:
        artists.sort(key=lambda a: a["id"])
    return artists, skipped, total


def print_count(metro_slug: str, *, rescrape: bool, order: str, limit: int) -> None:
    """Report scrape scope + a rough cycle estimate. NO Apify calls — free, read-only."""
    pending, skipped, total = _select_pending(metro_slug, rescrape=rescrape, order=order)
    est_per_cycle = max(1, int(config.IG_MONTHLY_BUDGET_USD / config.IG_EST_COST_PER_ARTIST_USD))
    cycles = (len(pending) + est_per_cycle - 1) // est_per_cycle
    est_cost = len(pending) * config.IG_EST_COST_PER_ARTIST_USD
    print(f"'{metro_slug}': {total} artist(s) with IG handles")
    print(f"  already attempted (skipped): {skipped}")
    print(f"  pending this metro:          {len(pending)}")
    print(f"  ~free coverage per cycle:    ~{est_per_cycle} artists (${config.IG_MONTHLY_BUDGET_USD:.2f} guard)")
    print(f"  ~cycles to finish:           {cycles}  (or ~${est_cost:.2f} one-time if you raise the cap)")
    print("  (estimate only — real spend is metered live from the Apify API)")


def scrape_metro(
    metro_slug: str,
    *,
    sources: list[ImageSource],
    limit: int,
    probe: int = 0,
    rescrape: bool = False,
    order: str = "thin",
) -> None:
    if probe:
        artists = _artists_with_handles(metro_slug)[:probe]
        skipped = 0
    else:
        artists, skipped, _ = _select_pending(metro_slug, rescrape=rescrape, order=order)

    print(
        f"{'PROBE — ' if probe else ''}Scraping IG for {len(artists)} artist(s) "
        f"with handles in '{metro_slug}' (≤{limit} images each, order={order})"
        f"{f'; skipped {skipped} already-attempted' if skipped else ''}..."
    )

    src_idx = 0
    stored = total_images = 0
    for i, artist in enumerate(artists):
        handle = artist["_handle"]

        # Advance through the source tier as each metered source hits its spend guard.
        while src_idx < len(sources):
            try:
                sources[src_idx].ensure_budget()
                break
            except BudgetExceeded as exc:
                remaining = len(artists) - i
                print(
                    f"  · {sources[src_idx].name} budget reached ({exc}); "
                    f"{remaining} artist(s) not yet covered."
                )
                src_idx += 1
        if src_idx >= len(sources):
            print("  No source left within budget — stopping. Re-run after the credit resets.")
            break

        source = sources[src_idx]
        try:
            candidates = source.fetch(handle, limit)
        except Exception as exc:  # noqa: BLE001 — one bad handle shouldn't kill the run
            # Transient (network/5xx): do NOT mark, so it retries next run.
            print(f"  ! {source.name} fetch failed for @{handle}: {exc}")
            continue

        if probe:
            print(f"  @{handle}: {len(candidates)} image(s)")
            for c in candidates:
                print(f"      {c.url}")
            total_images += len(candidates)
            continue

        for c in candidates:
            db.add_candidate_image(artist["id"], c.url)
        # Mark attempted on every successful fetch — including an EMPTY result (private/no posts)
        # — so a dead handle isn't re-billed every run. Only transient errors above stay pending.
        db.mark_ig_scraped(artist["id"])
        stored += 1
        total_images += len(candidates)
        print(f"  @{handle}: stored {len(candidates)} candidate(s) [{source.name}]")

    if probe:
        print(f"PROBE done. {total_images} image URL(s) across {len(artists)} handle(s). No DB writes.")
    else:
        print(f"Done. {total_images} candidate image(s) across {stored} artist(s). Run embed next.")


def print_status() -> None:
    """Report Apify month-to-date spend vs. the enforced cap. Read-only, costs nothing."""
    source = ApifyInstagramSource(config.APIFY_TOKEN)
    spent, account_max = source.account_limits()
    cap = source.effective_cap_usd()
    print(f"Apify month-to-date spend: ${spent:.2f}")
    print(f"  account max monthly spend: {'$%.2f' % account_max if account_max else 'UNSET ⚠'}")
    print(f"  in-stage guard:            ${config.IG_MONTHLY_BUDGET_USD:.2f}")
    print(f"  enforced cap (lower of):   ${cap:.2f}")
    remaining = max(0.0, cap - spent)
    if spent >= cap:
        print(f"OVER cap — scraping would stop immediately. ${spent:.2f} ≥ ${cap:.2f}.")
    else:
        print(f"OK — ${remaining:.2f} of budget left this cycle.")
    if account_max is None:
        print(
            "  ⚠ No console spend limit set. Set one at "
            "https://console.apify.com/account/limits (recommend $5) as the hard backstop."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Source portfolio images from Instagram.")
    parser.add_argument("--metro", help="metro slug, e.g. chicago (not needed with --status)")
    parser.add_argument(
        "--status",
        action="store_true",
        help="print Apify spend vs. cap and exit (read-only, free)",
    )
    parser.add_argument(
        "--count",
        action="store_true",
        help="print how many artists would be scraped + cycle estimate, then exit (no Apify calls)",
    )
    parser.add_argument(
        "--order",
        choices=("thin", "id"),
        default="thin",
        help="scrape order: 'thin' = fewest existing images first (default), 'id' = insertion order",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=config.MAX_IMAGES_PER_ARTIST,
        help=f"max images per artist (default {config.MAX_IMAGES_PER_ARTIST})",
    )
    parser.add_argument(
        "--probe",
        nargs="?",
        type=int,
        const=4,
        default=0,
        help="quality check: fetch N handles (default 4), print URLs, write nothing",
    )
    parser.add_argument(
        "--rescrape",
        action="store_true",
        help="re-scrape artists who already have IG images (refresh; off by default to avoid duplicates)",
    )
    args = parser.parse_args()

    if args.status:
        print_status()
        return
    if not args.metro:
        parser.error("--metro is required (unless using --status)")
    if args.count:
        print_count(args.metro, rescrape=args.rescrape, order=args.order, limit=args.limit)
        return

    # Source tier. Apify first; append a RapidAPI source here later to cover artists left over
    # once the Apify free credit is spent — the stage falls through to it automatically.
    sources: list[ImageSource] = [ApifyInstagramSource(config.APIFY_TOKEN)]

    scrape_metro(
        args.metro,
        sources=sources,
        limit=args.limit,
        probe=args.probe,
        rescrape=args.rescrape,
        order=args.order,
    )


if __name__ == "__main__":
    main()
