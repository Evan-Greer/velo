-- Immerse tab: uploaded class materials + spaced-repetition flashcards.
-- Reuses the existing `classes` table (see classes_schema.sql) so a class
-- added here shows up in ECal's classwork dropdown and vice versa.
-- Run this in the Supabase SQL Editor.

create table if not exists materials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    class_id uuid not null references classes(id) on delete cascade,
    title text not null,
    storage_path text not null,
    mime_type text not null,
    created_at timestamptz not null default now()
);

alter table materials enable row level security;

create policy "Users manage their own materials"
    on materials for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Flashcards, scheduled with a simplified SM-2 spaced-repetition algorithm.
-- `card_type` distinguishes STEM problem-solving cards (front poses a
-- problem, back is the worked method) from plain recall cards (front asks
-- for a fact/definition) -- the two content types we settled on needing
-- different treatment for.
create table if not exists cards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    class_id uuid not null references classes(id) on delete cascade,
    material_id uuid references materials(id) on delete set null,
    card_type text not null check (card_type in ('procedural', 'declarative')),
    front text not null,
    back text not null,
    ease_factor real not null default 2.5,
    interval_days integer not null default 0,
    repetitions integer not null default 0,
    next_review_date date not null default current_date,
    last_reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

alter table cards enable row level security;

create policy "Users manage their own cards"
    on cards for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists cards_due_idx on cards (user_id, next_review_date);

-- Private storage bucket for uploaded class materials (PDFs, images, slides).
insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', false)
on conflict (id) do nothing;

create policy "Users upload their own class materials"
on storage.objects for insert
with check (bucket_id = 'class-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users view their own class materials"
on storage.objects for select
using (bucket_id = 'class-materials' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete their own class materials"
on storage.objects for delete
using (bucket_id = 'class-materials' and (storage.foldername(name))[1] = auth.uid()::text);
