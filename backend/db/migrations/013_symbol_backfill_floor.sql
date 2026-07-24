-- Run in Supabase Dashboard → SQL Editor

-- Groww genuinely has no candles before a symbol's real listing date, so a
-- full-range fetch back to backfillHistory.js's SINCE_DATE (2020-01-01) can
-- legitimately come back short — e.g. a symbol listed in 2021 will never
-- have a 2020 row no matter how many times it's re-fetched. Without this,
-- alreadyBackfilled() has no way to distinguish "not backfilled yet" from
-- "backfilled as far as data exists", so the prewarm job re-attempts the
-- same exhausted multi-year range for these symbols on every run, forever.
create table if not exists symbol_backfill_floor (
  symbol               text primary key,
  confirmed_floor_date date not null,  -- earliest date Groww actually has data for this symbol
  checked_at           timestamptz not null default now()
);
