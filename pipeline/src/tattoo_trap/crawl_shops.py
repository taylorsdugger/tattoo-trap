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
from .image_sources import normalize_handle

ARTIST_HINTS = ("artist", "artists", "team", "staff", "our-artists", "our-team", "roster", "crew")

# Whole path segments that mark a page as editorial/navigational — never an individual
# artist. Matched against entire segments (not substrings) so "/post/..." and "/services/..."
# are caught while a real slug that merely contains these letters is not. This is what stops
# blog posts like "/post/...-the-right-artist" (which contain the word "artist") and category
# pages like "/services/portrait-tattoos-chicago" from being ingested as artists.
NON_ARTIST_SEGMENTS = {
    "post", "posts", "blog", "news", "article", "articles", "press", "story", "stories",
    "tag", "tags", "category", "categories", "gallery", "galleries", "portfolio",
    "services", "service", "faq", "faqs", "about", "contact", "book", "booking",
    "appointment", "appointments", "consultation", "shop", "store", "cart", "checkout",
    "account", "my", "m", "login", "register", "signup", "aftercare", "care", "pricing",
    "price", "policy", "policies", "privacy", "terms", "reviews", "guide", "guides",
    "styles", "specials", "events", "merch", "gift", "home", "menu", "blank",
}

# Words that, if present in a link label, mean it is not a person's name: function words,
# call-to-action verbs, and tattoo-domain category nouns. Token-based (whole words) so a real
# surname is never nuked by a substring (e.g. "Mark Booker" is unaffected by "book").
NON_NAME_WORDS = {
    # function words
    "our", "your", "my", "we", "us", "the", "a", "an", "all", "and", "of", "to", "for",
    "with", "this", "that", "more", "new",
    # call-to-action / imperative verbs (nav buttons read as "Verb Noun")
    "view", "see", "read", "meet", "join", "create", "book", "booking", "shop", "get",
    "find", "learn", "discover", "explore", "browse", "contact", "call", "visit", "tour",
    # tattoo-domain / category nouns (page titles, not personal names)
    "tattoo", "tattoos", "piercing", "piercings", "services", "service", "guide", "guides",
    "account", "page", "collection", "gallery", "galleries", "portfolio", "work", "works",
    "bio", "dates", "care", "instructions", "studio", "studios", "ink", "art", "arts",
    "fx", "realism", "anime", "manga", "surrealism", "portrait", "japanese", "fine", "line",
    "coverup", "custom", "special", "specials", "film", "themed", "nature", "culture", "pop",
    "color", "colour", "private", "team", "staff", "artist", "artists", "interview",
    "interviews", "flash", "merch", "policy", "privacy", "terms", "about", "faq", "faqs",
    "pricing", "price", "hours", "location", "locations", "directions", "events", "blog",
    "news", "press", "career", "careers", "review", "reviews", "aftercare", "appointment",
    "appointments", "consultation", "consultations", "gift", "cart", "checkout", "home",
    "menu", "store", "bridal", "makeup", "guest",
}

