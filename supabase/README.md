# Supabase

Schema, vector search, and RLS for Tattoo Trap.

## Apply migrations

**Option A — Supabase SQL editor (simplest):** open each file in `migrations/` in order
(`0001` → `0008`) and run it.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-ref>
supabase db push
```

## Storage

Create a **public** bucket named `portfolios` (Dashboard → Storage → New bucket → public).
The pipeline uploads downscaled thumbnails here; the web app reads them by public URL.

## What's here

| File | Purpose |
|---|---|
| `0001_init.sql` | `vector` extension, tables, HNSW index |
| `0002_rpc.sql` | `search_artists_by_image(...)` cosine-similarity search RPC |
| `0003_rls.sql` | public read RLS (writes via service role only) |
| `0004_seed_metros.sql` | seed the 4 MVP metros |
| `0008_hidden_artists.sql` | `hidden_artists` queue — hide junk on the live site, delete locally |

## Model dimension

Embeddings are **CLIP ViT-B/32 → 512-dim**. If you switch models (e.g. SigLIP, 768-dim),
change `vector(512)` in `0001` and the RPC signature in `0002`, then re-embed.
