-- Feedback is available only to the service role and database administrators.
create table public.maple_user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_type text not null check (user_type in ('guest','authenticated')),
  category text check (category is null or category in ('오류 및 버그','UI/UX 개선','AI 답변 정확도','신규 기능 제안','서비스 속도 및 성능','기타')),
  title text check (title is null or char_length(title) <= 100),
  content text not null check (char_length(btrim(content)) between 1 and 3000),
  page_path text check (page_path is null or page_path in ('/','/assistant')),
  status text not null default 'pending' check (status in ('pending','reviewing','planned','resolved','dismissed')),
  developer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.maple_user_feedback enable row level security;
revoke all on public.maple_user_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.maple_user_feedback to service_role;
create index maple_user_feedback_created_idx on public.maple_user_feedback(created_at desc);
create function public.touch_maple_feedback() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
create trigger maple_feedback_updated before update on public.maple_user_feedback for each row execute function public.touch_maple_feedback();

-- Short-lived, salted hashes are kept separately and never attached to feedback.
create table public.maple_feedback_rate_limits (
  ip_digest text not null,
  content_digest text not null,
  created_at timestamptz not null default now()
);
create index maple_feedback_rate_time_idx on public.maple_feedback_rate_limits(created_at);
alter table public.maple_feedback_rate_limits enable row level security;
revoke all on public.maple_feedback_rate_limits from public, anon, authenticated;
grant select, insert, delete on public.maple_feedback_rate_limits to service_role;

create function public.submit_maple_feedback(p_user_id uuid,p_category text,p_title text,p_content text,p_page_path text,p_ip_digest text,p_content_digest text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if length(p_ip_digest)<>64 or length(p_content_digest)<>64 or p_ip_digest is null or p_content_digest is null then raise exception 'Invalid request'; end if;
  if p_content is null or char_length(btrim(p_content)) not between 1 and 3000 then raise exception 'Invalid content'; end if;
  if p_title is not null and char_length(p_title)>100 then raise exception 'Invalid title'; end if;
  if p_page_path is not null and p_page_path not in ('/','/assistant') then raise exception 'Invalid path'; end if;
  perform pg_advisory_xact_lock(27191992);
  delete from public.maple_feedback_rate_limits where created_at < now()-interval '24 hours';
  if (select count(*) from public.maple_feedback_rate_limits where ip_digest=p_ip_digest and created_at>now()-interval '1 hour') >= 5 then return 'limited'; end if;
  if (select count(*) from public.maple_feedback_rate_limits where created_at>now()-interval '24 hours') >= 300 then return 'limited'; end if;
  if exists(select 1 from public.maple_feedback_rate_limits where ip_digest=p_ip_digest and content_digest=p_content_digest and created_at>now()-interval '10 minutes') then return 'duplicate'; end if;
  insert into public.maple_user_feedback(user_id,user_type,category,title,content,page_path) values(p_user_id,case when p_user_id is null then 'guest' else 'authenticated' end,p_category,p_title,btrim(p_content),p_page_path);
  insert into public.maple_feedback_rate_limits(ip_digest,content_digest) values(p_ip_digest,p_content_digest);
  return 'saved';
end $$;
revoke all on function public.submit_maple_feedback(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_maple_feedback(uuid,text,text,text,text,text,text) to service_role;
