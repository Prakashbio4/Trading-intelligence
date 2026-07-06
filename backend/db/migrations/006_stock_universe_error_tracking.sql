-- Run in Supabase Dashboard → SQL Editor

-- Track per-symbol fetch health so the nightly job can stop retrying
-- symbols that will never succeed (invalid/delisted/renamed trading symbols)
-- instead of failing on them every night forever.
alter table stock_universe
  add column if not exists last_fetch_status  text,                 -- 'ok' | 'invalid_symbol' | 'empty' | 'error'
  add column if not exists last_error         text,
  add column if not exists consecutive_failures integer not null default 0;
