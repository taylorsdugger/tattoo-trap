-- Tattoo Trap — seed metro areas (MVP)
-- Idempotent: re-running updates coordinates/names without duplicating.

insert into metros (name, slug, state, lat, lng) values
  ('Chicago',     'chicago',     'IL',    41.8781, -87.6298),
  ('Peoria',      'peoria',      'IL',    40.6936, -89.5890),
  ('Iowa City',   'iowa-city',   'IA',    41.6611, -91.5302),
  ('Quad Cities', 'quad-cities', 'IA/IL', 41.5236, -90.5776)
on conflict (slug) do update
  set name  = excluded.name,
      state = excluded.state,
      lat   = excluded.lat,
      lng   = excluded.lng;
