create table if not exists public.maple_hunting_maps (
  id text primary key,
  region text not null,
  name text not null,
  symbol integer,
  mobs jsonb not null default '[]'::jsonb,
  image_available boolean not null default false,
  imported_at timestamptz not null default now()
);
create index if not exists maple_hunting_maps_region_name_idx on public.maple_hunting_maps(region, name);
alter table public.maple_hunting_maps enable row level security;
revoke all on public.maple_hunting_maps from anon, authenticated;
grant select on public.maple_hunting_maps to authenticated;
grant select, insert, update, delete on public.maple_hunting_maps to service_role;
create policy "Signed-in users can read hunting maps" on public.maple_hunting_maps for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hunting-images', 'hunting-images', true, 5242880, array['image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
