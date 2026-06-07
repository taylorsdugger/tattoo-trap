-- Track when an artist was last attempted by the Instagram puller.
--
-- IG CDN URLs are signed and change every scrape, so we can't dedupe re-scrapes by source_url.
-- Detecting "already scraped" by the presence of IG images misses artists whose IG is private,
-- empty, or 404 — those yield nothing and would be re-attempted (and re-billed) on every run.
-- This timestamp records *attempts* (success or empty), so the puller skips them by default.
alter table artists
  add column if not exists ig_scraped_at timestamptz;

comment on column artists.ig_scraped_at is
  'When scrape_instagram last attempted this handle (success OR empty). NULL = never attempted. '
  'Set on every attempt so dead/private handles are not re-billed each run; --rescrape ignores it.';