# A single token in a person's name: starts uppercase, is ≥2 letters, and ends in a letter.
# Both Title-Case ("Scott", "McDarrah", "O'Neil", "Anne-Marie", "DeLuca") and ALL-CAPS ("SCOTT",
# "LOTZ") qualify — many Wix/Squarespace themes render artist names in CSS caps, so the old rule
# (require a lowercase letter) silently dropped every all-caps name. ALL-CAPS nav labels
# ("VIEW OUR SERVICES", "ANIME AND MANGA") are still rejected, but by the NON_NAME_WORDS check in
# _is_person_name (which runs first and already covers them), not by letter case. Single letters
# fall through to INITIAL_RE.
NAME_TOKEN_RE = re.compile(r"^[A-Z][A-Za-z'’.\-]*[A-Za-z]$")
# A bare initial like "J" or "J." — allowed alongside name tokens but never the whole name.
INITIAL_RE = re.compile(r"^[A-Z]\.?$")
SKIP_IMG = (
    "logo", "icon", "sprite", "favicon", "avatar", "placeholder",
    # non-art site chrome / headshots that pollute the visual index
    "banner", "profile", "header", "exterior", "interior", "storefront",
    "flash-wall", "-sign", "signage",  # "-sign" not "sign" so it won't match "designs"
    "pixel.wp.com",  # WordPress stats tracking gif
    "googleusercontent.com/sitesv/",  # Google Sites images 403 anything but a browser session
)
# WordPress (and similar) emit resized copies like `foo-150x150.jpg` alongside the original
# `foo.jpg`. Strip the `-WxH` suffix so we embed the full-size image once, not tiny dupes.
SIZE_SUFFIX_RE = re.compile(r"-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)\b)", re.IGNORECASE)
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
    // Split candidates on ",<space>" only — Wix image URLs contain bare commas in the path
    // ("/v1/fill/w_39,h_39,...,quality_auto/x.png"); splitting on "," shatters those into
    // relative fragments that urljoin then 404s against the shop domain.
    if (ss) { const parts = ss.split(/,\\s+/).map(s => s.trim().split(' ')[0]); if (parts.length) imgs.push(parts[parts.length-1]); }
    const src = img.currentSrc || img.src || img.getAttribute('data-src');
    if (src) imgs.push(src);
  }
  return { anchors, imgs, title: document.title || '' };
}
"""


# Step-scroll the whole page to trigger lazy-loaded (`loading="lazy"` / `data-src`) gallery
# images, then return to the top. Async so Playwright awaits the inter-step settles.
_SCROLL_JS = """
async () => {
  const step = Math.max(window.innerHeight, 600);
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 150));
  }
  window.scrollTo(0, 0);
}
"""

# Bounded settle waits for client-rendered galleries (Wix/GoDaddy/Squarespace build their
# portfolio grids in JS after load). Capped so a page that never goes network-idle costs a few
# seconds, not the full REQUEST_TIMEOUT_S, per page.
GALLERY_SETTLE_MS = 8000
LAZYLOAD_SETTLE_MS = 1500


def _settle_and_collect(page) -> dict:
    """Read anchors+images after giving JS-rendered galleries a chance to populate. The caller
    has already navigated (`page.goto`). Best-effort: every wait is bounded and swallowed, so a
    static page (nothing to lazy-load, never idle) just falls straight through to the collect."""
    try:
        page.wait_for_load_state("networkidle", timeout=GALLERY_SETTLE_MS)
    except Exception:  # noqa: BLE001 — analytics/long-poll sites never reach idle; that's fine
        pass
    try:
        page.evaluate(_SCROLL_JS)
        page.wait_for_load_state("networkidle", timeout=LAZYLOAD_SETTLE_MS)
    except Exception:  # noqa: BLE001 — scroll-triggered loads are a bonus, not a requirement
        pass
    return page.evaluate(_COLLECT_JS)


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


def _is_person_name(text: str) -> bool:
    """True only for a plausible human name: 2–3 Title-Case tokens, no nav/domain words, not
    ALL-CAPS. Deliberately strict — a false negative just falls back to the shop house-artist,
    whereas a false positive ingests a junk "artist" (the failure we're hardening against)."""
    t = (text or "").strip()
    if not t or len(t) > 40:
        return False
    tokens = t.split()
    if not (2 <= len(tokens) <= 3):
        return False
    if {w for w in re.split(r"[^a-z]+", t.lower()) if w} & NON_NAME_WORDS:
        return False
    name_tokens = 0
    for tok in tokens:
        if NAME_TOKEN_RE.match(tok):
            name_tokens += 1
        elif INITIAL_RE.match(tok):
            continue  # an initial is allowed, but doesn't count toward the 2-token minimum
        else:
            return False
    return name_tokens >= 2


def _is_mononym_slug(text: str, segs: list[str]) -> bool:
    """A flat single-segment page whose label is ONE capitalized token that equals the slug —
    e.g. /bowser labeled "Bowser". Single-name artists/handles (Bowser, Bishop, Sailor) are common
    and the 2-token `_is_person_name` rule misses them. Requiring `slugify(label) == segment` is the
    corroboration that keeps stray one-word nav buttons out: a real mononym page links its own name,
    whereas a nav button's label rarely matches its href slug. NON_ARTIST_SEGMENTS is already
    enforced by the caller; NON_NAME_WORDS screens domain/category words like "Flash" or "Guest"."""
    if len(segs) != 1:
        return False
    t = (text or "").strip()
    tokens = t.split()
    if len(tokens) != 1 or not NAME_TOKEN_RE.match(tokens[0]):
        return False
    if t.lower() in NON_NAME_WORDS:
        return False
    return db.slugify(t) == segs[0]


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
    segs = [s for s in path.split("/") if s]
    # Editorial / navigational / account pages are never an individual artist.
    if any(seg in NON_ARTIST_SEGMENTS for seg in segs):
        return False
    # A real artist listing links the person under a *hint directory*, e.g. /artists/john-doe
    # or /our-team/jane — the hint is a PARENT segment, not the final one. Requiring the hint
    # in a parent segment stops blog slugs that merely end in "...-artist" from matching.
    hint_dir = any(h in seg for seg in segs[:-1] for h in ARTIST_HINTS)
    return _is_person_name(text.strip()) or hint_dir or _is_mononym_slug(text, segs)


def _artist_name(text: str, href: str) -> str:
    t = (text or "").strip()
    if _is_person_name(t):
        return t
    # Label wasn't a clean name (e.g. a "Read Bio" button under an artist directory) — derive
    # from the URL's final slug, which is usually the person: /artists/jane-doe -> "Jane Doe".
    seg = urlparse(href).path.rstrip("/").split("/")[-1]
    slug_name = seg.replace("-", " ").replace("_", " ").strip().title()
    return slug_name or (t if 0 < len(t) <= 60 else "Artist")


def crawl_shop(page, shop: dict) -> int:
    """Crawl one shop. Returns the number of candidate images stored."""
    website = (shop.get("website") or "").strip()
    if not website:
        return 0
    base_host = urlparse(website).netloc

    # Instagram-only shop (website IS an instagram.com profile): crawling is pointless
    # (robots.txt disallows it anyway), but the URL itself carries the handle. Record it on
    # the shop and create the house artist so the Instagram scrape stage picks it up.
    if base_host.lower().removeprefix("www.") == "instagram.com":
        handle = normalize_handle(website)
        if handle:
            if not shop.get("instagram_handle"):
                db.client().table("shops").update({"instagram_handle": handle}).eq(
                    "id", shop["id"]
                ).execute()
            db.upsert_artist(
                shop_id=shop["id"],
                name=shop["name"],
                slug=db.slugify(shop["name"]),
                instagram_handle=handle,
                profile_url=website,
            )
            print(f"  instagram-only site; recorded handle @{handle} for IG scrape stage")
        return 0

    if not _can_fetch(website):
        print(f"  ! robots.txt disallows {website}; skipping")
        return 0

    try:
        page.goto(website, timeout=config.REQUEST_TIMEOUT_S * 1000, wait_until="domcontentloaded")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! could not load {website}: {exc}")
        return 0

    home = _settle_and_collect(page)

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
            data = _settle_and_collect(page)
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


def crawl_metro(metro_slug: str, *, new_only: bool = False) -> None:
    metro = db.get_metro_by_slug(metro_slug)
    if not metro:
        raise SystemExit(f"Metro '{metro_slug}' not found. Seed it first.")
    shops = db.shops_for_metro(metro["id"])
    if new_only:
        # Skip shops that already produced artists — for incremental runs after a broader
        # seed. Shops whose earlier crawl found nothing are retried (site may have failed).
        crawled = {a["shop_id"] for a in db.artists_for_shops([s["id"] for s in shops])}
        shops = [s for s in shops if s["id"] not in crawled]
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
    parser.add_argument(
        "--new-only",
        action="store_true",
        help="only crawl shops with no artists yet (incremental run after a broader seed)",
    )
    args = parser.parse_args()
    crawl_metro(args.metro, new_only=args.new_only)


if __name__ == "__main__":
    main()
