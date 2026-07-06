-- Run in Supabase Dashboard → SQL Editor

-- Skip/Watch outcome automation: the close price on the day the analysis was
-- done, used as the reference baseline for auto-computed T+3/T+10/T+15
-- snapshots. price_t15 is new (Take only needed T+3/5/10); the detailed
-- pct-move/hit breakdown for all offsets still lives in outcome_auto jsonb.
alter table journal_sessions
  add column if not exists reference_close numeric,
  add column if not exists price_t15       numeric;

-- Take outcome automation: set by the nightly job when a continuous daily
-- high/low scan finds planned_target or planned_sl was crossed on some day —
-- shape: { type: 'hit_target' | 'hit_sl', date, price }. Surfaced as a
-- confirmation prompt in the UI; never auto-fills actual_entry/actual_exit.
alter table journal_sessions
  add column if not exists auto_detected_exit jsonb;

-- Backfill: these were added directly via the Supabase SQL editor at some
-- point and never captured in a migration file (see the defensive
-- `delete insertRecord.outcome_data` comment in routes/journal.js) — adding
-- them here `if not exists` so this migrations folder stays a complete,
-- reproducible source of truth. No-ops if already present.
alter table journal_sessions
  add column if not exists outcome_data        jsonb,
  add column if not exists outcome_chart_entry text,
  add column if not exists outcome_chart_exit  text;
