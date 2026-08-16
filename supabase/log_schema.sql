-- Log tab: one "thankful for" journal entry per user per day.
-- Run this in the Supabase SQL Editor (Database > SQL Editor > New query).

create table if not exists journal_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    entry_date date not null default current_date,
    thankful_text text not null,
    created_at timestamptz not null default now(),
    unique (user_id, entry_date)
);

alter table journal_entries enable row level security;

create policy "Users manage their own journal entries"
    on journal_entries for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
