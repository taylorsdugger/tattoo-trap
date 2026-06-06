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

# --- Embedding model -------------------------------------------------------------------
# Must match the browser model (Xenova/clip-vit-base-patch32). Same checkpoint, L2-normalized,
# cosine similarity. See tests/test_parity.py.
EMBED_MODEL = "openai/clip-vit-base-patch32"
EMBED_DIM = 512

# --- Storage ---------------------------------------------------------------------------
STORAGE_BUCKET = "portfolios"
THUMB_MAX = 384  # max thumbnail dimension (px) to keep Storage under the 1GB free cap

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
