-- First, drop any existing policies to avoid conflicts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Allow anonymous uploads" on storage.objects;
drop policy if exists "Allow anonymous downloads" on storage.objects;

-- Create a simpler public access policy
create policy "Public Access"
on storage.objects for all
using ( bucket_id = 'videos' )
with check ( bucket_id = 'videos' );

-- Make sure RLS is enabled
alter table storage.objects enable row level security;

-- Give public access to the bucket
update storage.buckets
set public = true
where id = 'videos';

-- Allow public select access
create policy "Public Select"
on storage.objects for select
using ( bucket_id = 'videos' );

-- Allow public insert access
create policy "Public Insert"
on storage.objects for insert
with check ( bucket_id = 'videos' );