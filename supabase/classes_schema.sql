-- ECal: user-managed list of classes, used to populate the classwork dropdown.
-- Run this in the Supabase SQL Editor.

create table if not exists classes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    unique (user_id, name)
);

alter table classes enable row level security;

create policy "Users manage their own classes"
    on classes for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
