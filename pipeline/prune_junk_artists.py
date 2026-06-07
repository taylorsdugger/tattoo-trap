"""Find (and optionally remove) junk "artists" the crawler ingested before hardening.

A junk artist is a row whose stored `profile_url` the *current* hardened crawler filter would
now reject (nav buttons, /services & /category pages, blog posts, account pages) — e.g.
"VIEW OUR SERVICES", "STYLE GUIDE", "Portrait Tattoos". Shop "house artists" (profile_url at
the site root) are never junk: they are the intended fallback and hold real portfolio images.

Three buckets are proposed:
  DELETE  — the page is not an artist; its images pollute the visual index. Removed entirely.
  RENAME  — the label is a real person name decorated with a domain word ("Amanda Shroom
            Tattoo"); rename to the bare name ("Amanda Shroom"), keep the images.
  REVIEW  — junk by URL, but holds a substantial embedded portfolio (>= REVIEW_MIN_EMBEDDED
            images), so it MIGHT be a real artist the crawler mislabeled (e.g. "Read Bio" whose
            page /michael is really Michael's portfolio). Never auto-changed — listed for you
            to delete or rename by hand.

Safe by default: prints a plan and changes nothing. Apply with explicit flags.

    .venv/bin/python prune_junk_artists.py                 # dry-run plan (default)
    .venv/bin/python prune_junk_artists.py --apply         # execute DELETEs (+ storage)
    .venv/bin/python prune_junk_artists.py --apply-renames # execute RENAMEs only
    .venv/bin/python prune_junk_artists.py --apply --apply-renames
"""

from __future__ import annotations

import argparse
import re
from urllib.parse import urlparse

from tattoo_trap import db
from tattoo_trap.crawl_shops import NON_NAME_WORDS, _is_person_name, _looks_like_artist_link

# Rows the URL says are junk but which carry at least this many embedded portfolio images go to
# REVIEW (a human looks) rather than DELETE — they're the ones most likely to be a real artist.
REVIEW_MIN_EMBEDDED = 10
# Domain words that decorate a real artist's label ("Amanda Shroom Tattoo"). Stripped from the
# ends before re-testing whether a person name remains.
DECORATORS = {"tattoo", "tattoos", "tattooing", "ink", "studio", "studios", "art", "arts",
              "co", "piercing", "piercings", "company"}


def _strip_decorators(name: str) -> str:
    toks = name.split()
    while toks and toks[0].lower().strip(".,&") in DECORATORS:
        toks = toks[1:]
    while toks and toks[-1].lower().strip(".,&") in DECORATORS:
        toks = toks[:-1]
    return " ".join(toks)


def _embedded(images: list[dict]) -> int:
    return sum(1 for im in images if im.get("embedding") is not None)


def _slug_person_name(url: str) -> str | None:
    """If the URL's final segment is a clean person slug (1–2 alphabetic words, no nav/domain
    words), return it title-cased — e.g. /michael -> "Michael". Used to rescue a real artist
    page that the crawler labelled with a button ("Read Bio"). Else None."""
    seg = urlparse(url).path.rstrip("/").split("/")[-1]
    name = seg.replace("-", " ").replace("_", " ").strip().title()
    words = {w for w in re.split(r"[^a-z]+", name.lower()) if w}
    toks = name.split()
    if not words or words & NON_NAME_WORDS or not (1 <= len(toks) <= 2):
        return None
    if not all(t.replace("'", "").replace("-", "").isalpha() for t in toks):
        return None
    return name


def classify():
    c = db.client()
    artists = c.table("artists").select("id,name,profile_url,shop_id").execute().data
    shops = {s["id"]: s for s in c.table("shops").select("id,name,website").execute().data}
    imgs = c.table("portfolio_images").select("id,artist_id,storage_path,embedding").execute().data

    by_artist: dict[int, list[dict]] = {}
    for im in imgs:
        by_artist.setdefault(im["artist_id"], []).append(im)

    delete, rename, review = [], [], []
    for a in artists:
        url = (a.get("profile_url") or "").strip()
        shop = shops.get(a["shop_id"], {})
        site = (shop.get("website") or "").strip()
        path = urlparse(url).path.strip("/")
        if not path or url.rstrip("/") == site.rstrip("/"):
            continue  # house-artist fallback (site root) — legitimate, keep
        host = urlparse(site or url).netloc
        if _looks_like_artist_link(url, a["name"], host):
            continue  # still a valid artist link under the hardened rules — keep
        rec = {**a, "images": by_artist.get(a["id"], [])}
        # Real person name decorated with a domain word? Rename, keep images.
        stripped = _strip_decorators(a["name"])
        if not _is_person_name(a["name"]) and _is_person_name(stripped):
            rename.append({**rec, "new_name": stripped})
        elif _embedded(rec["images"]) >= REVIEW_MIN_EMBEDDED:
            review.append(rec)  # substantial portfolio — human confirms before delete/rename
        else:
            delete.append(rec)
    return delete, rename, review


