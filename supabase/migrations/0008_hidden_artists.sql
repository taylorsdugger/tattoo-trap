-- Tattoo Trap — hidden (queued-for-deletion) artists
-- The hard delete (delete-artist route) needs the service-role key, which only exists in
-- apps/web/.env.local — so it only works on localhost. On the deployed site the operator instead
-- *hides* a junk artist: a row here removes it from every public listing immediately, and serves
-- as a queue the operator can review locally (/admin/hidden) and actually delete with the
-- service-role key.
--
-- Writes go through the signed-in operator's own client (their JWT). RLS below permits any
-- authenticated user to insert/delete; the hide UI + /api/admin/hide-artist route already gate on
-- role, and a hide is reversible and visible in the queue, so the blast radius is low. Reads are
-- public so the listings can filter hidden rows out for everyone.

create table if not exists hidden_artists (
  artist_id  bigint primary key references artists(id) on delete cascade,
  hidden_by  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hidden_artists_created_at_idx on hidden_artists(created_at desc);

alter table hidden_artists enable row level security;

-- Public read: listings exclude these ids for everyone.
create policy "public read hidden_artists"
  on hidden_artists for select using (true);

-- Any signed-in user may queue/unqueue a hide (route + UI gate on admin role).
create policy "authenticated insert hidden_artists"
  on hidden_artists for insert with check (auth.uid() is not null);

create policy "authenticated delete hidden_artists"
  on hidden_artists for delete using (auth.uid() is not null);
