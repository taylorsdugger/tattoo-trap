"""Configuration and constants for the pipeline.

Loads environment from `pipeline/.env`. The service-role key is used here only — it must
never be shipped to the browser.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# pipeline/ root (two levels up from this file: src/tattoo_trap/config.py -> pipeline/)
PIPELINE_ROOT = Path(__file__).resolve().parents[2]
SEEDS_DIR = PIPELINE_ROOT / "seeds"

load_dotenv(PIPELINE_ROOT / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")

# --- Embedding model -------------------------------------------------------------------
# Must match the browser model (Xenova/clip-vit-base-patch32). Same checkpoint, L2-normalized,
# cosine similarity. See tests/test_parity.py.
EMBED_MODEL = "openai/clip-vit-base-patch32"
EMBED_DIM = 512

# --- Storage ---------------------------------------------------------------------------
STORAGE_BUCKET = "portfolios"
THUMB_MAX = 384  # max thumbnail dimension (px) to keep Storage under the 1GB free cap

# --- Google Places (cost guardrails) ---------------------------------------------------
# Places Text Search (New) bills PER request (per page). Each page returns up to 20 results.
# These caps bound the spend of a seed run: at most PLACES_MAX_PAGES_PER_METRO requests and
# PLACES_MAX_RESULTS_PER_METRO shops per metro. Lower them to stay deep inside free credit.
PLACES_RADIUS_M = 40000.0  # ~25 mi bias circle around the metro center
PLACES_MAX_PAGES_PER_METRO = 3  # 3 pages x ~20 = up to 60 results, 3 billable requests
PLACES_MAX_RESULTS_PER_METRO = 60  # hard cap; paging stops early once reached

# --- Instagram scraping (Apify) --------------------------------------------------------
# Portfolio images sourced from artists' public IG posts via a paid scraper (the scraper runs
# the proxies/anti-blocking, so it's reliable where direct scraping is fragile). Images are
# embedded then discarded — only ≤384px thumbnails are kept, same as the shop-site crawler.
#
# Hard deadline at the free limit: this is enforced in TWO layers.
#   1. Authoritative backstop — set a "max monthly spend" limit in the Apify console
#      (Settings → Limits → $5). Apify enforces it server-side; code bugs can't overspend.
#   2. Graceful guard (below) — the stage reads ACTUAL monthly spend from the Apify API
#      (/v2/users/me/limits) and stops before the cap with headroom, logging what's left.
APIFY_INSTAGRAM_ACTOR = "apify~instagram-scraper"
# Stop scraping once real month-to-date Apify spend reaches this. $5 is the free monthly
# credit; 4.50 leaves headroom so the final artist can't tip past the free tier.
IG_MONTHLY_BUDGET_USD = 4.50
# Rough per-artist cost, for `--count` PLANNING estimates only (cycles to backfill). The real
# spend guard uses actual month-to-date dollars from the Apify API, not this number.
IG_EST_COST_PER_ARTIST_USD = 0.035
# IG actor runs can take a while (login walls, proxy retries); give run-sync room.
IG_RUN_TIMEOUT_S = 300
# IG paths that look like handles but aren't profiles — skip if one slipped into a handle col.
IG_RESERVED_HANDLES = frozenset(
    {"p", "reel", "reels", "explore", "stories", "tv", "accounts", "directory", "about"}
)

# --- Crawl limits ----------------------------------------------------------------------
MAX_IMAGES_PER_ARTIST = 15
CRAWL_MAX_PAGES_PER_SHOP = 12
REQUEST_TIMEOUT_S = 20
POLITE_DELAY_S = 1.0
USER_AGENT = (
    "TattooTrapBot/0.1 (+https://github.com/your/tattoo-trap; personal discovery project)"
)


def require_supabase_env() -> None:
    """Raise a helpful error if Supabase credentials are missing."""
    missing = [
        name
        for name, val in (
            ("SUPABASE_URL", SUPABASE_URL),
            ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
        )
        if not val
    ]
    if missing:
        raise SystemExit(
            f"Missing env: {', '.join(missing)}. "
            f"Copy pipeline/.env.example to pipeline/.env and fill it in."
        )
