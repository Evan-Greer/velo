-- Immerse: per-class priority, lesson log, and cached AI study plan.
-- Reuses the existing `classwork` table (see ecal_schema.sql) for HW/exam
-- due dates, matched by class_name -- so a due date set from Immerse shows
-- up in ECal too, and vice versa.
-- Run this in the Supabase SQL Editor.

alter table classes add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high'));

-- The plan is cached on the class row and regenerated automatically
-- whenever a lesson, deadline, or material is added for the class (see
-- regenerateStudyPlan() in immerse.html / immerse-class.html) -- opening
-- the class page just reads the cached copy, it doesn't trigger a call.
alter table classes add column if not exists study_plan jsonb;
alter table classes add column if not exists study_plan_generated_at timestamptz;

-- A running log of what was actually covered in class -- feeds the study
-- plan generator so it knows what's fresh vs. what needs review.
create table if not exists lessons (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    class_id uuid not null references classes(id) on delete cascade,
    entry_date date not null default current_date,
    content text not null,
    created_at timestamptz not null default now()
);

alter table lessons enable row level security;

create policy "Users manage their own lessons"
    on lessons for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists lessons_class_idx on lessons (class_id, entry_date desc);
