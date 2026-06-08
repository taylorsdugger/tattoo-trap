"""Backfill: remove already-crawled images whose URL is site branding, not a portfolio.

The crawler's `SKIP_IMG` filter (crawl_shops) drops logos, footers, "powered by" platform
badges, headshots and other chrome at ingest time. Rows scraped before that list was tightened
still carry the leaked branding. This re-applies the *current* filter to every stored
`source_url` and removes the ones it would now reject — deleting the row and its Storage
thumbnail. Imports `SKIP_IMG` directly so the two never drift.

Unlike prune_nontattoo_images (which scores CLIP vectors), this is a pure URL match: it catches
branding whether or not the image was ever embedded.

Safe by default: prints a plan and changes nothing. Apply with --apply.

    .venv/bin/python prune_branding_images.py             # dry-run plan (default)
    .venv/bin/python prune_branding_images.py --apply      # remove branding images + thumbs
"""

from __future__ import annotations

import argparse
from collections import defaultdict

from tattoo_trap import config, db
from tattoo_trap.crawl_shops import SKIP_IMG


def _branding_hit(source_url: str | None) -> str | None:
    """The SKIP_IMG token this URL trips on, or None if it's clean."""
    low = (source_url or "").lower()
    return next((bad for bad in SKIP_IMG if bad in low), None)


def _all_images(c) -> list[dict]:
    """Every portfolio_images row. PostgREST caps a single response at 1000, so page through
    with .range() — the table is several thousand rows and a single .execute() would silently
    scan only the first page."""
    out, page, size = [], 0, 1000
    while True:
        batch = (
            c.table("portfolio_images")
            .select("id,artist_id,source_url,storage_path")
            .order("id")
            .range(page * size, page * size + size - 1)
            .execute()
            .data
        )
        out.extend(batch)
        if len(batch) < size:
            return out
        page += 1


def main() -> None:
    ap = argparse.ArgumentParser(description="Prune leaked branding images by URL.")
    ap.add_argument("--apply", action="store_true", help="execute the removal (rows + thumbnails)")
    args = ap.parse_args()

    c = db.client()
    artists = {a["id"]: a["name"] for a in c.table("artists").select("id,name").execute().data}
    rows = _all_images(c)

    junk, kept_per_artist = [], defaultdict(int)
    for r in rows:
        hit = _branding_hit(r["source_url"])
        if hit:
            junk.append({**r, "hit": hit})
        else:
            kept_per_artist[r["artist_id"]] += 1

    print(f"Scanned {len(rows)} image(s); {len(junk)} match a branding token.\n")
    by_artist = defaultdict(list)
    for j in junk:
        by_artist[j["artist_id"]].append(j)
    for aid in sorted(by_artist, key=lambda i: artists.get(i, "")):
        name = artists.get(aid, f"artist {aid}")
        emptied = " ← 0 images left" if kept_per_artist[aid] == 0 else ""
        print(f"  {name[:34]:<34} drop {len(by_artist[aid])}, keep {kept_per_artist[aid]}{emptied}")
        for j in by_artist[aid]:
            fn = (j["source_url"] or "").split("/")[-1][:48]
            print(f"      [{j['hit']}]  {fn}")

    if not args.apply:
        print("\nDry run — nothing changed. Re-run with --apply to remove these.")
        return

    bucket = c.storage.from_(config.STORAGE_BUCKET)
    ids = [j["id"] for j in junk]
    paths = [j["storage_path"] for j in junk if j.get("storage_path")]
    for i in range(0, len(ids), 100):
        c.table("portfolio_images").delete().in_("id", ids[i:i + 100]).execute()
    for i in range(0, len(paths), 100):
        try:
            bucket.remove(paths[i:i + 100])
        except Exception as exc:  # noqa: BLE001 — storage cleanup is best-effort
            print(f"  ! storage remove failed for a batch: {exc!r}")
    print(f"\nRemoved {len(ids)} branding image(s) and {len(paths)} thumbnail(s).")


if __name__ == "__main__":
    main()
