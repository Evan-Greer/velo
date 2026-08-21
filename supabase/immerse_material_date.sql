-- Immerse: optional date-covered field on materials (e.g. "this is from
-- the Sept 3 lecture"), separate from created_at which just tracks when
-- it was uploaded. Additive/nullable.
-- Run this in the Supabase SQL Editor.

alter table materials add column if not exists material_date date;
