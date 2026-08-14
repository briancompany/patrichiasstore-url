drop policy if exists "store-content insert" on storage.objects;
drop policy if exists "store-content update" on storage.objects;
drop policy if exists "store-content delete" on storage.objects;

create policy "Admins can upload store content"
on storage.objects for insert to authenticated
with check (bucket_id = 'store-content' and is_admin());

create policy "Admins can update store content"
on storage.objects for update to authenticated
using (bucket_id = 'store-content' and is_admin())
with check (bucket_id = 'store-content' and is_admin());

create policy "Admins can delete store content"
on storage.objects for delete to authenticated
using (bucket_id = 'store-content' and is_admin());