def main() -> None:
    ap = argparse.ArgumentParser(description="Prune junk artists ingested before crawler hardening.")
    ap.add_argument("--apply", action="store_true", help="execute DELETEs (and remove their storage thumbnails)")
    ap.add_argument("--apply-renames", action="store_true", help="execute RENAMEs (label -> bare person name)")
    ap.add_argument("--rescue-from-slug", action="store_true",
                    help="promote REVIEW rows whose URL slug is a clean person name into RENAME (e.g. /michael -> 'Michael')")
    ap.add_argument("--delete-review", action="store_true",
                    help="also DELETE any REVIEW rows not rescued (treat the image-heavy junk as junk)")
    args = ap.parse_args()

    delete, rename, review = classify()
    c = db.client()

    # Reclassify the REVIEW bucket per the chosen flags, so the plan printed below is exactly
    # what will run.
    if args.rescue_from_slug:
        kept = []
        for a in review:
            slug_name = _slug_person_name(a.get("profile_url") or "")
            if slug_name and slug_name.lower() != a["name"].lower():
                rename.append({**a, "new_name": slug_name})
            else:
                kept.append(a)
        review = kept
    if args.delete_review:
        delete.extend(review)
        review = []

    def line(a):
        n = len(a["images"]); e = _embedded(a["images"])
        return f"imgs={n:>2}/emb={e:<2}  {a.get('profile_url')}"

    print(f"\n=== DELETE ({len(delete)} junk artists) ===")
    for a in sorted(delete, key=lambda x: x["name"].lower()):
        print(f"  [{a['id']:>4}] {a['name'][:34]:<34} {line(a)}")

    print(f"\n=== RENAME ({len(rename)} real artists with a decorated label) ===")
    for a in sorted(rename, key=lambda x: x["name"].lower()):
        print(f"  [{a['id']:>4}] {a['name'][:24]:<24} -> {a['new_name'][:24]:<24} {line(a)}")

    print(f"\n=== REVIEW ({len(review)} junk-by-URL but with a real portfolio — decide by hand) ===")
    for a in sorted(review, key=lambda x: -_embedded(x["images"])):
        print(f"  [{a['id']:>4}] {a['name'][:34]:<34} {line(a)}")

    if not args.apply and not args.apply_renames:
        print("\nDry run — nothing changed. Re-run with --apply and/or --apply-renames to execute.")
        if args.rescue_from_slug or args.delete_review:
            print("(--rescue-from-slug / --delete-review only reshape the plan; add --apply / --apply-renames to run it.)")
        return

    if args.apply_renames and rename:
        for a in rename:
            c.table("artists").update({"name": a["new_name"]}).eq("id", a["id"]).execute()
        print(f"\nRenamed {len(rename)} artist(s).")

    if args.apply and delete:
        bucket = c.storage.from_(__import__("tattoo_trap.config", fromlist=["STORAGE_BUCKET"]).STORAGE_BUCKET)
        paths = [im["storage_path"] for a in delete for im in a["images"] if im.get("storage_path")]
        img_ids = [im["id"] for a in delete for im in a["images"]]
        art_ids = [a["id"] for a in delete]
        for i in range(0, len(img_ids), 100):
            c.table("portfolio_images").delete().in_("id", img_ids[i:i + 100]).execute()
        for i in range(0, len(art_ids), 100):
            c.table("artists").delete().in_("id", art_ids[i:i + 100]).execute()
        for i in range(0, len(paths), 100):
            try:
                bucket.remove(paths[i:i + 100])
            except Exception as exc:  # noqa: BLE001 — storage cleanup is best-effort
                print(f"  ! storage remove failed for a batch: {exc!r}")
        print(f"\nDeleted {len(art_ids)} artist(s), {len(img_ids)} image row(s), {len(paths)} thumbnail(s).")


if __name__ == "__main__":
    main()
