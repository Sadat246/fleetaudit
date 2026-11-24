-- Private storage for document photos.
-- Files live at  <company_id>/<driver_id>/<random>.jpg  and a user can only
-- read or write files under a company they belong to.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy "members read their company's photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.my_company_ids() c where c::text = (storage.foldername(name))[1])
  );

create policy "members upload their company's photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and exists (select 1 from public.my_company_ids() c where c::text = (storage.foldername(name))[1])
  );

create policy "members delete their company's photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.my_company_ids() c where c::text = (storage.foldername(name))[1])
  );

-- Each document remembers which photo it came from.
alter table public.documents add column photo_path text;
