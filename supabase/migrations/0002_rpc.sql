-- Tattoo Trap — visual search RPC
-- Given a query embedding (CLIP B/32, 512-d, L2-normalized) and an optional metro slug,
-- return the best-matching artists ranked by cosine similarity, each with a few of their
-- top-matching portfolio images.
--
-- SECURITY DEFINER so the anon client can call it without table-wide read grants beyond RLS.

create or replace function search_artists_by_image(
  query_embedding vector(512),
  metro_slug      text default null,
  match_count     int  default 24
)
returns table (
  artist_id        bigint,
  artist_name      text,
  artist_slug      text,
  artist_instagram text,
  avatar_url       text,
  shop_id          bigint,
  shop_name        text,
  shop_address     text,
  shop_website     text,
  shop_instagram   text,
  lat              double precision,
  lng              double precision,
  metro_name       text,
  metro_slug_out   text,
  similarity       double precision,
  images           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      pi.artist_id,
      pi.storage_path,
      pi.source_url,
      1 - (pi.embedding <=> query_embedding) as sim
    from portfolio_images pi
    join artists a on a.id = pi.artist_id
    join shops   s on s.id = a.shop_id
    join metros  m on m.id = s.metro_id
    where pi.embedding is not null
      and (search_artists_by_image.metro_slug is null
           or m.slug = search_artists_by_image.metro_slug)
  ),
  ranked as (
    select
      scored.*,
      row_number() over (partition by artist_id order by sim desc) as rn
    from scored
  )
  select
    a.id                 as artist_id,
    a.name               as artist_name,
    a.slug               as artist_slug,
    a.instagram_handle   as artist_instagram,
    a.avatar_url,
    s.id                 as shop_id,
    s.name               as shop_name,
    s.address            as shop_address,
    s.website            as shop_website,
    s.instagram_handle   as shop_instagram,
    s.lat,
    s.lng,
    m.name               as metro_name,
    m.slug               as metro_slug_out,
    max(r.sim)           as similarity,
    jsonb_agg(
      jsonb_build_object(
        'storage_path', r.storage_path,
        'source_url',   r.source_url,
        'similarity',   r.sim
      ) order by r.sim desc
    ) filter (where r.rn <= 6) as images
  from ranked r
  join artists a on a.id = r.artist_id
  join shops   s on s.id = a.shop_id
  join metros  m on m.id = s.metro_id
  group by a.id, a.name, a.slug, a.instagram_handle, a.avatar_url,
           s.id, s.name, s.address, s.website, s.instagram_handle, s.lat, s.lng,
           m.name, m.slug
  order by similarity desc
  limit match_count;
$$;

grant execute on function search_artists_by_image(vector, text, int) to anon, authenticated;
