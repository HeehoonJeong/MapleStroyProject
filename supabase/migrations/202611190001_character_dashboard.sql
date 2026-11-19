-- References point to existing owner-protected snapshots, which expire under the existing retention policy.
alter table public.maple_chat_messages
  add column if not exists character_snapshot_ids bigint[] not null default '{}',
  add column if not exists executed_tools text[] not null default '{}',
  add column if not exists response_schema_version integer;
