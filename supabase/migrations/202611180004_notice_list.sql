-- Expose only the public notice listing to signed-in users.
create or replace function public.list_maple_notices(p_type text default 'all', p_offset integer default 0)
returns table (notice_type text, notice_id bigint, title text, source_url text, notice_date text)
language sql stable security definer
set search_path = public
as $$
  select n.notice_type, n.notice_id, n.title, n.source_url, n.notice_date
  from public.maple_notices n
  where p_type = 'all' or n.notice_type = p_type
  order by n.notice_date desc, n.notice_id desc, n.notice_type
  limit 21 offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;
revoke all on function public.list_maple_notices(text, integer) from public, anon;
grant execute on function public.list_maple_notices(text, integer) to authenticated;
