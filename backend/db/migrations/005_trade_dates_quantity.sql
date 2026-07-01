-- Run in Supabase SQL editor
ALTER TABLE journal_sessions
  ADD COLUMN IF NOT EXISTS trade_entry_date date,
  ADD COLUMN IF NOT EXISTS trade_exit_date  date,
  ADD COLUMN IF NOT EXISTS quantity         integer;
