-- Immerse: exam countdown plan, generated alongside the regular study plan
-- whenever a class has a test/exam more than a few days out.
-- Run this in the Supabase SQL Editor.

alter table classes add column if not exists exam_plan jsonb;
alter table classes add column if not exists exam_plan_generated_at timestamptz;

-- A rolling list of {topic, date} the student most recently missed on a
-- self-quiz -- fed back into the study planner so a wrong answer actually
-- changes what gets recommended next, not just the quiz score.
alter table classes add column if not exists recent_quiz_misses jsonb;
