-- Replace the initial notice search function with date-aware, per-notice results.
drop function if exists public.match_maple_notice_chunks_upstage(
  extensions.vector, integer, double precision, text
);

create function public.match_maple_notice_chunks_upstage(
  query_embedding extensions.vector(1024),
  match_count int default 6,
  match_threshold float default 0.3,
  filter_notice_type text default null,
  filter_start_date date default null,
  filter_end_date date default null
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
  with nearest_chunks as (
    select
      chunk.notice_pk,
      chunk.title,
      chunk.source_url,
      chunk.notice_type,
      chunk.notice_id,
      chunk.notice_date,
      chunk.content,
      (chunk.embedding <=> query_embedding) as distance
    from public.maple_notice_chunks as chunk
    where (filter_notice_type is null or chunk.notice_type = filter_notice_type)
      and (
        filter_start_date is null
        or left(chunk.notice_date, 10)::date >= filter_start_date
      )
      and (
        filter_end_date is null
        or left(chunk.notice_date, 10)::date <= filter_end_date
      )
    order by chunk.embedding <=> query_embedding
    limit least(greatest(match_count, 1) * 8, 80)
  ), ranked_chunks as (
    select
      nearest_chunks.*,
      (1 - nearest_chunks.distance)::float as similarity,
      row_number() over (partition by notice_pk order by distance) as chunk_rank
    from nearest_chunks
    where 1 - nearest_chunks.distance >= match_threshold
  ), one_row_per_notice as (
    select
      notice_pk,
      title,
      source_url,
      notice_type,
      notice_id,
      notice_date,
      string_agg(content, E'\n\n' order by distance) as content,
      max(similarity)::float as similarity
    from ranked_chunks
    where chunk_rank <= 2
    group by notice_pk, title, source_url, notice_type, notice_id, notice_date
  )
  select
    result.content,
    result.title,
    result.source_url as source,
    result.source_url as url,
    result.notice_type,
    result.notice_id,
    result.notice_date,
    result.similarity
  from one_row_per_notice as result
  order by result.similarity desc
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_maple_notice_chunks_upstage(
  extensions.vector, integer, double precision, text, date, date
) from public, anon, authenticated;
grant execute on function public.match_maple_notice_chunks_upstage(
  extensions.vector, integer, double precision, text, date, date
) to service_role;
