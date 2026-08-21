-- Immerse: Units for organizing materials within a class, and a due_time
-- column on classwork so HW/exams can carry a time of day (in addition to
-- the existing due_date). Both are additive/nullable so nothing existing
-- (including ECal's use of classwork) breaks.
-- Run this in the Supabase SQL Editor.

create table if not exists units (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    class_id uuid not null references classes(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

alter table units enable row level security;

create policy "Users manage their own units"
    on units for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists units_class_idx on units (class_id);

-- Materials can optionally belong to a unit. Deleting a unit unassigns its
-- materials rather than deleting them.
alter table materials add column if not exists unit_id uuid references units(id) on delete set null;

-- Optional time-of-day for a deadline, alongside the existing due_date.
alter table classwork add column if not exists due_time time;
