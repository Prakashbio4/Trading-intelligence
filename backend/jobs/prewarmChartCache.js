'use strict';

const { loadAllNseEquitySymbols } = require('../lib/growwInstruments');
const { fetchAndStoreRange, alreadyBackfilled } = require('./backfillHistory');
const { withRetry } = require('../lib/retry');

// Pre-warms chart history for a broad NSE universe on a schedule, ahead of
// anyone typing those symbols into Analyse — the same idea as TradingView's
// own pre-built data warehouse, approximated with what we have (Groww's live
// API). Deliberately never touches stock_universe: this is chart-cache data,
// not a user's personal tracked list, and must stay decoupled from Signals'
// nightly scan (which loops over stock_universe active=true rows).
const SINCE_DATE = '2020-01-01';
const NEW_SYMBOLS_PER_RUN = 75; // ramp-up cap — spreads the one-time deep backfill across ~20-30 nights
const REFRESH_WINDOW_DAYS = 20; // same window fetchOhlc.js uses for the personal nightly job
const INTER_SYMBOL_DELAY_MS = 300;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function runPrewarmChartCache() {
  console.log('[prewarm] Starting chart-cache pre-warm run...');

  const symbols = await loadAllNseEquitySymbols();
  const today = new Date().toISOString().split('T')[0];
  const refreshFrom = addDays(today, -REFRESH_WINDOW_DAYS);

  let newlyBackfilled = 0;
  let refreshed = 0;
  let failed = 0;

  for (const symbol of symbols) {
    try {
      const isDeep = await alreadyBackfilled(symbol, SINCE_DATE);

      if (isDeep) {
        await withRetry(() => fetchAndStoreRange(symbol, refreshFrom, today));
        refreshed++;
      } else if (newlyBackfilled < NEW_SYMBOLS_PER_RUN) {
        await withRetry(() => fetchAndStoreRange(symbol, SINCE_DATE, today));
        newlyBackfilled++;
      } else {
        continue; // ramp-up cap hit for tonight — picked up on a later run
      }
    } catch (err) {
      failed++;
      console.error(`[prewarm] ${symbol}: failed — ${err.message}`);
    }
    await new Promise(r => setTimeout(r, INTER_SYMBOL_DELAY_MS));
  }

  console.log(`[prewarm] Done. ${newlyBackfilled} newly backfilled, ${refreshed} refreshed, ${failed} failed.`);
  return { newlyBackfilled, refreshed, failed };
}

module.exports = { runPrewarmChartCache };
