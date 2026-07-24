'use strict';

const supabase = require('../lib/supabase');
const { loadAllEquitySymbols } = require('../lib/growwInstruments');
const { backfillSymbol, alreadyBackfilled } = require('./backfillHistory');
const { withRetry } = require('../lib/retry');

// Pre-warms chart history for the full tradable universe on a schedule,
// ahead of anyone typing those symbols into Analyse — the same idea as
// TradingView's own pre-built data warehouse, approximated with what we
// have (Groww's historical API). Deliberately never touches stock_universe:
// this is chart-cache data, not a user's personal tracked list, and must
// stay decoupled from Signals' nightly scan (which loops over
// stock_universe active=true rows).
const SINCE_DATE = '2020-01-01';
const NEW_SYMBOLS_PER_RUN = 500; // ramp-up cap for brand-new symbols per run — see reasoning below
const INTER_SYMBOL_DELAY_MS = 300; // Groww rate-limit throttle — only applied after a real Groww call, not on cheap already-fresh skips
const PREWARM_CONCURRENCY = 4; // number of symbols processed in parallel — see worker-pool notes below
const PERSIST_PROGRESS_EVERY = 20; // claims between cursor saves — frequent enough that a restart mid-run loses little ground, cheap enough not to matter

// The scan position through `symbols` used to be a plain in-memory index,
// reset to 0 on every process restart. During initial ramp-up (most of the
// ~7368-symbol universe not yet backfilled), a restart mid-run threw away
// the scan position — the next run re-scanned the entire already-done
// prefix (cheap per symbol, but growing every run) before ever reaching
// fresh symbols. If restarts happen more often than a full pass takes, net
// forward progress nearly stalls even though each run looks busy. Persisting
// the last-seen symbol (not a raw index, which would drift if Groww's
// instrument CSV ever reorders/inserts a row) lets a restart resume near
// where it left off by looking that symbol back up in the current list.
async function loadPersistedStartIndex(symbols) {
  const { data, error } = await supabase.from('prewarm_progress').select('last_symbol').eq('id', 1).maybeSingle();
  if (error) {
    console.error('[prewarm] Failed to load persisted progress cursor, starting from the top:', error.message);
    return 0;
  }
  if (!data?.last_symbol) return 0;
  const lastIndex = symbols.indexOf(data.last_symbol);
  return lastIndex === -1 ? 0 : lastIndex + 1;
}

async function persistLastSymbol(symbol) {
  const { error } = await supabase.from('prewarm_progress').upsert({ id: 1, last_symbol: symbol, updated_at: new Date().toISOString() });
  if (error) console.error('[prewarm] Failed to persist progress cursor:', error.message);
}

// Reasoning for 150/run (original): the universe grew from ~2389 (NSE only)
// to ~7368 (NSE + BSE + SME + indices) the same day this was last tuned to
// 75/run — at the old pace that's ~98 hours (~4 days) to first full
// coverage, vs the original goal of finishing in roughly a day. 150/run
// brought that to ~49 hours (~2 days) — a moderate, not aggressive, increase
// given Groww's real rate limits were still unverified.
//
// Raised to 500/run: logs from a completed 150-symbol run showed it hitting
// the cap cleanly with zero Groww rate-limit (429) responses — every
// failure in that run was the unrelated token-refresh timezone bug (see
// lib/groww.js), not rate limiting. With real headroom confirmed, 500/run
// cuts first-time coverage of the remaining universe from days to hours.
// Revert toward 150-300 if 429s start showing up in the logs.
let _running = false;

