"""Stage 2 — crawl shop websites to discover artists, Instagram handles, and image URLs.

Heuristic, best-effort crawler (Playwright). Real shop sites vary wildly; this gets a useful
first pass and is meant to be refined per-site. Discovered portfolio image URLs are stored as
`portfolio_images` rows with no embedding yet — Stage 3 (embed_images) fills those in.

Run:
    python -m tattoo_trap.crawl_shops --metro chicago
"""

from __future__ import annotations

import argparse
import re
import time
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright

from . import config, db

ARTIST_HINTS = ("artist", "team", "staff", "our-artists", "our-team", "roster")
NAV_JUNK = {
    "home", "about", "contact", "book", "booking", "gallery", "portfolio", "shop",
    "faq", "more", "menu", "aftercare", "pricing", "blog", "news", "merch",
}
SKIP_IMG = ("logo", "icon", "sprite", "favicon", "avatar-default", "placeholder")
PERSON_RE = re.compile(r"^[A-Z][a-zA-Z.''-]+(?:\s+[A-Z][a-zA-Z.''-]+){1,2}$")
IG_RE = re.compile(r"instagram\.com/([A-Za-z0-9_.]+)")

# Collect every anchor (href + text) and image candidate (src/srcset) on a page.
_COLLECT_JS = """
() => {
  const anchors = [...document.querySelectorAll('a[href]')].map(a => ({
    href: a.href, text: (a.textContent || '').trim().slice(0, 80)
  }));
  const imgs = [];
  for (const img of document.querySelectorAll('img')) {
    const ss = img.getAttribute('srcset');
    if (ss) { const parts = ss.split(',').map(s => s.trim().split(' ')[0]); if (parts.length) imgs.push(parts[parts.length-1]); }
    const src = img.currentSrc || img.src || img.getAttribute('data-src');
    if (src) imgs.push(src);
  }
  return { anchors, imgs, title: document.title || '' };
}
"""


def _abs(base: str, url: str) -> str:
    return urljoin(base, url)


def _clean_image_urls(base: str, raw: list[str]) -> list[str]:
    out, seen = [], set()
    for u in raw:
        if not u or u.startswith("data:"):
            continue
        absu = _abs(base, u)
        low = absu.lower()
        if any(bad in low for bad in SKIP_IMG):
            continue
        if not low.startswith(("http://", "https://")):
            continue
        if absu in seen:
            continue
        seen.add(absu)
        out.append(absu)
    return out


def _instagram_handle(anchors: list[dict]) -> str | None:
    for a in anchors:
        m = IG_RE.search(a.get("href", ""))
        if m:
            handle = m.group(1).strip("/.")
            if handle and handle.lower() not in ("p", "explore", "reel", "reels"):
                return handle
    return None


def _looks_like_artist_link(href: str, text: str, base_host: str) -> bool:
    if urlparse(href).netloc and urlparse(href).netloc != base_host:
        return False
    path = urlparse(href).path.lower().strip("/")
    if not path:
        return False
    label = (text or "").strip().lower()
    if label in NAV_JUNK:
        return False
    # individual artist page: an artist-hint segment with something after it,
    # or a person-looking link label.
    has_hint = any(h in path for h in ARTIST_HINTS)
    deep = path.count("/") >= 1
    person = bool(PERSON_RE.match((text or "").strip()))
    return (has_hint and deep) or person


def _artist_name(text: str, href: str) -> str:
    t = (text or "").strip()
    if t and len(t) <= 60 and t.lower() not in NAV_JUNK:
        return t
    seg = urlparse(href).path.rstrip("/").split("/")[-1]
    return seg.replace("-", " ").replace("_", " ").title() or "Artist"


def crawl_shop(page, shop: dict) -> int:
    """Crawl one shop. Returns the number of candidate images stored."""
    website = (shop.get("website") or "").strip()
    if not website:
        return 0
    base_host = urlparse(website).netloc

    try:
        page.goto(website, timeout=config.REQUEST_TIMEOUT_S * 1000, wait_until="domcontentloaded")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! could not load {website}: {exc}")
        return 0

    home = page.evaluate(_COLLECT_JS)

    # Instagram handle for the shop (if we don't have one yet).
    if not shop.get("instagram_handle"):
        ig = _instagram_handle(home["anchors"])
        if ig:
            db.client().table("shops").update({"instagram_handle": ig}).eq("id", shop["id"]).execute()

    # Candidate individual-artist links from the homepage + obvious listing pages.
    artist_links: dict[str, str] = {}  # href -> name
    for a in home["anchors"]:
        if _looks_like_artist_link(a["href"], a["text"], base_host):
            artist_links[_abs(website, a["href"])] = _artist_name(a["text"], a["href"])

    pages_visited = 1
    stored = 0

    if artist_links:
        for href, name in list(artist_links.items())[: config.CRAWL_MAX_PAGES_PER_SHOP]:
            if pages_visited >= config.CRAWL_MAX_PAGES_PER_SHOP:
                break
            try:
                page.goto(href, timeout=config.REQUEST_TIMEOUT_S * 1000, wait_until="domcontentloaded")
                pages_visited += 1
            except Exception:  # noqa: BLE001
                continue
            data = page.evaluate(_COLLECT_JS)
            ig = _instagram_handle(data["anchors"])
            artist = db.upsert_artist(
                shop_id=shop["id"],
                name=name,
                slug=db.slugify(f"{shop['name']}-{name}"),
                instagram_handle=ig,
                profile_url=href,
            )
            imgs = _clean_image_urls(href, data["imgs"])[: config.MAX_IMAGES_PER_ARTIST]
            for u in imgs:
                db.add_candidate_image(artist["id"], u)
                stored += 1
    else:
        # Fallback: treat the shop as a single "house" artist and use homepage images.
        artist = db.upsert_artist(
            shop_id=shop["id"],
            name=shop["name"],
            slug=db.slugify(shop["name"]),
            instagram_handle=shop.get("instagram_handle"),
            profile_url=website,
        )
        imgs = _clean_image_urls(website, home["imgs"])[: config.MAX_IMAGES_PER_ARTIST]
        for u in imgs:
            db.add_candidate_image(artist["id"], u)
            stored += 1

    return stored


def crawl_metro(metro_slug: str) -> None:
    metro = db.get_metro_by_slug(metro_slug)
    if not metro:
        raise SystemExit(f"Metro '{metro_slug}' not found. Seed it first.")
    shops = db.shops_for_metro(metro["id"])
    print(f"Crawling {len(shops)} shop(s) in '{metro_slug}'...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=config.USER_AGENT)
        page = context.new_page()
        for shop in shops:
            print(f"- {shop['name']} ({shop.get('website') or 'no website'})")
            n = crawl_shop(page, shop)
            print(f"    stored {n} candidate image(s)")
            time.sleep(config.POLITE_DELAY_S)
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl shop sites for artists + images.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    args = parser.parse_args()
    crawl_metro(args.metro)


if __name__ == "__main__":
    main()
