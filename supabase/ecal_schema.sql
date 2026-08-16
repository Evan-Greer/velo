-- ECal tables: personal to-do list + classwork list, one row per user.
-- Run this in the Supabase SQL Editor (Database > SQL Editor > New query).

create table if not exists todos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    text text not null,
    completed boolean not null default false,
    due_date date,
    created_at timestamptz not null default now()
);

create table if not exists classwork (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    class_name text,
    type text not null default 'homework' check (type in ('homework', 'quiz', 'test', 'project')),
    due_date date,
    completed boolean not null default false,
    notes text,
    created_at timestamptz not null default now()
);

alter table todos enable row level security;
alter table classwork enable row level security;

create policy "Users manage their own todos"
    on todos for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage their own classwork"
    on classwork for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
