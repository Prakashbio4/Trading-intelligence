-- Migration 004: store talib pattern detections on journal sessions
-- This enables the 3-eye comparison: user read vs AI read vs actual OHLC data

alter table journal_sessions
  add column if not exists talib_patterns jsonb default '[]';
