-- Tattoo Trap — initial schema
-- Postgres + pgvector. Embeddings are CLIP ViT-B/32 (512-dim), cosine similarity.

create extension if not exists vector;

-- Metro areas we curate. Adding a metro later = inserting a row (no code change).
create table if not exists metros (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  state      text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

-- Tattoo shops, scoped to a metro.
create table if not exists shops (
  id               bigint generated always as identity primary key,
  metro_id         bigint not null references metros(id) on delete cascade,
  name             text not null,
  address          text,
  lat              double precision,
  lng              double precision,
  website          text,
  instagram_handle text,
  google_place_id  text unique,
  source           text,                       -- 'csv' | 'google_places' | 'manual'
  created_at       timestamptz not null default now()
);
create index if not exists shops_metro_id_idx on shops(metro_id);

-- Artists belong to a shop.
create table if not exists artists (
  id               bigint generated always as identity primary key,
  shop_id          bigint not null references shops(id) on delete cascade,
  name             text not null,
  slug             text not null unique,
  instagram_handle text,
  bio              text,
  profile_url      text,                        -- artist page on shop site
  avatar_url       text,
  created_at       timestamptz not null default now()
);
create index if not exists artists_shop_id_idx on artists(shop_id);

-- A representative sample of portfolio images per artist, with their CLIP embedding.
create table if not exists portfolio_images (
  id              bigint generated always as identity primary key,
  artist_id       bigint not null references artists(id) on delete cascade,
  storage_path    text,                         -- path in the `portfolios` Storage bucket
  source_url      text,                         -- original image URL (dedupe key)
  width           int,
  height          int,
  embedding       vector(512),
  embedding_model text,                         -- e.g. 'openai/clip-vit-base-patch32'
  created_at      timestamptz not null default now(),
  unique (artist_id, source_url)
);
create index if not exists portfolio_images_artist_id_idx on portfolio_images(artist_id);

-- HNSW index for fast cosine ANN search over normalized embeddings.
create index if not exists portfolio_images_embedding_idx
  on portfolio_images
  using hnsw (embedding vector_cosine_ops);
