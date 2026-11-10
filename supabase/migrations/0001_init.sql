-- FleetAudit: companies, members, drivers and DQ documents.
-- Run once in the Supabase SQL Editor. Safe to read top to bottom:
-- every table has row-level security, so a signed-in user only ever
-- sees rows for companies they belong to.

-- ── Tables ───────────────────────────────────────────────────────────

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 200),
  time_zone   text not null default 'America/Chicago',
  created_at  timestamptz not null default now()
);

create table public.company_members (
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

create table public.drivers (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  cdl_number    text,
  cdl_state     text,
  cdl_class     text,
  phone         text,
  hire_date     date,
  inquiry_done  boolean not null default false,
  inquiry_date  date,
  created_at    timestamptz not null default now(),
  -- Lets documents prove they belong to the same company as their driver.
  unique (id, company_id)
);
create index drivers_company_idx on public.drivers (company_id);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  driver_id     uuid not null,
  type          text not null check (type in (
                  'MEDICAL_EXAMINER_CERTIFICATE', 'COMMERCIAL_DRIVERS_LICENSE',
                  'ANNUAL_DRIVING_RECORD_REVIEW', 'MVR_REPORT',
                  'DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD', 'DRIVER_APPLICATION',
                  'UNKNOWN_OR_UNCORRELATED')),
  issued        date,
  expires       date,
  cdl_class     text,
  endorsements  text[] not null default '{}',
  restrictions  text[] not null default '{}',
  examiner      text,
  nrcme         text,
  waivers       text[] not null default '{}',
  sig_driver    boolean not null default false,
  sig_reviewer  boolean not null default false,
  discrepancy   boolean not null default false,
  created_at    timestamptz not null default now(),
  foreign key (driver_id, company_id)
    references public.drivers (id, company_id) on delete cascade
);
create index documents_company_idx on public.documents (company_id);
create index documents_driver_idx on public.documents (driver_id);

-- ── Who belongs where ───────────────────────────────────────────────

-- Companies the signed-in user belongs to. SECURITY DEFINER so policies
-- can call it without recursing into company_members' own policy.
create function public.my_company_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select company_id from public.company_members where user_id = (select auth.uid())
$$;

-- Creates a company and makes the caller its owner, in one step.
create function public.create_company(company_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.company_members where user_id = (select auth.uid())) then
    raise exception 'You already belong to a company';
  end if;

  insert into public.companies (name) values (trim(company_name)) returning id into new_id;
  insert into public.company_members (company_id, user_id, role)
    values (new_id, (select auth.uid()), 'owner');
  return new_id;
end;
$$;

-- ── Access rules (row-level security) ───────────────────────────────

alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.drivers         enable row level security;
alter table public.documents       enable row level security;

create policy "members read their company" on public.companies
  for select to authenticated using (id in (select public.my_company_ids()));
create policy "members rename their company" on public.companies
  for update to authenticated
  using (id in (select public.my_company_ids()))
  with check (id in (select public.my_company_ids()));

create policy "users read their own memberships" on public.company_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy "members manage their drivers" on public.drivers
  for all to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

create policy "members manage their documents" on public.documents
  for all to authenticated
  using (company_id in (select public.my_company_ids()))
  with check (company_id in (select public.my_company_ids()));

-- ── Grants: logged-out visitors get nothing ─────────────────────────

revoke all on public.companies, public.company_members, public.drivers, public.documents from anon;
grant select, update on public.companies to authenticated;
grant select on public.company_members to authenticated;
grant select, insert, update, delete on public.drivers, public.documents to authenticated;

revoke execute on function public.my_company_ids() from public, anon;
revoke execute on function public.create_company(text) from public, anon;
grant execute on function public.my_company_ids() to authenticated;
grant execute on function public.create_company(text) to authenticated;
