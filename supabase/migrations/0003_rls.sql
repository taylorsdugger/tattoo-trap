-- Tattoo Trap — Row Level Security
-- Display tables are publicly readable. All writes happen via the service-role key from the
-- offline pipeline (service role bypasses RLS), so no write policies are defined for anon.

alter table metros           enable row level security;
alter table shops            enable row level security;
alter table artists          enable row level security;
alter table portfolio_images enable row level security;

-- Public read-only access.
create policy "public read metros"
  on metros for select using (true);

create policy "public read shops"
  on shops for select using (true);

create policy "public read artists"
  on artists for select using (true);

create policy "public read portfolio_images"
  on portfolio_images for select using (true);
