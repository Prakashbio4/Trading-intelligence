-- Run in Supabase Dashboard → SQL Editor

-- Stock universe (your 50-60 stocks)
create table if not exists stock_universe (
  symbol    text primary key,
  exchange  text not null default 'NSE',
  sector    text default '',
  active    boolean not null default true,
  added_at  timestamptz default now()
);

-- Raw OHLC records — one row per symbol per trading day
-- Upserted nightly from Groww API
create table if not exists ohlc_records (
  id             uuid default gen_random_uuid() primary key,
  symbol         text not null references stock_universe(symbol) on delete cascade,
  date           date not null,
  open           numeric not null,
  high           numeric not null,
  low            numeric not null,
  close          numeric not null,
  volume         bigint not null,
  vol_10day_avg  bigint,
  talib_patterns jsonb default '[]',  -- array of { name, bias, candleCount, completionDate, startDate }
  fetched_at     timestamptz default now(),
  unique(symbol, date)
);

create index if not exists ohlc_records_symbol_date on ohlc_records(symbol, date desc);

-- Quick lookup: what patterns fired on a given date across all stocks?
-- Useful for "missed setups" view — patterns TA-Lib found but user didn't analyze
create or replace view missed_setups as
select
  o.symbol,
  o.date,
  o.close,
  p.value as pattern
from ohlc_records o,
  jsonb_array_elements(o.talib_patterns) as p(value)
where
  jsonb_array_length(o.talib_patterns) > 0
  and not exists (
    select 1 from journal_sessions j
    where j.ticker = o.symbol
      and j.date = o.date
  )
order by o.date desc, o.symbol;
