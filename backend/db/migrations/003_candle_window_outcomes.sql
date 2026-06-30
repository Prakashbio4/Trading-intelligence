-- Migration 003: Candle window redesign + outcome auto-population
-- Run in Supabase Dashboard → SQL Editor

-- 1. Add candle window fields to journal_sessions
alter table journal_sessions
  add column if not exists window_size        int  default 7,
  add column if not exists pattern_start_date date,
  add column if not exists pattern_end_date   date,
  add column if not exists ohlc_window        jsonb default '[]',
  -- outcome price snapshots (auto-populated by nightly job)
  add column if not exists price_t3           numeric,
  add column if not exists price_t5           numeric,
  add column if not exists price_t10          numeric,
  add column if not exists outcome_auto       jsonb default '{}';

-- ohlc_window shape:
-- [{ date, open, high, low, close, volume, zone: 'prior'|'pattern'|'aftermath'|'today' }]

-- outcome_auto shape:
-- { t3: { price, pct_vs_entry, hit_target, hit_sl }, t5: {...}, t10: {...} }

-- 2. Index for outcome job — find sessions needing price snapshots
create index if not exists journal_sessions_outcome_idx
  on journal_sessions(date, ticker)
  where price_t3 is null or price_t5 is null or price_t10 is null;
