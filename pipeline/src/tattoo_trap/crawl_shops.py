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
from urllib.robotparser import RobotFileParser

import httpx
from playwright.sync_api import sync_playwright

from . import config, db

ARTIST_HINTS = ("artist", "team", "staff", "our-artists", "our-team", "roster")
NAV_JUNK = {
    "home", "about", "contact", "book", "booking", "gallery", "portfolio", "shop",
    "faq", "more", "menu", "aftercare", "pricing", "blog", "news", "merch",
}
# Any link whose label contains one of these *words* is not an artist. Token-based (not
# substring) so it catches "About Us" / "Contact Us" / "Book Now" / "Artist Interview" /
# "Bridal Makeup" without nuking real names (e.g. "Mark Booker" keeps the token "booker").
JUNK_WORDS = {
    "about", "contact", "book", "booking", "appointment", "appointments", "consultation",
    "consultations", "interview", "bridal", "makeup", "faq", "gallery", "portfolio",
    "home", "menu", "shop", "store", "aftercare", "pricing", "price", "blog", "news",
    "merch", "press", "career", "careers", "review", "reviews", "hours", "location",
    "locations", "directions", "guest", "events", "specials", "cart", "checkout", "gift",
    "us", "faqs", "policy", "privacy", "terms",
}
SKIP_IMG = (
    "logo", "icon", "sprite", "favicon", "avatar", "placeholder",
    # non-art site chrome / headshots that pollute the visual index
    "banner", "profile", "header", "exterior", "interior", "storefront",
    "flash-wall", "-sign", "signage",  # "-sign" not "sign" so it won't match "designs"
)
# WordPress (and similar) emit resized copies like `foo-150x150.jpg` alongside the original
# `foo.jpg`. Strip the `-WxH` suffix so we embed the full-size image once, not tiny dupes.
SIZE_SUFFIX_RE = re.compile(r"-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)\b)", re.IGNORECASE)
# Generic non-artist page labels/paths that the person-name heuristic otherwise mistakes for
# artists (e.g. "Privacy Policy", "Product Photography").
STOP_PHRASES = (
    "privacy", "policy", "terms", "cookie", "shipping", "returns", "return",
    "photography", "videos", "video", "imagery", "infographic", "checkout", "cart",
    "gift", "career", "press",
)
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


# robots.txt: one parser per host, fetched with our real UA. None = "couldn't fetch", which
# we treat as allowed (no rules published). RobotFileParser.can_fetch defaults to allow when a
# host has no matching disallow.
_robots_cache: dict[str, RobotFileParser | None] = {}


def _robots_for(url: str) -> RobotFileParser | None:
    parsed = urlparse(url)
    host = f"{parsed.scheme}://{parsed.netloc}"
    if host in _robots_cache:
        return _robots_cache[host]

    rp: RobotFileParser | None = None
    try:
        resp = httpx.get(
            f"{host}/robots.txt",
            headers={"User-Agent": config.USER_AGENT},
            timeout=config.REQUEST_TIMEOUT_S,
            follow_redirects=True,
        )
        if resp.status_code < 400 and resp.text.strip():
            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
    except Exception:  # noqa: BLE001 — network/parse failure → treat as no rules (allowed)
        rp = None

    _robots_cache[host] = rp
    return rp


def _can_fetch(url: str) -> bool:
    rp = _robots_for(url)
    if rp is None:
        return True
    return rp.can_fetch(config.USER_AGENT, url)


def _clean_image_urls(base: str, raw: list[str]) -> list[str]:
    out, seen = [], set()
    for u in raw:
        if not u or u.startswith("data:"):
            continue
        absu = SIZE_SUFFIX_RE.sub("", _abs(base, u))  # collapse -WxH variants to the original
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
    href = href.decode("utf-8", "ignore") if isinstance(href, bytes) else str(href or "")
    text = text.decode("utf-8", "ignore") if isinstance(text, bytes) else str(text or "")
    if not href:
        return False
    if urlparse(href).netloc and urlparse(href).netloc != base_host:
        return False
    path = urlparse(href).path.lower().strip("/")
    if not path:
        return False
    label = (text or "").strip().lower()
    label_words = {w for w in re.split(r"[^a-z]+", label) if w}
    if label in NAV_JUNK or (label_words & JUNK_WORDS):
        return False
    if any(p in label or p in path for p in STOP_PHRASES):
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

    if not _can_fetch(website):
        print(f"  ! robots.txt disallows {website}; skipping")
        return 0

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
            if not _can_fetch(href):
                continue
            try:
                time.sleep(config.POLITE_DELAY_S)
                page.goto(href, timeout=config.REQUEST_TIMEOUT_S * 1000, wait_until="domcontentloaded")
                pages_visited += 1
            except Exception:  # noqa: BLE001
                continue
            data = page.evaluate(_COLLECT_JS)
            imgs = _clean_image_urls(href, data["imgs"])[: config.MAX_IMAGES_PER_ARTIST]
            if not imgs:
                continue  # no portfolio images -> not a real artist page (e.g. a stray nav link)
            ig = _instagram_handle(data["anchors"])
            artist = db.upsert_artist(
                shop_id=shop["id"],
                name=name,
                slug=db.slugify(f"{shop['name']}-{name}"),
                instagram_handle=ig,
                profile_url=href,
            )
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
            try:
                n = crawl_shop(page, shop)
                print(f"    stored {n} candidate image(s)")
            except Exception as exc:  # noqa: BLE001 — one bad shop must not abort the run
                print(f"    ! skipped (crawl error): {exc!r}")
            time.sleep(config.POLITE_DELAY_S)
        browser.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl shop sites for artists + images.")
    parser.add_argument("--metro", required=True, help="metro slug, e.g. chicago")
    args = parser.parse_args()
    crawl_metro(args.metro)


if __name__ == "__main__":
    main()
