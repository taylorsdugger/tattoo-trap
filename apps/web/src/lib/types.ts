export type Metro = {
  id: number;
  name: string;
  slug: string;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

export type MatchImage = {
  storage_path: string | null;
  source_url: string | null;
  similarity: number;
};

// Row shape returned by the `search_artists_by_image` RPC.
export type ArtistMatch = {
  artist_id: number;
  artist_name: string;
  artist_slug: string;
  artist_instagram: string | null;
  avatar_url: string | null;
  shop_id: number;
  shop_name: string;
  shop_address: string | null;
  shop_website: string | null;
  shop_instagram: string | null;
  lat: number | null;
  lng: number | null;
  metro_name: string;
  metro_slug_out: string;
  similarity: number;
  images: MatchImage[] | null;
};

export type Artist = {
  id: number;
  shop_id: number;
  name: string;
  slug: string;
  instagram_handle: string | null;
  bio: string | null;
  profile_url: string | null;
  avatar_url: string | null;
};

export type Shop = {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  instagram_handle: string | null;
  lat: number | null;
  lng: number | null;
};

export type PortfolioImage = {
  id: number;
  artist_id: number;
  storage_path: string | null;
  source_url: string | null;
  width: number | null;
  height: number | null;
};

// Shape returned by the artist-directory query (artists with embedded shop + metro + sample images).
export type DirectoryArtist = {
  id: number;
  name: string;
  slug: string;
  instagram_handle: string | null;
  avatar_url: string | null;
  shop: {
    id: number;
    name: string;
    address: string | null;
    website: string | null;
    instagram_handle: string | null;
    metro: { name: string; slug: string } | null;
  } | null;
  images: { storage_path: string | null; source_url: string | null }[] | null;
};
