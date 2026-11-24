-- A log of every text sent to a driver (or, in test mode, what would have been sent).
-- Run once in the Supabase SQL Editor.

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  driver_id    uuid not null,
  to_phone     text not null,
  body         text not null,
  status       text not null check (status in ('sent', 'test', 'failed')),
  detail       text,
  provider_id  text,
  link_id      uuid references public.upload_links (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (driver_id, company_id) references public.drivers (id, company_id) on delete cascade
);
create index messages_driver_idx on public.messages (driver_id, created_at desc);

alter table public.messages enable row level security;

create policy "members read their messages" on public.messages
  for select to authenticated using (company_id in (select public.my_company_ids()));
create policy "members log their messages" on public.messages
  for insert to authenticated with check (company_id in (select public.my_company_ids()));

revoke all on public.messages from anon;
grant select, insert on public.messages to authenticated;
