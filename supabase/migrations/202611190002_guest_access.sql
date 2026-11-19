-- Public read access only for non-personal content already used by the site.
grant execute on function public.list_maple_notices(text, integer) to anon;
grant select on public.maple_hunting_maps to anon;
create policy "Guests can read hunting maps" on public.maple_hunting_maps for select to anon using (true);

-- Server-only shared guest request budget and concurrency leases; no guest account/chat rows.
create table public.maple_guest_requests (
  id uuid primary key default gen_random_uuid(),
  ip_digest text not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index maple_guest_requests_ip_time_idx on public.maple_guest_requests (ip_digest, created_at desc);
create index maple_guest_requests_time_idx on public.maple_guest_requests (created_at desc);
alter table public.maple_guest_requests enable row level security;
revoke all on public.maple_guest_requests from public, anon, authenticated;
grant select, insert, update, delete on public.maple_guest_requests to service_role;
create function public.acquire_maple_guest_request(p_ip_digest text, p_per_minute int default 4, p_daily_total int default 500, p_concurrent int default 2)
returns uuid language plpgsql security definer set search_path=public as $$
declare lease_id uuid;
begin
  if p_ip_digest is null or length(p_ip_digest) <> 64 then return null; end if;
  perform pg_advisory_xact_lock(27191991);
  delete from public.maple_guest_requests where created_at < now() - interval '25 hours';
  if (select count(*) from public.maple_guest_requests where ip_digest=p_ip_digest and created_at > now()-interval '1 minute') >= greatest(1,least(p_per_minute,30)) then return null; end if;
  if (select count(*) from public.maple_guest_requests where created_at > now()-interval '24 hours') >= greatest(1,least(p_daily_total,5000)) then return null; end if;
  if (select count(*) from public.maple_guest_requests where ip_digest=p_ip_digest and finished_at is null and created_at > now()-interval '3 minutes') >= greatest(1,least(p_concurrent,5)) then return null; end if;
  insert into public.maple_guest_requests(ip_digest) values(p_ip_digest) returning id into lease_id;
  return lease_id;
end $$;
revoke all on function public.acquire_maple_guest_request(text,int,int,int) from public,anon,authenticated;
grant execute on function public.acquire_maple_guest_request(text,int,int,int) to service_role;

-- Track rooms and individual messages to make repeated imports incremental and idempotent.
create table public.maple_guest_imports (
  user_id uuid not null references auth.users(id) on delete cascade,
  guest_room_id uuid not null,
  room_id uuid not null references public.maple_chat_rooms(id) on delete cascade,
  primary key (user_id, guest_room_id)
);
create table public.maple_guest_import_messages (
  user_id uuid not null,
  guest_room_id uuid not null,
  guest_message_id uuid not null,
  primary key (user_id, guest_room_id, guest_message_id),
  foreign key (user_id, guest_room_id) references public.maple_guest_imports(user_id, guest_room_id) on delete cascade
);
alter table public.maple_guest_import_messages enable row level security;
revoke all on public.maple_guest_import_messages from public, anon, authenticated;
alter table public.maple_guest_imports enable row level security;
revoke all on public.maple_guest_imports from public, anon, authenticated;
create function public.import_maple_guest_room(p_room jsonb, p_messages jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid(); guest_id uuid; result_id uuid; msg jsonb; snap jsonb; snapshot_id bigint; ids bigint[]; message_time timestamptz; previous_updated timestamptz; v_guest_message_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_room) <> 'object' or jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 500 or pg_column_size(p_messages) > 8000000 then raise exception 'Invalid import'; end if;
  guest_id := (p_room->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || guest_id::text, 0));
  select imports.room_id, rooms.updated_at into result_id, previous_updated from public.maple_guest_imports imports join public.maple_chat_rooms rooms on rooms.id=imports.room_id and rooms.user_id=uid where imports.user_id=uid and imports.guest_room_id=guest_id;
  if result_id is null then
  insert into public.maple_chat_rooms (user_id,title,created_at,updated_at)
  values(uid, left(coalesce(nullif(p_room->>'title',''),'새 대화'),56), least((p_room->>'created_at')::timestamptz,now()), least((p_room->>'updated_at')::timestamptz,now())) returning id into result_id;
  insert into public.maple_guest_imports(user_id,guest_room_id,room_id) values(uid,guest_id,result_id);
  end if;
  for msg in select value from jsonb_array_elements(p_messages) loop
    if msg->>'role' not in ('user','assistant') or length(coalesce(msg->>'content','')) > 100000 then raise exception 'Invalid message'; end if;
    v_guest_message_id := (msg->>'id')::uuid;
    if v_guest_message_id is null then raise exception 'Missing message id'; end if;
    if exists(select 1 from public.maple_guest_import_messages where user_id=uid and guest_room_id=guest_id and maple_guest_import_messages.guest_message_id=v_guest_message_id) then continue; end if;
    ids := '{}';
    for snap in select value from jsonb_array_elements(coalesce(msg->'snapshots','[]'::jsonb)) loop
      if (snap->>'created_at')::timestamptz >= now()-interval '29 days' and (snap->>'created_at')::timestamptz <= now() and length(coalesce(snap->>'ocid','')) <= 200 then
        insert into public.maple_character_snapshots(user_id,ocid,character_name,data_date,responses,failures,created_at)
        values(uid,snap->>'ocid',left(snap->>'character_name',50),(snap->>'data_date')::date,snap->'responses',coalesce(snap->'failures','{}'::jsonb),(snap->>'created_at')::timestamptz) returning id into snapshot_id;
        ids := array_append(ids,snapshot_id);
      end if;
    end loop;
    message_time := least((msg->>'created_at')::timestamptz,now());
    insert into public.maple_chat_messages(room_id,user_id,role,content,sources,created_at,character_snapshot_ids,executed_tools,response_schema_version)
    values(result_id,uid,msg->>'role',coalesce(msg->>'content',''),coalesce(msg->'sources','[]'::jsonb),message_time,ids,coalesce(array(select jsonb_array_elements_text(coalesce(msg->'executed_tools','[]'::jsonb))),'{}'),case when cardinality(ids)>0 then 1 else null end);
    insert into public.maple_guest_import_messages values(uid,guest_id,v_guest_message_id);
  end loop;
  update public.maple_chat_rooms set updated_at=greatest(coalesce(previous_updated, '-infinity'::timestamptz),least((p_room->>'updated_at')::timestamptz,now())) where id=result_id and user_id=uid;
  return result_id;
end $$;
revoke all on function public.import_maple_guest_room(jsonb,jsonb) from public,anon;
grant execute on function public.import_maple_guest_room(jsonb,jsonb) to authenticated;
