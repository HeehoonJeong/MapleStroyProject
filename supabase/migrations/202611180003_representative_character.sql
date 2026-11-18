create table if not exists public.maple_user_representative_characters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character_name text not null,
  world_name text,
  character_class text,
  character_level integer,
  character_exp_rate text,
  character_guild_name text,
  character_image text,
  combat_power text,
  main_stats jsonb not null default '{}'::jsonb,
  boss_damage text,
  ignore_defense text,
  union_level bigint,
  union_grade text,
  union_artifact_level bigint,
  dojang_best_floor integer,
  dojang_best_time integer,
  data_date text,
  synced_at timestamptz not null default now()
);

alter table public.maple_user_representative_characters enable row level security;
revoke all on public.maple_user_representative_characters from anon, authenticated;

drop policy if exists "Users read their own representative character" on public.maple_user_representative_characters;
create policy "Users read their own representative character"
  on public.maple_user_representative_characters
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.maple_user_representative_characters to authenticated;
grant select, insert, update, delete on public.maple_user_representative_characters to service_role;

-- A snapshot is kept per successful lookup; raw endpoint payloads include item options.
create table if not exists public.maple_character_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ocid text not null,
  character_name text not null,
  data_date date not null,
  responses jsonb not null default '{}'::jsonb,
  failures jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists maple_character_snapshots_user_created_idx
  on public.maple_character_snapshots (user_id, created_at desc);
create index if not exists maple_character_snapshots_ocid_date_idx
  on public.maple_character_snapshots (ocid, data_date desc);
alter table public.maple_character_snapshots enable row level security;
revoke all on public.maple_character_snapshots from anon, authenticated;
create policy "Users read their own character snapshots" on public.maple_character_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.maple_character_snapshots to authenticated;
grant select, insert, update, delete on public.maple_character_snapshots to service_role;
grant usage, select on sequence public.maple_character_snapshots_id_seq to service_role;

-- Nexon requires API data to be refreshed at least every 30 days. Remove
-- inactive snapshots and profiles before they become stale; a new lookup restores them.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('maple-character-data-expiry', '0 18 * * *', $$
  delete from public.maple_character_snapshots where created_at < now() - interval '29 days';
  delete from public.maple_user_representative_characters where synced_at < now() - interval '29 days';
$$);
