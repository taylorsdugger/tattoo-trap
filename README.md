# Tattoo Trap

Find tattoo artists near you whose work **visually matches** your inspiration image.

Upload a reference tattoo → Tattoo Trap embeds it in your browser and searches a curated
database of local artists' portfolios by **visual similarity** (CLIP + pgvector), returning
ranked artists with their shop, location, and Instagram.

**Metros (MVP):** Chicago IL · Peoria IL · Iowa City IA · Quad Cities (Davenport/Bettendorf
IA + Rock Island/Moline IL)

> See [`plan.md`](./plan.md) for decisions and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the
> technical design.

## How it works

```
You upload an image
  → CLIP embeds it IN YOUR BROWSER (transformers.js, $0 server compute)
  → Supabase pgvector cosine search over artist portfolio embeddings
  → ranked artists + shop + location + matching images + IG link
```

The heavy lifting (crawling shops, downloading + embedding portfolio images) happens **offline**
in a Python pipeline. The web app does read-only similarity search.

## Repo layout (monorepo)

| Path | What | Runs on |
|---|---|---|
| `apps/web` | Next.js 15 (App Router, TS, Tailwind) frontend | Vercel |
| `pipeline` | Python: seed → crawl (Playwright) → embed (CLIP) → ingest | Local / cron |
| `supabase` | SQL migrations: schema, pgvector, RPC, RLS, seed metros | Supabase |

## Quickstart

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the migrations in `supabase/migrations/` (Supabase SQL editor or `supabase db push`).
3. Create a public Storage bucket named `portfolios`.
4. Grab your project URL, `anon` key, and `service_role` key.

### 2. Web app
```bash
cd apps/web
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
npm install
npm run dev                  # http://localhost:3000
```

### 3. Pipeline
```bash
cd pipeline
cp .env.example .env         # fill SUPABASE_URL + SERVICE_ROLE_KEY
uv sync                      # or: python -m venv .venv && pip install -e .
python -m playwright install chromium
python -m tattoo_trap.seed_shops --metro chicago                 # from seeds/chicago.csv
# optional: enrich from Google Places (needs GOOGLE_PLACES_API_KEY; cost-capped in config)
python -m tattoo_trap.seed_shops --metro chicago --source places
python -m tattoo_trap.crawl_shops --metro chicago
python -m tattoo_trap.embed_images --metro chicago
```

## Cost

Designed to run at **$0**: Vercel Hobby + Supabase Free + open-source CLIP embeddings
(in-browser for queries, local for the pipeline). No paid inference APIs.

## Status

MVP scaffold. See `plan.md` build order for what's next.