async function runPrewarmChartCache() {
  // Re-entrancy guard: at this universe size, a run that includes many new
  // full backfills can plausibly take longer than the hourly cron interval.
  // Without this guard, an overlapping second run would double up Groww
  // calls for the same symbols concurrently — a real risk left unsupervised.
  if (_running) {
    console.warn('[prewarm] Previous run still in progress — skipping this cron fire to avoid overlapping Groww load.');
    return { skipped: true };
  }
  _running = true;

  try {
    console.log(`[prewarm] Starting chart-cache pre-warm run (concurrency=${PREWARM_CONCURRENCY})...`);
    const symbols = await loadAllEquitySymbols();

    const startIndex = await loadPersistedStartIndex(symbols);
    if (startIndex > 0) {
      console.log(`[prewarm] Resuming from persisted index ${startIndex}/${symbols.length} instead of the top of the list.`);
    }

    let newlyBackfilled = 0;
    let toppedUp = 0;
    let alreadyFresh = 0;
    let deferred = 0;
    let failed = 0;
    let nextIndex = startIndex;
    let claimsSincePersist = 0;

    // Worker-pool fan-out: each worker pulls the next unclaimed symbol off
    // the shared `symbols` array and processes it start-to-finish (its own
    // full/top-up backfill, including background:false's older-history
    // await) before pulling another. `nextIndex++` and the newlyBackfilled
    // cap check/reservation below are plain synchronous statements with no
    // `await` in between, so JS's single-threaded event loop makes them
    // effectively atomic across workers — no two workers can ever claim the
    // same symbol or both slip past the ramp-up cap. Per-worker pacing
    // (INTER_SYMBOL_DELAY_MS after each real Groww call) is unchanged, so
    // running N workers multiplies total throughput by ~N rather than
    // removing the rate-limit spacing entirely.
    async function worker() {
      while (nextIndex < symbols.length) {
        const symbol = symbols[nextIndex++];
        claimsSincePersist++;
        if (claimsSincePersist >= PERSIST_PROGRESS_EVERY) {
          claimsSincePersist = 0;
          persistLastSymbol(symbol).catch(() => {}); // fire-and-forget — persistLastSymbol already logs its own failures
        }
        try {
          const hadDeepHistory = await alreadyBackfilled(symbol, SINCE_DATE);
          if (!hadDeepHistory && newlyBackfilled >= NEW_SYMBOLS_PER_RUN) {
            deferred++; // ramp-up cap hit for this run — picked up next hour
            continue;
          }
          // Reserve the new-backfill slot now (before awaiting) so the cap
          // is exact even with concurrent workers in flight.
          if (!hadDeepHistory) newlyBackfilled++;

          // backfillSymbol already knows how to skip an already-fresh symbol
          // cheaply (a couple of Supabase reads, no Groww call), do a small
          // top-up if it's deep but stale, or a full backfill if it's new.
          // background:false is load-bearing here (unlike the on-demand
          // /universe/:symbol/backfill route, which wants the default
          // fast-return-then-keep-fetching): without it, each new symbol
          // fires an untracked background older-history fetch and this
          // worker moves straight to the next one, so far more than
          // PREWARM_CONCURRENCY chains end up running concurrently,
          // uncoordinated with this pool's own pacing.
          const result = await withRetry(() => backfillSymbol(symbol, SINCE_DATE, { background: false }));

          if (result.skipped) {
            alreadyFresh++;
            continue; // no Groww call happened — nothing to rate-limit-delay for
          }
          if (hadDeepHistory) toppedUp++;
          await new Promise(r => setTimeout(r, INTER_SYMBOL_DELAY_MS));
        } catch (err) {
          failed++;
          console.error(`[prewarm] ${symbol}: failed — ${err.message}`);
        }
      }
    }

    await Promise.all(Array.from({ length: PREWARM_CONCURRENCY }, () => worker()));

    // Workers only stop once every symbol has been claimed, so reaching here
    // means a full pass genuinely completed — clear the cursor so the next
    // pass starts fresh (cheap once caught up, and needed to catch newly
    // listed symbols and stale top-ups). A restart mid-run never reaches
    // this line, so it keeps whatever mid-run value persistLastSymbol last saved.
    await persistLastSymbol(null);

    console.log(`[prewarm] Done. ${newlyBackfilled} newly backfilled, ${toppedUp} topped up, ${alreadyFresh} already fresh, ${deferred} deferred (ramp-up cap), ${failed} failed.`);
    return { newlyBackfilled, toppedUp, alreadyFresh, deferred, failed };
  } finally {
    _running = false;
  }
}

module.exports = { runPrewarmChartCache };
