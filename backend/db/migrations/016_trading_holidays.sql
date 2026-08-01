-- Run in Supabase Dashboard → SQL Editor

-- NSE/BSE trading holidays. Backing the "last trading day" walkback and the
-- nightly/catch-up cron gates with a DB table (rather than a hardcoded
-- array in code) means the holiday list can be corrected or extended
-- without a redeploy — most Indian market holidays are festival-based and
-- shift every year, so a static list would go stale annually.
--
-- An empty table is a safe default: lib/tradingCalendar.js falls back to
-- weekend-only trading-day logic when no holidays are loaded, so nothing
-- breaks before this is populated.
--
-- Populate/update from NSE's official holiday circular, published each
-- December: https://www.nseindia.com/resources/exchange-communication-holidays
-- Verify dates against that circular before relying on them — the three
-- fixed-date national holidays below are safe to seed as-is (same calendar
-- date every year); festival holidays (Diwali, Holi, Eid, etc.) are NOT
-- included here and must be added per-year from the official list.
create table if not exists trading_holidays (
  date       date primary key,
  name       text,
  exchange   text not null default 'NSE',
  created_at timestamptz not null default now()
);

insert into trading_holidays (date, name) values
  ('2026-01-26', 'Republic Day'),
  ('2026-08-15', 'Independence Day'),
  ('2026-10-02', 'Gandhi Jayanti')
on conflict (date) do nothing;
