-- Log tab: photo uploads, backing storage bucket + policies.
-- Run this in the Supabase SQL Editor.

create table if not exists journal_photos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    entry_date date not null default current_date,
    storage_path text not null,
    created_at timestamptz not null default now()
);

alter table journal_photos enable row level security;

create policy "Users manage their own journal photos"
    on journal_photos for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Private storage bucket (not public -- photos are accessed via
-- short-lived signed URLs generated per request, never a public link).
insert into storage.buckets (id, name, public)
values ('journal-photos', 'journal-photos', false)
on conflict (id) do nothing;

create policy "Users upload their own journal photos"
on storage.objects for insert
with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users view their own journal photos"
on storage.objects for select
using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own journal photos"
on storage.objects for delete
using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
