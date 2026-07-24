-- Run in Supabase Dashboard → SQL Editor

-- Some symbols in the equity universe (e.g. NSE 'BE'-series trade-to-trade
-- tickers, which Groww's raw instrument CSV may list with a suffix like
-- "BLUECHIP-BE") get a hard 400 from Groww's historical-candle API — most
-- commonly error code GA001 "Please provide correct value of trading
-- symbol". Retrying a malformed symbol string never succeeds no matter how
-- many times or how slowly it's retried, so without this the prewarm job
-- burns a full retry budget (~7s of backoff) on the same permanently-broken
-- symbol on every single run, forever. Recording it here lets the job skip
-- straight past it on future runs instead.
create table if not exists symbol_backfill_invalid (
  symbol        text primary key,
  error_code    text,
  error_message text,
  checked_at    timestamptz not null default now()
);
