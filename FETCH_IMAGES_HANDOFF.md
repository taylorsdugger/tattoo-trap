# Handoff: make the "fetch images" button work on the live-deployed site

Paste everything below into a new Claude Code session in this repo
(`/Users/tdugger/dev/tattoo-trap`).

---

## Context / goal

We added a dev-only button that backfills an artist's portfolio images on demand via a
**RapidAPI** Instagram scraper (so it doesn't burn Apify credits), then runs the existing CLIP
**embed** step so the images appear. It works **locally** today.

The goal now is **"admin-click live, embed later"**:
- The button should work on the **live deployed site** (Vercel/serverless) **for the admin only**
  (gated by a secret token — NOT public, or visitors will burn the RapidAPI quota).
- On live it should **queue candidates only** (pure JS — RapidAPI fetch + insert into Supabase).
- The CLIP **embedding runs out-of-band** on a schedule (a worker that has Python/CLIP), so the
  images appear minutes later, not instantly.

**Why it can't fully run live as-is:** Vercel serverless can't run the Python pipeline / CLIP
(no venv, too big, time limits). Good news: the route already calls `embedArtist()` which
`existsSync`-checks the venv and **no-ops when it's absent** — so on Vercel it naturally becomes
queue-only. Also note **local and live share the same hosted Supabase**, so anything embedded
(locally or by the worker) shows up on the live site automatically.

---

## Current state (already built + verified: `tsc`, `next lint`, `py_compile` all pass)

**Web (`apps/web/`):**
- `src/lib/instagram.ts` — provider-agnostic RapidAPI fetch. Reads env: `RAPIDAPI_KEY`,
  `RAPIDAPI_INSTAGRAM_HOST`, `RAPIDAPI_INSTAGRAM_URL`, `RAPIDAPI_INSTAGRAM_METHOD` (GET/POST),
  `RAPIDAPI_INSTAGRAM_BODY` (form template). Substitutes `{handle}`, deep-harvests
  cdninstagram/fbcdn image URLs from any JSON shape, dedupes by media id, caps at 15.
  Exports `fetchInstagramImageUrls(handle)` and `normalizeHandle(raw)`.
- `src/app/api/fetch-images/route.ts` — `POST { id, fresh }`. Currently **dev-only** (404 in
  prod — THIS IS WHAT WE'RE CHANGING). Validates handle; if `fresh`, clears the artist's existing
  `portfolio_images` rows + storage thumbnails first; fetches URLs; inserts candidates (dedupes
  on the `(artist_id, source_url)` unique constraint); stamps `ig_scraped_at`; calls
  `embedArtist(id)` (spawns `pipeline/.venv/bin/python -m tattoo_trap.embed_images --artist <id>`,
  no-ops if venv missing); counts displayable images; returns `{ found, inserted, visible, message }`.
- `src/components/FetchImagesButton.tsx` — variants `full` (detail page) + `icon` (cards). `fresh`
  prop = destructive re-pull (confirm dialog, `⟳` glyph) vs additive (`↧`). **Self-gates to dev**
  via `if (process.env.NODE_ENV !== "development") return null` — THIS IS WHAT WE'RE CHANGING.
- Buttons are wired into: `src/app/artist/[slug]/page.tsx` (full, when 0 images + handle),
  `src/components/ArtistDirectoryCard.tsx` and `src/components/ArtistCard.tsx` (icon; additive when
  0 images, fresh re-pull when >0 images).
- `.env.example` — documents the `RAPIDAPI_*` vars. `.env.local` has real values (gitignored).

**Pipeline (`pipeline/`):**
- `src/tattoo_trap/embed_images.py` — refactored: shared `_embed_rows(rows, label)`, plus
  `embed_metro(slug)` and `embed_artist(id)`. CLI now takes `--metro` OR `--artist`.
  `make embed METRO=…` still works unchanged.
- `src/tattoo_trap/db.py` — has `unembedded_images_for_artists(ids)` (line ~210). NO global
  "all pending" helper yet.

---

## Remaining work

### 1. Route auth (replace dev-only gate with admin-token gate)
In `apps/web/src/app/api/fetch-images/route.ts`, replace:
```ts
if (process.env.NODE_ENV !== "development") {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
```
with a check that allows **dev OR a valid admin token**:
```ts
const isDev = process.env.NODE_ENV === "development";
const adminToken = process.env.ADMIN_TOKEN;
const provided = req.headers.get("x-admin-token");
const authed = isDev || (!!adminToken && provided === adminToken);
if (!authed) return NextResponse.json({ error: "Not available" }, { status: 404 }); // stealth 404
```
Keep requiring `SUPABASE_SERVICE_ROLE_KEY` (already there).

### 2. Client admin gate (so the button shows on live only for the admin, and sends the token)
- New file `apps/web/src/lib/admin.ts`:
  - `readAdminToken()`: client-only. If `?admin=<token>` is in the URL, persist it to
    `localStorage["tt_admin_token"]`; return the stored token (or null).
  - `useAdminToken()`: React hook — `useState(null)` + `useEffect(() => setToken(readAdminToken()), [])`
    (read in effect to avoid SSR/hydration mismatch).
- In `FetchImagesButton.tsx`:
  - Replace `if (process.env.NODE_ENV !== "development") return null` with:
    ```ts
    const adminToken = useAdminToken();
    const enabled = process.env.NODE_ENV === "development" || !!adminToken;
    if (!enabled) return null;
    ```
    (Render null until the effect runs, so nothing flashes for normal visitors.)
  - In the `fetch("/api/fetch-images", …)` call, add header `"x-admin-token": adminToken ?? ""`.
- Admin UX: visit `https://<site>/artists?admin=THE_SECRET` once → token stored → buttons appear.

### 3. Queue-only message on live (distinguish "embed will run later" from a real failure)
Refactor `embedArtist()` in the route to return `{ ran: boolean, ok: boolean, detail: string }`
(`ran=false` when the venv is missing — the normal Vercel case). Then adjust the message block:
- `visible > 0` → `Added ${visible} image(s).`
- `inserted > 0 && !ran` → `Queued ${inserted} image(s) — they'll appear after the next embed run.`
- `inserted > 0 && ran && !ok` → `Queued ${inserted}, but auto-embed failed — run \`make embed\`. (…)`
- `inserted > 0 && ran && ok but visible 0` → `Queued ${inserted}, but none passed the tattoo filter.`
- else → `No new images found for this handle.`

### 4. `embed --all` primitive (so a scheduled worker can embed everything pending)
- In `pipeline/src/tattoo_trap/db.py`, add `unembedded_images(limit: int | None = None)` that
  selects all `portfolio_images` rows where `embedding is null` (mirror
  `unembedded_images_for_artists` but without the artist filter; support an optional limit/batch).
- In `embed_images.py`, add `embed_all(limit=None)` calling `_embed_rows(db.unembedded_images(limit), "across all pending candidates")`,
  and add an `--all` flag to `main()` (one of `--metro` / `--artist` / `--all` required).
- Add a `Makefile` target `embed-pending: ; $(PIPELINE_PY) -m tattoo_trap.embed_images --all`.

### 5. Scheduled worker (pick ONE; ask the user which they want)
The worker needs Python + CLIP + the pipeline's `.env` (Supabase URL + **service role key**).
- **Option A — GitHub Actions cron** (`.github/workflows/embed.yml`): on a schedule
  (e.g. every 30 min), checkout, set up Python, `cd pipeline && pip install -e .` (or uv),
  `playwright install` NOT needed for embed, write `.env` from GH secrets, run
  `python -m tattoo_trap.embed_images --all`. ⚠️ Installing torch/CLIP per run is heavy/slow —
  cache pip + the model, or use a CPU torch wheel. Add repo secrets:
  `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (check exactly what
  `pipeline/src/tattoo_trap/config.py` + `db.py` read).
- **Option B — the user's Mac** (simplest, but only runs when the Mac is on): a `launchd`/cron
  entry running `cd /Users/tdugger/dev/tattoo-trap && make embed-pending` every N minutes.
- **Option C — always-on host** (Railway/Render/Fly/Modal): a tiny scheduled job running
  `embed --all`. Keeps CLIP warm; costs a bit.

### 6. Config / secrets / deploy
- Add `ADMIN_TOKEN` to `apps/web/.env.example` (server-side only) and set it in **Vercel env**.
- Set in Vercel env (server-side): `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`,
  `RAPIDAPI_INSTAGRAM_HOST`, `RAPIDAPI_INSTAGRAM_URL`, `RAPIDAPI_INSTAGRAM_METHOD`,
  `RAPIDAPI_INSTAGRAM_BODY`, `ADMIN_TOKEN`.
- The RapidAPI plan is **20 requests/month hard limit** — applies to live clicks too. Consider a
  small server-side rate limit / a confirm on the live button.

### 7. Security follow-ups
- The admin token is a client-held bearer secret (URL → localStorage). Fine for a solo admin; it
  is NOT real auth. Don't expose anything destructive beyond this without proper auth.
- **Rotate the RapidAPI key** — it was pasted into a chat earlier in development.
- `fresh` re-pull deletes images first; on live (queue-only) the artist will look empty until the
  worker embeds. Consider warning the admin, or queue-then-embed before deleting.

---

## Verify when done
```
cd apps/web && npx tsc --noEmit && npx next lint --dir src
python3 -m py_compile pipeline/src/tattoo_trap/embed_images.py pipeline/src/tattoo_trap/db.py
```
Then: deploy, visit `/artists?admin=THE_SECRET` on the live site, click ↧ on an artist with no
images → expect "Queued N — they'll appear after the next embed run." Trigger the worker (or wait
for cron) → refresh → images appear.

## Don't re-do
The RapidAPI source, the button (full + icon + fresh), card wiring, `embed_artist`/`--artist`,
and the local auto-embed are all DONE and working locally. Only items 1–7 above remain.
Nothing is committed yet — it's all in the working tree.
