-- Run in Supabase Dashboard → SQL Editor

-- ohlc_records.symbol previously required the symbol to already exist in
-- stock_universe (a user's personal tracked list). That's too tight a
-- coupling: OHLC market data and "is this on my personal list" are
-- different concerns, and it blocks storing history for symbols a trader
-- hasn't tracked yet (e.g. a brand-new symbol typed into Analyse, or the
-- broader NSE chart-cache pre-warm job, which deliberately never writes to
-- stock_universe). unique(symbol, date) and the ohlc_records_symbol_date
-- index are untouched — only the FK reference goes away.
--
-- If this errors because Supabase auto-named the constraint differently,
-- check Table Editor → ohlc_records → Foreign Keys for the actual name.
alter table ohlc_records drop constraint if exists ohlc_records_symbol_fkey;
