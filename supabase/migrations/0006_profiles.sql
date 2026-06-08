-- Tattoo Trap — user profiles + roles
-- Adds Supabase Auth role support. Every auth user gets a `profiles` row (auto-created on signup)
-- holding their role. The OWNER is NOT stored here — it's resolved from the OWNER_EMAIL env var at
-- request time (see apps/web/src/lib/auth.ts), so the operator is owner the instant they log in.
-- ADMINs are elevated manually:  update profiles set role = 'admin' where email = '...';

create type user_role as enum ('user', 'admin', 'owner');

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       user_role not null default 'user',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- A user may read only their own profile. There is intentionally NO insert/update policy for
-- anon/authenticated: role changes happen via the service role / SQL console, so a user can never
-- elevate themselves.
create policy "read own profile"
  on profiles for select using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
