/* On-demand Instagram image sourcing via a RapidAPI scraper — the web-app counterpart to the
   pipeline's Apify source. The artist page's "fetch images" button uses this to backfill an
   artist who has zero portfolio images, WITHOUT spending Apify credits.

   This produces the same thing the Python sources do: a list of public image URLs that get
   written as `portfolio_images.source_url` candidates. The existing `embed_images.py` stage
   then downloads, content-gates, thumbnails and embeds them — unchanged. (Option A: this only
   discovers URLs; the Python embed run turns them into displayable thumbnails.)

   Provider-agnostic by design. RapidAPI has many Instagram scrapers and they all return
   *different* JSON shapes, so instead of hard-coding one schema we deep-walk the response and
   harvest every Instagram-CDN image URL we find. Swapping providers is then just changing the
   RAPIDAPI_INSTAGRAM_* env vars — no code change. */

// Mirrors pipeline config.IG_RESERVED_HANDLES: IG paths that look like handles but aren't profiles.
const RESERVED_HANDLES = new Set([
  "p", "reel", "reels", "explore", "stories", "tv", "accounts", "directory", "about",
]);

// Mirrors pipeline config.MAX_IMAGES_PER_ARTIST.
const MAX_IMAGES = 15;

const IG_CDN_HOST = /(cdninstagram\.com|fbcdn\.net)/i;
const IMAGE_EXT = /\.(jpe?g|webp|heic|png)(\?|$)/i;

/** Reduce a stored handle/URL to a bare username, or null if it isn't a real profile.
    Ported from pipeline image_sources.normalize_handle so both paths agree. */
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let h = raw.trim().replace(/^@+/, "").replace(/\/+$/, "");
  if (h.includes("instagram.com/")) h = h.split("instagram.com/")[1].replace(/\/+$/, "");
  h = h.split("/")[0].split("?")[0].toLowerCase();
  if (!h || RESERVED_HANDLES.has(h)) return null;
  return h;
}

/** Collapse multi-resolution variants of the same IG media to one URL. IG CDN filenames look
    like `309876543_123_n.jpg`; the leading numeric run identifies the asset, so two URLs that
    differ only by size/signature dedupe to one. Falls back to the full URL when there's no id. */
function mediaKey(url: string): string {
  try {
    const base = new URL(url).pathname.split("/").pop() ?? url;
    const idMatch = base.match(/\d{6,}/);
    return idMatch ? idMatch[0] : url;
  } catch {
    return url;
  }
}

/** Recursively collect every Instagram-CDN image URL string anywhere in the response. */
function harvestImageUrls(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    if (IG_CDN_HOST.test(node) && (IMAGE_EXT.test(node) || node.includes("/v/"))) {
      out.push(node);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) harvestImageUrls(item, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node)) harvestImageUrls(value, out);
  }
}

/** Fetch up to MAX_IMAGES public post-image URLs for one IG handle from the configured RapidAPI
    scraper. Returns [] (never throws on an empty/blocked handle) so the caller can stamp the
    artist as attempted, exactly like the Apify path. Throws only on real config/transport errors. */
export async function fetchInstagramImageUrls(handle: string): Promise<string[]> {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_INSTAGRAM_HOST;
  const urlTemplate = process.env.RAPIDAPI_INSTAGRAM_URL;
  if (!key || !host || !urlTemplate) {
    throw new Error(
      "RapidAPI not configured. Set RAPIDAPI_KEY, RAPIDAPI_INSTAGRAM_HOST and " +
        "RAPIDAPI_INSTAGRAM_URL in apps/web/.env.local (see .env.example).",
    );
  }

  // Some providers take the username as a GET query param; others (like Instagram Scraper Stable
  // API's get_ig_user_posts.php) want a POST with a form-encoded body. Both are supported via env:
  // put {handle} in the URL and/or the optional body template, and we substitute it in either.
  const bodyTemplate = process.env.RAPIDAPI_INSTAGRAM_BODY;
  const method = (
    process.env.RAPIDAPI_INSTAGRAM_METHOD ?? (bodyTemplate ? "POST" : "GET")
  ).toUpperCase();
  const sub = (s: string) => s.replace(/\{handle\}/g, encodeURIComponent(handle));

  const init: RequestInit = {
    method,
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
    // No caching — this is an explicit on-demand fetch.
    cache: "no-store",
  };
  if (bodyTemplate) {
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/x-www-form-urlencoded";
    init.body = sub(bodyTemplate);
  }

  const resp = await fetch(sub(urlTemplate), init);
  if (!resp.ok) {
    throw new Error(`RapidAPI ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json().catch(() => null);
  if (!data) return [];

  const harvested: string[] = [];
  harvestImageUrls(data, harvested);

  // Dedupe by media identity, cap at MAX_IMAGES.
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const u of harvested) {
    const k = mediaKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    urls.push(u);
    if (urls.length >= MAX_IMAGES) break;
  }
  return urls;
}
