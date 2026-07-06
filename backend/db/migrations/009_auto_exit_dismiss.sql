-- Run in Supabase Dashboard → SQL Editor

-- Lets a user reject a false-positive auto-detected exit (e.g. daily low
-- crossed planned_sl but no real order actually filled) without losing
-- future detection: the crossing's date is remembered here so the nightly
-- scan won't re-flag it, but keeps watching for any later crossing.
alter table journal_sessions
  add column if not exists auto_exit_dismissed_at date;
