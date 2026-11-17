create extension if not exists vector with schema extensions;

create table if not exists public.maple_guide_chunks (
  id bigint generated always as identity primary key,
  content text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists maple_guide_chunks_embedding_idx
  on public.maple_guide_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.maple_guide_chunks enable row level security;

create or replace function public.match_maple_guide_chunks(
  query_embedding extensions.vector(1536),
  match_count int default 4,
  match_threshold float default 0.25
)
returns table (content text, source text, similarity float)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    chunk.content,
    chunk.source,
    1 - (chunk.embedding <=> query_embedding) as similarity
  from public.maple_guide_chunks as chunk
  where 1 - (chunk.embedding <=> query_embedding) >= match_threshold
  order by chunk.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 8);
$$;

revoke all on function public.match_maple_guide_chunks(extensions.vector, int, float) from public, anon, authenticated;
grant execute on function public.match_maple_guide_chunks(extensions.vector, int, float) to service_role;

create table if not exists public.maple_ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default date_trunc('minute', now()),
  request_count int not null default 0
);

alter table public.maple_ai_usage enable row level security;

create or replace function public.consume_maple_ai_quota(p_user_id uuid, p_limit int default 8)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.maple_ai_usage as quota_row (user_id, window_start, request_count)
  values (p_user_id, date_trunc('minute', now()), 1)
  on conflict (user_id) do update set
    window_start = case
      when quota_row.window_start < date_trunc('minute', now()) then date_trunc('minute', now())
      else quota_row.window_start
    end,
    request_count = case
      when quota_row.window_start < date_trunc('minute', now()) then 1
      else quota_row.request_count + 1
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_maple_ai_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.consume_maple_ai_quota(uuid, int) to service_role;
