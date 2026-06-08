-- Tattoo Trap — user-owned favorites
-- Replaces the anonymous localStorage favorites with per-user rows. Keyed by artist_id (FK) so a
-- deleted artist cascades its favorites away automatically. Writes go through the logged-in user's
-- own client (their JWT sets auth.uid()), which the RLS policies below permit for their own rows —
-- the first place anon-key writes are allowed in this app.

create table if not exists favorites (
  user_id    uuid   not null references auth.users(id) on delete cascade,
  artist_id  bigint not null references artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);
create index if not exists favorites_user_id_idx on favorites(user_id);

alter table favorites enable row level security;

create policy "read own favorites"
  on favorites for select using (auth.uid() = user_id);

create policy "insert own favorites"
  on favorites for insert with check (auth.uid() = user_id);

create policy "delete own favorites"
  on favorites for delete using (auth.uid() = user_id);
