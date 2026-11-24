-- Week 4: driver reminder texts and no-login upload links.
-- Run once in the Supabase SQL Editor.

-- ── Drivers can stop texts ──────────────────────────────────────────
alter table public.drivers add column sms_opt_out boolean not null default false;

-- ── Upload links: a secret link texted to a driver ──────────────────
-- Only a hash of the token is stored, so a database leak can't be used to
-- upload. Links expire and work once.
create table public.upload_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  driver_id   uuid not null,
  doc_type    text not null check (doc_type in ('MEDICAL_EXAMINER_CERTIFICATE', 'COMMERCIAL_DRIVERS_LICENSE')),
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  foreign key (driver_id, company_id) references public.drivers (id, company_id) on delete cascade
);
create index upload_links_company_idx on public.upload_links (company_id);

-- ── Submissions: photos drivers sent, waiting for the office ────────
create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null,
  driver_id    uuid not null,
  link_id      uuid references public.upload_links (id) on delete set null,
  doc_type     text not null,
  photo_path   text not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  document_id  uuid references public.documents (id) on delete set null,
  foreign key (driver_id, company_id) references public.drivers (id, company_id) on delete cascade
);
create index submissions_company_status_idx on public.submissions (company_id, status);

-- ── Reminders: every text we sent (or tried to) ─────────────────────
-- The unique key means the same reminder is never sent twice.
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null,
  driver_id   uuid not null,
  item_key    text not null check (item_key in ('medical', 'cdl')),
  due         date not null,
  threshold   int not null check (threshold in (60, 30, 7)),
  link_id     uuid references public.upload_links (id) on delete set null,
  status      text not null check (status in ('sent', 'test', 'failed', 'skipped')),
  detail      text,
  created_at  timestamptz not null default now(),
  unique (driver_id, item_key, due, threshold),
  foreign key (driver_id, company_id) references public.drivers (id, company_id) on delete cascade
);
create index reminders_company_idx on public.reminders (company_id);

-- ── Access rules ────────────────────────────────────────────────────
-- Office users see their own company's rows. The driver upload page and the
-- daily job run on the server with the secret key, which bypasses these.

alter table public.upload_links enable row level security;
alter table public.submissions  enable row level security;
alter table public.reminders    enable row level security;

create policy "members read their upload links" on public.upload_links
  for select to authenticated using (company_id in (select public.my_company_ids()));
create policy "members create upload links" on public.upload_links
  for insert to authenticated with check (company_id in (select public.my_company_ids()));

create policy "members read their submissions" on public.submissions
  for select to authenticated using (company_id in (select public.my_company_ids()));
create policy "members review their submissions" on public.submissions
  for update to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

create policy "members read their reminders" on public.reminders
  for select to authenticated using (company_id in (select public.my_company_ids()));
create policy "members log their reminders" on public.reminders
  for insert to authenticated with check (company_id in (select public.my_company_ids()));

revoke all on public.upload_links, public.submissions, public.reminders from anon;
grant select, insert on public.upload_links to authenticated;
grant select, update on public.submissions to authenticated;
grant select, insert on public.reminders to authenticated;
