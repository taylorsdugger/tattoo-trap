# Web (apps/web)

Next.js 15 (App Router, TypeScript, Tailwind v4) frontend for Tattoo Trap. Deploys to Vercel.

## Develop

```bash
cp .env.example .env.local     # set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev                    # http://localhost:3000
```

## How search works

1. User picks a metro and drops a tattoo inspiration image.
2. `lib/embedder.ts` lazily loads CLIP (`Xenova/clip-vit-base-patch32`) via transformers.js and
   embeds the image **in the browser** (WebGPU, WASM fallback) → L2-normalized 512-d vector.
3. `lib/search.ts` calls the Supabase RPC `search_artists_by_image(vector, metro, k)`.
4. Results render as ranked `ArtistCard`s.

No server compute is used for embeddings; the only network calls are read-only Supabase RPCs.

## Layout

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | home — metro picker + dropzone + results |
| `src/app/artist/[slug]/page.tsx` | artist detail + portfolio grid |
| `src/app/metro/[slug]/page.tsx` | browse shops/artists in a metro |
| `src/lib/embedder.ts` | in-browser CLIP embedding |
| `src/lib/search.ts` | similarity-search RPC call |
| `src/lib/supabase.ts` | anon Supabase client |
| `src/lib/images.ts` | Storage public-URL helpers |
| `src/components/*` | UI (SearchExperience, MetroPicker, ImageDropzone, ArtistCard, …) |

## Deploy to Vercel

Set the root directory to `apps/web`, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars, and deploy. Free Hobby tier is sufficient.
