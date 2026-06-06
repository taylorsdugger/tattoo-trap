# Architecture

## Overview

Tattoo Trap is a visual-similarity search engine over a curated database of local tattoo
artists. Two halves:

- **Offline pipeline** (Python) builds the database: discovers shops/artists, downloads a
  sample of portfolio images, and stores CLIP embeddings in Postgres.
- **Online web app** (Next.js on Vercel) answers queries: embeds the user's uploaded image in
  the browser and runs a `pgvector` cosine search.

```
                         ┌──────────────────────────── OFFLINE (local / cron) ───────────────────────────┐
  seeds/*.csv ──► seed_shops ──► crawl_shops (Playwright) ──► embed_images (CLIP B/32) ──► Supabase
  (+ optional Google Places)        │ artists, IG handles,         │ thumbnails -> Storage    (service role)
                                     │ portfolio image URLs         │ embeddings  -> pgvector
                                     ▼                              ▼
                              shops / artists                portfolio_images.embedding

                         ┌──────────────────────────── ONLINE (Vercel) ─────────────────────────────────┐
  user uploads image ─► transformers.js CLIP B/32 (browser, WebGPU/WASM) ─► 512-d vector
        ─► Supabase RPC search_artists_by_image(vector, metro, k) [anon, RLS read]
        ─► ranked artists + shop + location + matching images + IG link
```

## Components

### Web (`apps/web`)
- **Next.js 15 App Router + TypeScript + Tailwind**, deployed to Vercel Hobby.
- **In-browser embedding** via `@huggingface/transformers` (transformers.js v3) loading
  `Xenova/clip-vit-base-patch32`. Prefers WebGPU, falls back to WASM. The model is fetched
  once and cached by the browser; subsequent searches reuse it.
- **`lib/embedder.ts` / `hooks/useEmbedder.ts`** — lazily construct and cache the image
  feature-extraction pipeline; `embedImage(file) → Float32Array(512)`, L2-normalized.
- **`lib/supabase.ts`** — browser Supabase client (anon key).
- **`lib/search.ts`** — calls the `search_artists_by_image` RPC.
- Pages: `/` (metro picker + dropzone + results), `/artist/[slug]`, `/metro/[slug]`.
- Only network calls from the browser are read-only Supabase RPC/REST. No server compute for
  embeddings.

### Pipeline (`pipeline`)
Python package `tattoo_trap`, run locally or on a cron. Uses the **service role** key.
1. **`seed_shops`** — load shops per metro from `seeds/<metro>.csv` (free default); optional
   Google Places Text Search enrichment behind `GOOGLE_PLACES_API_KEY`. Upserts `shops`.
2. **`crawl_shops`** — Playwright visits each shop website; heuristics discover artist pages,
   Instagram handles, and portfolio image URLs. Respects robots.txt, rate-limits, sets a
   descriptive UA. Upserts `artists` and candidate image URLs.
3. **`embed_images`** — downloads up to ~15 images/artist, downscales to ≤384px thumbnails
   (uploaded to Supabase Storage), embeds the image with CLIP B/32, L2-normalizes, writes
   `portfolio_images` rows with `embedding` + `embedding_model`.
4. **`tag_artists`** *(post-MVP stub)* — one vision pass per artist → `artist_tags`.

### Supabase (`supabase`)
- Postgres + **pgvector** + Storage (bucket `portfolios`).
- Tables: `metros`, `shops`, `artists`, `portfolio_images` (+ post-MVP `artist_tags`).
- **HNSW** index on `portfolio_images.embedding` (`vector_cosine_ops`).
- **RPC** `search_artists_by_image(...)` (SECURITY DEFINER) does the join + ranking so the
  anon client never needs table-wide access.
- **RLS**: public read on display tables; writes only via service role (pipeline).

## Embedding & similarity

- Model: **CLIP ViT-B/32**, 512-dim, L2-normalized embeddings, **cosine** similarity
  (`1 - (a <=> b)` with pgvector).
- **Parity:** the browser (`Xenova/clip-vit-base-patch32`) and pipeline
  (`openai/clip-vit-base-patch32`) must yield comparable vectors. A parity test embeds the
  same image both ways and asserts cosine ≳ 0.99.
- **Ranking:** search portfolio images by cosine, then reduce to artists (best image per
  artist), order by similarity, return top *k* with sample images.
- **Upgrade path:** swap to SigLIP (`siglip-base-patch16-224`, 768-dim) → change model id,
  the `vector(N)` dimension, and re-embed.

## Data model

```
metros (id, name, slug, state, lat, lng)
  └─< shops (id, metro_id, name, address, lat, lng, website,
             instagram_handle, google_place_id, source, created_at)
        └─< artists (id, shop_id, name, slug, instagram_handle, bio,
                     profile_url, avatar_url, created_at)
              └─< portfolio_images (id, artist_id, storage_path, source_url,
                                    width, height, embedding vector(512),
                                    embedding_model, created_at)
artist_tags (artist_id, tag)   -- post-MVP, supplemental only
```

## Cost & limits
- **Vercel Hobby:** static + read-only RPC. No server embedding.
- **Supabase Free:** 500MB DB (512-d vectors are tiny), 1GB Storage (≤384px thumbnails only;
  full images discarded after embedding). Monitor storage; shrink/prune if needed.
- **Embeddings:** open-source CLIP, in-browser (query) + local CPU (pipeline). $0 inference.

## Security
- Browser uses the **anon** key; RLS allows read-only on display tables and the search RPC.
- The pipeline uses the **service role** key locally only (never shipped to the client).
- Instagram is link-out only; no scraping (ToS + blocking).
