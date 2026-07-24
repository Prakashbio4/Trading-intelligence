'use strict';

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

    let newlyBackfilled = 0;
    let toppedUp = 0;
    let alreadyFresh = 0;
    let deferred = 0;
    let failed = 0;
    let nextIndex = 0;

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

    console.log(`[prewarm] Done. ${newlyBackfilled} newly backfilled, ${toppedUp} topped up, ${alreadyFresh} already fresh, ${deferred} deferred (ramp-up cap), ${failed} failed.`);
    return { newlyBackfilled, toppedUp, alreadyFresh, deferred, failed };
  } finally {
    _running = false;
  }
}

module.exports = { runPrewarmChartCache };
