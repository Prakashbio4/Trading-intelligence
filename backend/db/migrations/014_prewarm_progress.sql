-- Run in Supabase Dashboard → SQL Editor

-- prewarmChartCache's scan position through the equity universe used to be
-- an in-memory index reset to 0 on every process restart. Every restart
-- (crash, redeploy) mid-ramp-up made the job re-scan the whole
-- already-done prefix from scratch before reaching fresh symbols — each
-- individual check is cheap, but this compounds as the prefix grows, and if
-- restarts happen more often than a full run takes, the job barely makes
-- net forward progress at all. Persisting the last-seen symbol (rather than
-- a raw index, which would drift if Groww's instrument CSV ever reorders or
-- inserts a row) lets a restart resume near where it left off by looking
-- that symbol back up in the current list.
create table if not exists prewarm_progress (
  id          integer primary key default 1,
  last_symbol text,
  updated_at  timestamptz not null default now(),
  constraint prewarm_progress_singleton check (id = 1)
);

insert into prewarm_progress (id, last_symbol) values (1, null)
  on conflict (id) do nothing;
