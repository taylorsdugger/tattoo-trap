# Pipeline

Offline Python pipeline that builds the Tattoo Trap database: seed shops → crawl → embed.
Uses the Supabase **service-role** key (local only).

## Setup

```bash
cd pipeline
cp .env.example .env          # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

# install (either tool works)
uv sync                       # or: python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
python -m playwright install chromium
```

> First embed/test run downloads the CLIP weights (~600MB for torch + model). CPU is fine.

## Run (per metro)

```bash
python -m tattoo_trap.seed_shops   --metro chicago   # CSV -> shops
python -m tattoo_trap.crawl_shops  --metro chicago   # Playwright -> artists + image URLs
python -m tattoo_trap.embed_images --metro chicago   # download -> CLIP -> Storage + pgvector
```

Each stage is idempotent (safe to re-run). Metros: `chicago`, `peoria`, `iowa-city`,
`quad-cities`.

## Seed data

`seeds/<metro>.csv` columns: `name, address, website, instagram_handle, lat, lng`.
`name` is required; `website` is what the crawler needs. `seeds/chicago.csv` ships with a few
**example** shops — **verify the URLs/addresses** and add your own. The other metros are empty
templates ready to fill.

## Model parity

The pipeline embeds with `openai/clip-vit-base-patch32`; the browser uses the identical
`Xenova/clip-vit-base-patch32`. Both L2-normalize and compare with cosine, so a query embedded
in the browser is comparable to portfolio embeddings made here.

`pytest` checks the pipeline-side invariants (dimension, normalization, self-similarity). To
spot-check full cross-runtime parity, embed the same test image in the browser (dev tools) and
in the pipeline and confirm cosine ≳ 0.99.

## Notes

- The crawler is heuristic and best-effort; expect to tune selectors per shop site.
- Instagram is **link-out only** — no IG scraping. For thin artists, insert image URLs
  directly into `portfolio_images(artist_id, source_url)` and re-run `embed_images`.
- Thumbnails (≤384px JPEG) are uploaded to the `portfolios` Storage bucket; full images are
  discarded after embedding to stay under the Supabase free tier.
