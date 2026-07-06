-- Run in Supabase Dashboard → SQL Editor

-- When a symbol is rejected by Groww as invalid (GA001), we look it up against
-- Groww's NSE instrument master and surface the best-guess correct symbol here
-- for manual confirmation — never applied automatically.
alter table stock_universe
  add column if not exists suggested_symbol      text,
  add column if not exists suggested_symbol_name text;
