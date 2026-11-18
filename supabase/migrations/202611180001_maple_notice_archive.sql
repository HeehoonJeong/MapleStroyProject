create table if not exists public.maple_notices (
  id uuid primary key default gen_random_uuid(),
  notice_type text not null check (notice_type in ('notice', 'update', 'event', 'cashshop')),
  notice_id bigint not null,
  title text not null,
  source_url text not null,
  notice_date text not null,
  contents text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  synced_at timestamptz not null default now(),
  unique (notice_type, notice_id)
);

create index if not exists maple_notices_date_idx
  on public.maple_notices (notice_date desc);
create index if not exists maple_notices_type_date_idx
  on public.maple_notices (notice_type, notice_date desc);

alter table public.maple_notices enable row level security;
revoke all on public.maple_notices from anon, authenticated;
grant select, insert, update, delete on public.maple_notices to service_role;

create table if not exists public.maple_notice_chunks (
  id bigint generated always as identity primary key,
  notice_pk uuid not null references public.maple_notices(id) on delete cascade,
  notice_type text not null,
  notice_id bigint not null,
  chunk_index int not null,
  title text not null,
  source_url text not null,
  notice_date text not null,
  content text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (notice_pk, chunk_index)
);

create index if not exists maple_notice_chunks_embedding_idx
  on public.maple_notice_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists maple_notice_chunks_type_date_idx
  on public.maple_notice_chunks (notice_type, notice_date desc);

alter table public.maple_notice_chunks enable row level security;
revoke all on public.maple_notice_chunks from anon, authenticated;
grant select, insert, update, delete on public.maple_notice_chunks to service_role;
grant usage, select on sequence public.maple_notice_chunks_id_seq to service_role;

create or replace function public.match_maple_notice_chunks_upstage(
  query_embedding extensions.vector(1024),
  match_count int default 6,
  match_threshold float default 0.3,
  filter_notice_type text default null
)
returns table (
  content text,
  title text,
  source text,
  url text,
  notice_type text,
  notice_id bigint,
  notice_date text,
  similarity float
)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    chunk.content,
    chunk.title,
    chunk.source_url as source,
    chunk.source_url as url,
    chunk.notice_type,
    chunk.notice_id,
    chunk.notice_date,
    (1 - (chunk.embedding <=> query_embedding))::float as similarity
  from public.maple_notice_chunks as chunk
  where (filter_notice_type is null or chunk.notice_type = filter_notice_type)
    and 1 - (chunk.embedding <=> query_embedding) >= match_threshold
  order by chunk.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_maple_notice_chunks_upstage(extensions.vector, int, float, text)
  from public, anon, authenticated;
grant execute on function public.match_maple_notice_chunks_upstage(extensions.vector, int, float, text)
  to service_role;
