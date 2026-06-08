"""Find (and optionally remove) junk "artists" the crawler ingested before hardening.

A junk artist is a row that isn't a real tattoo artist. Three independent signals find them:

  1. URL junk — the stored `profile_url` the *current* hardened crawler filter would now reject
     (nav buttons, /services & /category pages, blog posts, account pages), e.g.
     "VIEW OUR SERVICES", "STYLE GUIDE".
  2. Non-tattoo-business cluster — an entire business that was mis-seeded as a "shop" and whose
     nav menu got scraped as a roster: many "artists" sharing ONE Instagram handle, the
     shop has zero tattoo signal in its name/handle/website, and the row isn't corroborated as a
     real artist. This catches the BoxLunch / Lovisa / Chicago Park District / med-spa rows whose
     two-Title-Case-word labels ("Day Camp", "Sale Earrings") impersonate person names and so slip
     past the URL filter.
  3. Junk-phrase name — an e-commerce / cosmetic-service label ("Ombre Brows", "Sale Necklaces")
     that isn't a tattoo-shop-style name and isn't corroborated.

A row is *corroborated* (and so never auto-deleted) when its URL sits under an artist directory
(/staff/…, /artists/…) OR it already holds an embedded portfolio image — the two things a real
artist row has and a scraped nav item doesn't. Shop "house artists" (profile_url at the site
root) of a *tattoo* shop are likewise kept: they're the intended fallback portfolio.

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
from collections import defaultdict
from urllib.parse import urlparse

from tattoo_trap import db
from tattoo_trap.crawl_shops import (
    ARTIST_HINTS,
    NON_NAME_WORDS,
    _is_mononym_slug,
    _is_person_name,
    _looks_like_artist_link,
)

# Rows the URL says are junk but which carry at least this many embedded portfolio images go to
# REVIEW (a human looks) rather than DELETE — they're the ones most likely to be a real artist.
REVIEW_MIN_EMBEDDED = 10
# A non-tattoo business betrays itself as a scraped nav menu when this many "artists" all link the
# SAME Instagram handle (a real shop's roster carries one handle per artist, not one shared by 12).
# 3 is aggressive but the cluster signal still requires zero tattoo signal in the shop AND that the
# row be uncorroborated (no /staff/ URL, no embedded image), so real shops stay protected.
CLUSTER_MIN = 3
# Domain words that decorate a real artist's label ("Amanda Shroom Tattoo"). Stripped from the
# ends before re-testing whether a person name remains.
DECORATORS = {"tattoo", "tattoos", "tattooing", "ink", "studio", "studios", "art", "arts",
              "co", "piercing", "piercings", "company"}
# Any of these in a shop's name/handle/website marks it as a genuine tattoo (or piercing) business,
# so its rows are spared the cluster sweep. Permissive on purpose: a false positive here only means
# we *don't* delete, which is the safe direction.
TATTOO_SIGNAL_RE = re.compile(r"tatto|tatu|ink|pierc|bodyart|body-art", re.IGNORECASE)
# E-commerce / cosmetic-service vocabulary that betrays a product or service page mislabeled as an
# artist. Deliberately excludes words that double as surnames (Camp, Marks, Stone…) — those civic /
# retail rows are caught by the cluster signal instead, not by name. Token-matched (whole words).
JUNK_PHRASE_WORDS = {
    "sale", "sales", "clearance", "earring", "earrings", "necklace", "necklaces", "bracelet",
    "bracelets", "wristwear", "anklet", "anklets", "accessory", "accessories", "waterproof",
    "jewellery", "jewelry", "zirconia", "brow", "brows", "ombre", "microblading", "blushing",
    "freckle", "freckles", "lash", "lashes", "camouflage", "wrinkle", "wrinkles", "revision",
    "reduction", "checkout", "wishlist", "signup", "newsletter", "subscribe", "membership",
    "donate", "volunteer", "faq", "faqs",
}


def _tattoo_signal(*texts: str | None) -> bool:
    return bool(TATTOO_SIGNAL_RE.search(" ".join(t for t in texts if t)))


def _name_junk_phrase(name: str) -> bool:
    words = {w for w in re.split(r"[^a-z]+", (name or "").lower()) if w}
    return bool(words & JUNK_PHRASE_WORDS)


def _is_individual_artist(name: str, url: str) -> bool:
    """True if a row looks like an individual person's page — a 2–3 token person name, or a flat
    /firstname page whose label matches the slug (/al -> "Al"). Real tattoo shops list their roster
    this way; scraped retail/civic businesses (Claire's stores, park-district pages) never do."""
    segs = [s for s in urlparse(url or "").path.lower().strip("/").split("/") if s]
    return _is_person_name(name) or _is_mononym_slug(name, segs)


def _under_artist_dir(url: str) -> bool:
    """True if the URL path has an artist-directory hint in a PARENT segment (/staff/jane,
    /artists/john-doe) — the structural fingerprint of a real roster page, used to corroborate
    a row even when its label looks junky."""
    segs = [s for s in urlparse(url or "").path.lower().strip("/").split("/") if s]
    return any(h in seg for seg in segs[:-1] for h in ARTIST_HINTS)


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
    artists = c.table("artists").select(
        "id,name,profile_url,shop_id,instagram_handle"
    ).execute().data
    shops = {
        s["id"]: s
        for s in c.table("shops").select("id,name,website,instagram_handle").execute().data
    }
    imgs = c.table("portfolio_images").select("id,artist_id,storage_path,embedding").execute().data

    by_artist: dict[int, list[dict]] = {}
    for im in imgs:
        by_artist.setdefault(im["artist_id"], []).append(im)

    # How many "artists" share each (shop, handle)? A big shared-handle group is a scraped nav menu.
    cluster: dict[tuple[int, str], int] = defaultdict(int)
    for a in artists:
        h = (a.get("instagram_handle") or "").lower()
        if h:
            cluster[(a["shop_id"], h)] += 1

    # A shop is a real roster — and so immune to the cluster sweep — when it lists individual
    # people OUTSIDE the shared-handle group (e.g. The Burnt Tiger's /eamonn, /chris pages with no
    # handle). Retail/civic shops whose every row shares one handle have no such siblings.
    roster: dict[int, int] = defaultdict(int)
    for a in artists:
        h = (a.get("instagram_handle") or "").lower()
        in_big = bool(h) and cluster[(a["shop_id"], h)] >= CLUSTER_MIN
        if not in_big and _is_individual_artist(a["name"], a.get("profile_url") or ""):
            roster[a["shop_id"]] += 1

    # Is the shop a tattoo business? Judge from its OWN identity AND from any of its rows' names or
    # URLs — "Personal Art Inc" carries no tattoo keyword, but its /artistic-tattooing/ page proves
    # it's a tattoo shop, so the non-tattoo-cluster sweep must leave its rows alone.
    shop_tattoo: dict[int, bool] = {}
    for sid, sh in shops.items():
        shop_tattoo[sid] = _tattoo_signal(sh.get("name"), sh.get("instagram_handle"), sh.get("website"))
    for a in artists:
        if not shop_tattoo.get(a["shop_id"]) and _tattoo_signal(a["name"], a.get("profile_url")):
            shop_tattoo[a["shop_id"]] = True

    delete, rename, review = [], [], []

    def route(rec: dict, reason: str, embedded: int) -> None:
        """Send a flagged row to REVIEW if it carries a substantial portfolio (a human decides),
        else DELETE. Reached only for uncorroborated rows, so `embedded` is normally 0."""
        tagged = {**rec, "reason": reason}
        (review if embedded >= REVIEW_MIN_EMBEDDED else delete).append(tagged)

    for a in artists:
        url = (a.get("profile_url") or "").strip()
        shop = shops.get(a["shop_id"], {})
        site = (shop.get("website") or "").strip()
        images = by_artist.get(a["id"], [])
        embedded = _embedded(images)
        rec = {**a, "images": images}

        # A real artist row has a roster-page URL or an actual embedded portfolio. Either one
        # corroborates it, so none of the heuristics below will delete it.
        corroborated = _under_artist_dir(url) or embedded >= 1

        # --- Signal 2: whole business mis-seeded as a shop (shared-handle nav cluster) ---
        # Zero tattoo signal in the SHOP's own identity + many rows sharing one handle + not
        # corroborated => this isn't a tattoo shop, this row isn't an artist.
        shop_is_tattoo = shop_tattoo.get(a["shop_id"], False)
        handle = (a.get("instagram_handle") or "").lower()
        in_cluster = bool(handle) and cluster[(a["shop_id"], handle)] >= CLUSTER_MIN
        shop_real_roster = roster[a["shop_id"]] >= 2
        if in_cluster and not shop_is_tattoo and not corroborated and not shop_real_roster:
            route(rec, "non-tattoo shop cluster", embedded)
            continue

        # --- Signal 3: e-commerce / cosmetic-service label, not a tattoo-shop name ---
        if _name_junk_phrase(a["name"]) and not _tattoo_signal(a["name"]) and not corroborated:
            route(rec, "junk-phrase name", embedded)
            continue

        # --- Signal 1: URL the hardened crawler would now reject (original behavior) ---
        path = urlparse(url).path.strip("/")
        is_house = (not path) or url.rstrip("/") == site.rstrip("/")
        host = urlparse(site or url).netloc
        if is_house or (path and _looks_like_artist_link(url, a["name"], host)):
            continue  # legitimate artist link / house-artist fallback — keep

        # Real person name decorated with a domain word? Rename, keep images.
        stripped = _strip_decorators(a["name"])
        if not _is_person_name(a["name"]) and _is_person_name(stripped):
            rename.append({**rec, "new_name": stripped})
        else:
            route(rec, "junk url", embedded)
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
        reason = a.get("reason")
        why = f"[{reason}]  " if reason else ""
        return f"imgs={n:>2}/emb={e:<2}  {why}{a.get('profile_url')}"

    print(f"\n=== DELETE ({len(delete)} junk artists) ===")
    for a in sorted(delete, key=lambda x: (x.get("reason", ""), x["name"].lower())):
        print(f"  [{a['id']:>4}] {a['name'][:34]:<34} {line(a)}")

    print(f"\n=== RENAME ({len(rename)} real artists with a decorated label) ===")
    for a in sorted(rename, key=lambda x: x["name"].lower()):
        print(f"  [{a['id']:>4}] {a['name'][:24]:<24} -> {a['new_name'][:24]:<24} {line(a)}")

    print(f"\n=== REVIEW ({len(review)} flagged but with a real portfolio — decide by hand) ===")
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
