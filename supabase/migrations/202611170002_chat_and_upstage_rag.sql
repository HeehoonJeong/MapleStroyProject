-- Keep any existing 1536-dimensional rows intact; Upstage uses its own vector space.
create table if not exists public.maple_guide_chunks_upstage (
  id bigint generated always as identity primary key,
  content text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now()
);

create index if not exists maple_guide_chunks_upstage_embedding_idx
  on public.maple_guide_chunks_upstage using hnsw (embedding extensions.vector_cosine_ops);

alter table public.maple_guide_chunks_upstage enable row level security;
revoke all on public.maple_guide_chunks_upstage from anon, authenticated;
grant select, insert, update, delete on public.maple_guide_chunks_upstage to service_role;

create or replace function public.match_maple_guide_chunks_upstage(
  query_embedding extensions.vector(1024),
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (
  content text,
  source text,
  title text,
  url text,
  similarity float
)
language sql stable security definer
set search_path = public, extensions
as $$
  select
    chunk.content,
    chunk.source,
    coalesce(chunk.metadata->>'title', chunk.source) as title,
    nullif(chunk.metadata->>'url', '') as url,
    (1 - (chunk.embedding <=> query_embedding))::float as similarity
  from public.maple_guide_chunks_upstage as chunk
  where 1 - (chunk.embedding <=> query_embedding) >= match_threshold
  order by chunk.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 8);
$$;

revoke all on function public.match_maple_guide_chunks_upstage(extensions.vector, int, float) from public, anon, authenticated;
grant execute on function public.match_maple_guide_chunks_upstage(extensions.vector, int, float) to service_role;

create table if not exists public.maple_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '새 대화',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.maple_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (room_id, user_id)
    references public.maple_chat_rooms(id, user_id) on delete cascade
);

create index if not exists maple_chat_rooms_user_updated_idx
  on public.maple_chat_rooms(user_id, updated_at desc);
create index if not exists maple_chat_messages_room_created_idx
  on public.maple_chat_messages(room_id, created_at);

alter table public.maple_chat_rooms enable row level security;
alter table public.maple_chat_messages enable row level security;

drop policy if exists "Users manage their own chat rooms" on public.maple_chat_rooms;
create policy "Users manage their own chat rooms"
  on public.maple_chat_rooms for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own chat messages" on public.maple_chat_messages;
create policy "Users manage their own chat messages"
  on public.maple_chat_messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.maple_chat_rooms to authenticated;
grant select, insert, update, delete on public.maple_chat_messages to authenticated;

create or replace function public.touch_maple_chat_room()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.maple_chat_rooms
  set updated_at = now()
  where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists maple_chat_message_touch_room on public.maple_chat_messages;
create trigger maple_chat_message_touch_room
  after insert on public.maple_chat_messages
  for each row execute function public.touch_maple_chat_room();
