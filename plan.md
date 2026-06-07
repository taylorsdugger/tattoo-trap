# Tattoo Trap — Plan & Decision Log

> Living document. Captures the goal, the decisions we locked, and why.

## Goal

**Tattoo Trap** is a personal, zero/low-cost web app for discovering tattoo artists in a
small set of Midwest metros whose work **visually matches** a reference image. A user uploads
a tattoo inspiration photo and gets back ranked artists near them who create similar work —
with shop, location, portfolio images, and an Instagram link.

The core value is a **curated database of artists + portfolio images** combined with **fast
visual similarity search** — not the AI itself. Matching uses open-source CLIP image
embeddings stored in Postgres `pgvector`. We deliberately avoid per-image LLM calls.

Answers the question: *"Given this tattoo inspiration, which artists near me make similar work?"*

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Query-image embedding | **In-browser** (transformers.js / ONNX, WebGPU+WASM fallback) | $0 server compute, no cold starts, infinite scale. Only ever embeds one image per search. One-time cached model download. |
| Repo layout | **Monorepo**: `apps/web`, `pipeline`, `supabase` | Single source of truth for schema/types. |
| Metros (seed) | **Chicago IL, Peoria IL, Iowa City IA, Quad Cities** (Davenport/Bettendorf IA + Rock Island/Moline IL) | Tight Midwest cluster to validate. Adding metros later = DB rows, no code change. |
| Instagram | **Handle stored + link out + paid-scraper image ingest.** Portfolio images sourced from artists' public IG posts via Apify (`make scrape-ig`), embedded then **discarded** — only ≤384px thumbnails kept. Shop-site images remain a secondary source; manual curation still covers gaps. | Shop sites gave thin, low-res, stale images — bad for both browsing and CLIP match quality. IG is where artists post their best current work. A *paid* scraper buys away the fragility/blocking that made direct scraping risky (it runs the proxies). Transient processing of public images + thumbnails-only keeps it ToS-defensible and storage-light. Spend hard-capped at the Apify free monthly credit (console spend limit + in-stage real-spend guard). |
| Embedding model | **CLIP ViT-B/32, 512-dim** | Smallest/fastest, well-supported in transformers.js. Browser `Xenova/clip-vit-base-patch32`, pipeline `openai/clip-vit-base-patch32`. Upgrade path: SigLIP (768-dim). |
| Hosting | **Vercel Hobby + Supabase Free** | All free-tier. |

### Why in-browser embedding is safe here
The heavy work (embedding thousands of portfolio images) happens **offline** in the Python
pipeline. The browser only ever embeds the **single** uploaded query image, so there is no
"can it scale under load" problem — each user's device embeds its own one image. Cons are a
one-time ~30–90MB cached model download and a slightly slow first inference; both are fine.

### Model parity is critical
Browser and pipeline must produce comparable vectors. We pin the same CLIP checkpoint,
L2-normalize both sides, compare with cosine, and guard it with a parity test that embeds the
same image in both and asserts cosine ≳ 0.99.

## Architecture

```
tattoo-trap/
  apps/web/        Next.js 15 (App Router, TS, Tailwind) -> Vercel
  pipeline/        Python: seed -> crawl -> download -> embed -> ingest -> Supabase
  supabase/        SQL migrations: schema, pgvector, RPC, RLS, seed metros
```

**Data flow**
1. **Pipeline (offline, local/cron, service-role key):** seed shops (CSV, optional Google
   Places) → Playwright crawl shop sites (artists, IG handles, image URLs) → download a
   sample of portfolio images → downscale to thumbnails (Supabase Storage) → CLIP-embed →
   write `portfolio_images` rows with `embedding`.
2. **Web (Vercel, anon key, read-only via RLS):** user picks metro + uploads image →
   transformers.js embeds it in the browser → calls Supabase RPC `search_artists_by_image`
   with the 512-dim vector → renders ranked artist cards.

## Data model (Supabase / Postgres + pgvector)
- **metros** `(id, name, slug, state, lat, lng)`
- **shops** `(id, metro_id, name, address, lat, lng, website, instagram_handle, google_place_id, source, created_at)`
- **artists** `(id, shop_id, name, slug, instagram_handle, bio, profile_url, avatar_url, created_at)`
- **portfolio_images** `(id, artist_id, storage_path, source_url, width, height, embedding vector(512), embedding_model, created_at)` — HNSW index `vector_cosine_ops`
- **artist_tags** *(post-MVP)* `(artist_id, tag)` — supplemental style metadata only

RPC `search_artists_by_image(query_embedding vector(512), metro_slug text, match_count int)`
(SECURITY DEFINER) joins images→artists→shops→metros, filters by metro, ranks by cosine
similarity, returns best-matching artists with sample images.

## Build order
1. ✅ Scaffold + docs (this file, README, ARCHITECTURE)
2. Supabase schema + RPC + RLS + seed metros
3. Pipeline skeleton: seed → crawl → embed; run on a few Chicago shops
4. Web search path: supabase client, MetroPicker, useEmbedder, search RPC, results UI
5. Detail pages: `/artist/[slug]`, `/metro/[slug]`
6. Parity test + polish + deploy to Vercel
7. Post-MVP: tag enrichment, manual-curation admin, more metros/shops

## Cost posture (target $0)
- Vercel Hobby: static + read-only RPCs, no server embedding compute.
- Supabase Free: 500MB DB (vectors are tiny), 1GB Storage (thumbnails only, ≤384px).
- Embedding: open-source CLIP, in-browser (query) + local (pipeline). No paid inference.
- Google Places optional, behind a key, within free credit.

## Open risks
- Shop-site crawlers are heuristic — start permissive, refine per site.
- Watch Supabase Storage; shrink/prune thumbnails if pressure grows.
- **IG image quality:** validate with `make probe-ig` before a full backfill; the `is_tattoo`
  gate filters non-tattoo posts but eats scrape budget doing so.
- **IG URL expiry:** signed CDN URLs die in hours, so scrape → embed must run back-to-back
  (`make pipeline-ig`); embed drops dead-URL rows. Already handled, but don't split the steps.
- **Budget:** whole-DB backfill is ~$10 of Apify, but the free $5/mo credit covers ~140
  artists/month — spread across two months it's $0. Hard-capped two ways so it can't overspend.
  A RapidAPI fallback source (drop-in via `ImageSource`) can cover leftovers without waiting
  for the monthly reset; not built yet (YAGNI until the wall is actually hit).
