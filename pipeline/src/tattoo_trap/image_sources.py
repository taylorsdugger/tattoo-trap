"""Pluggable portfolio-image sources.

The pipeline embeds whatever `portfolio_images.source_url`s it finds; *where* those URLs come
from is an implementation detail behind one small interface. The shop-site crawler was the
first source. This module adds Instagram (via the Apify paid scraper) behind the same
contract, so a third source (e.g. a RapidAPI endpoint) is a drop-in: implement `ImageSource`
and append it to the stage's source list.

    candidate URLs ──► db.add_candidate_image(artist_id, url) ──► embed_images (unchanged)

`ImageSource.fetch` returns image URLs for one IG handle. `ensure_budget` lets a *metered*
source veto further work before it spends money — Apify reads real month-to-date spend from
its API and raises `BudgetExceeded` once the free-tier guard is hit. Unmetered sources make it
a no-op.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx

from . import config


class BudgetExceeded(Exception):
    """Raised by a metered source when continuing would exceed its spend guard."""


@dataclass(frozen=True)
class ImageCandidate:
    """One portfolio image discovered for an artist. URL only — the embed stage downloads,
    content-gates, thumbnails and embeds it; nothing else here is persisted."""

    url: str


class ImageSource(Protocol):
    name: str

    def ensure_budget(self) -> None:
        """Raise BudgetExceeded if this source has hit its spend guard. No-op if unmetered."""

    def fetch(self, handle: str, limit: int) -> list[ImageCandidate]:
        """Return up to `limit` image candidates for one IG handle (best-effort, may be empty)."""


def normalize_handle(raw: str | None) -> str | None:
    """Reduce a stored handle/URL to a bare username, or None if it isn't a real profile."""
    if not raw:
        return None
    h = raw.strip().strip("@").strip("/")
    if "instagram.com/" in h:  # a full URL slipped into the handle column
        h = h.split("instagram.com/", 1)[1].strip("/")
    h = h.split("/", 1)[0].split("?", 1)[0].lower()
    if not h or h in config.IG_RESERVED_HANDLES:
        return None
    return h


class ApifyInstagramSource:
    """Fetch public IG post images via Apify's `apify/instagram-scraper` actor.

    Metered: `ensure_budget` reads real month-to-date USD spend from the Apify account API and
    raises once it reaches `IG_MONTHLY_BUDGET_USD`, so a backfill stops cleanly inside the free
    monthly credit. (The authoritative cap is still the console spend limit — see config.)
    """

    name = "apify-instagram"

    def __init__(self, token: str, budget_usd: float = config.IG_MONTHLY_BUDGET_USD) -> None:
        if not token:
            raise SystemExit(
                "Missing APIFY_TOKEN. Add it to pipeline/.env (see .env.example) — get a token "
                "at https://console.apify.com/account/integrations."
            )
        self._token = token
        self._budget_usd = budget_usd
        self._client = httpx.Client(timeout=config.IG_RUN_TIMEOUT_S)

    # --- spend guard ---------------------------------------------------------------------

    def account_limits(self) -> tuple[float, float | None]:
        """Return (month-to-date spend USD, account max monthly spend USD or None if unset).

        Reads GET /v2/users/me/limits. The spend is the number the free $5 credit draws from;
        the max is whatever cap you set in the Apify console (the authoritative backstop)."""
        resp = self._client.get(
            "https://api.apify.com/v2/users/me/limits",
            params={"token": self._token},
            timeout=config.REQUEST_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        current = data.get("current", {})
        limits = data.get("limits", {})
        # Field names have drifted across API versions; accept the known variants.
        spent = float(current.get("monthlyUsageUsd", current.get("monthlyUsageCycleUsd", 0.0)))
        raw_max = limits.get("maxMonthlyUsageUsd")
        return spent, (float(raw_max) if raw_max else None)

    def monthly_spend_usd(self) -> float:
        return self.account_limits()[0]

    def effective_cap_usd(self) -> float:
        """The cap actually enforced: the lower of the configured guard and your console max."""
        _, account_max = self.account_limits()
        return min(self._budget_usd, account_max) if account_max else self._budget_usd

    def ensure_budget(self) -> None:
        spent, account_max = self.account_limits()
        cap = min(self._budget_usd, account_max) if account_max else self._budget_usd
        if spent >= cap:
            raise BudgetExceeded(f"Apify month-to-date spend ${spent:.2f} ≥ guard ${cap:.2f}")

    # --- fetch ---------------------------------------------------------------------------

    def fetch(self, handle: str, limit: int) -> list[ImageCandidate]:
        run_input = {
            "directUrls": [f"https://www.instagram.com/{handle}/"],
            "resultsType": "posts",
            "resultsLimit": limit,
            "addParentData": False,
        }
        resp = self._client.post(
            f"https://api.apify.com/v2/acts/{config.APIFY_INSTAGRAM_ACTOR}"
            "/run-sync-get-dataset-items",
            params={"token": self._token},
            json=run_input,
        )
        resp.raise_for_status()
        return _candidates_from_posts(resp.json(), limit)

    def close(self) -> None:
        self._client.close()


def _candidates_from_posts(items: list[dict], limit: int) -> list[ImageCandidate]:
    """Flatten Apify post items into image URLs. Carousel ('Sidecar') posts carry several
    images; single posts/video covers carry one `displayUrl`. Dedup, cap at `limit`."""
    urls: list[str] = []
    seen: set[str] = set()
    for item in items or []:
        candidates = list(item.get("images") or [])
        display = item.get("displayUrl")
        if display:
            candidates.append(display)
        for url in candidates:
            if url and url not in seen:
                seen.add(url)
                urls.append(url)
    return [ImageCandidate(url=u) for u in urls[:limit]]
