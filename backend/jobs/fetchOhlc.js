'use strict';

const supabase = require('../lib/supabase');
const { fetchDailyOhlc } = require('../lib/groww');
const { findNseSymbolCandidates } = require('../lib/growwInstruments');
const { detectPatterns } = require('../lib/patterns');
const { invalidateSymbol } = require('../lib/ohlcCache');

const LOOKBACK_DAYS = 20; // fetch 20 days so 14-day window always has full data + pattern detection needs prior candles
const INVALID_SYMBOL_CODE = 'GA001'; // Groww: "Please provide correct value of trading symbol" — never going to succeed on retry
const MAX_CONSECUTIVE_FAILURES = 5; // stop retrying a symbol nightly once it's failed this many times in a row

function dateRange(daysBack) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return {
    fromDate: from.toISOString().split('T')[0],
    toDate:   to.toISOString().split('T')[0],
  };
}

// Re-bases "now" onto IST calendar date regardless of host timezone (Railway
// runs UTC) — same trick as server.js's startup catch-up check.
function todayIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toISOString().split('T')[0];
}

// Rolling 10-day average volume for each candle
function enrichWithVolAvg(candles) {
  return candles.map((c, i) => {
    const slice = candles.slice(Math.max(0, i - 9), i + 1);
    const avg = slice.reduce((sum, x) => sum + x.volume, 0) / slice.length;
    return { ...c, vol_10day_avg: Math.round(avg) };
  });
}

// Persist fetch health on the stock_universe row. Symbols that hit Groww's
// "invalid trading symbol" error will never succeed on retry (typo, delisted,
// or renamed ticker), so deactivate them immediately instead of failing again
// every night. Other failure kinds get a few retries in case they're transient
// (rate limiting, holidays, a brand-new listing with no candles yet) before
// being deactivated too.
async function recordFailure(symbol, message, priorFailures, kind = 'error') {
  const isInvalidSymbol = kind === 'error' && message.includes(INVALID_SYMBOL_CODE);
  const consecutive_failures = priorFailures + 1;
  const deactivate = isInvalidSymbol || consecutive_failures >= MAX_CONSECUTIVE_FAILURES;

  const updates = {
    last_fetch_status: isInvalidSymbol ? 'invalid_symbol' : kind,
    last_error: message,
    consecutive_failures,
  };
  if (deactivate) {
    updates.active = false;
    console.warn(`[fetchOhlc] ${symbol}: deactivating in stock_universe — ${
      isInvalidSymbol ? 'invalid trading symbol' : `${consecutive_failures} consecutive failures`
    }`);
  }

  if (isInvalidSymbol) {
    try {
      const [candidate] = await findNseSymbolCandidates(symbol);
      if (candidate) {
        updates.suggested_symbol = candidate.tradingSymbol;
        updates.suggested_symbol_name = candidate.name;
        console.warn(`[fetchOhlc] ${symbol}: possible correct symbol is ${candidate.tradingSymbol} (${candidate.name}) — needs manual confirmation`);
      }
    } catch (lookupErr) {
      console.error(`[fetchOhlc] ${symbol}: instrument lookup failed — ${lookupErr.message}`);
    }
  }

  const { error } = await supabase.from('stock_universe').update(updates).eq('symbol', symbol);
  if (error) console.error(`[fetchOhlc] ${symbol}: failed to record fetch status — ${error.message}`);
}

async function recordSuccess(symbol) {
  const { error } = await supabase
    .from('stock_universe')
    .update({ last_fetch_status: 'ok', last_error: null, consecutive_failures: 0, suggested_symbol: null, suggested_symbol_name: null })
    .eq('symbol', symbol);
  if (error) console.error(`[fetchOhlc] ${symbol}: failed to record fetch status — ${error.message}`);
}

async function processSymbol(symbol, priorFailures = 0) {
  const { fromDate, toDate } = dateRange(LOOKBACK_DAYS);

  let candles;
  try {
    candles = await fetchDailyOhlc(symbol, fromDate, toDate);
  } catch (err) {
    console.error(`[fetchOhlc] ${symbol}: fetch failed — ${err.message}`);
    await recordFailure(symbol, err.message, priorFailures);
    return { symbol, status: 'error', error: err.message };
  }

  if (!candles.length) {
    console.warn(`[fetchOhlc] ${symbol}: no candles returned`);
    await recordFailure(symbol, 'no candles returned', priorFailures, 'empty');
    return { symbol, status: 'empty' };
  }

  const enriched = enrichWithVolAvg(candles);
  const patterns = detectPatterns(candles);

  // Group patterns by completion date for easy lookup
  const patternsByDate = {};
  for (const p of patterns) {
    if (!patternsByDate[p.completionDate]) patternsByDate[p.completionDate] = [];
    patternsByDate[p.completionDate].push(p);
  }

  // Upsert OHLC rows — one row per symbol+date
  const ohlcRows = enriched.map(c => ({
    symbol,
    date:           c.date,
    open:           c.open,
    high:           c.high,
    low:            c.low,
    close:          c.close,
    volume:         c.volume,
    vol_10day_avg:  c.vol_10day_avg,
    talib_patterns: patternsByDate[c.date] ?? [],
    fetched_at:     new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('ohlc_records')
    .upsert(ohlcRows, { onConflict: 'symbol,date' });

  if (error) {
    console.error(`[fetchOhlc] ${symbol}: DB upsert failed — ${error.message}`);
    return { symbol, status: 'db_error', error: error.message };
  }

  // Groww doesn't always have the current session's EOD candle finalized by
  // the 4:15 PM IST nightly run (only 45 min after close) — flag it here so
  // the catch-up run knows to retry rather than treat this as a full success.
  const latestDate = enriched[enriched.length - 1]?.date;
  const missingToday = latestDate < toDate;
  if (missingToday) {
    console.warn(`[fetchOhlc] ${symbol}: latest candle is ${latestDate}, requested through ${toDate} — today's bar not published by Groww yet`);
  }

  invalidateSymbol(symbol);
  await recordSuccess(symbol);
  console.log(`[fetchOhlc] ${symbol}: ${enriched.length} candles, ${patterns.length} patterns`);
  return { symbol, status: 'ok', candles: enriched.length, patterns: patterns.length, missingToday };
}

async function runFetchOhlc() {
  console.log('[fetchOhlc] Starting nightly OHLC fetch...');

  const { data: universe, error } = await supabase
    .from('stock_universe')
    .select('symbol, consecutive_failures')
    .eq('active', true);

  if (error) {
    console.error('[fetchOhlc] Failed to load stock universe:', error.message);
    return;
  }

  if (!universe?.length) {
    console.warn('[fetchOhlc] Stock universe is empty — add stocks first');
    return;
  }

  const results = [];
  for (const { symbol, consecutive_failures } of universe) {
    const result = await processSymbol(symbol, consecutive_failures ?? 0);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  const ok           = results.filter(r => r.status === 'ok').length;
  const err          = results.filter(r => r.status === 'error').length;
  const missingToday = results.filter(r => r.missingToday).length;
  console.log(`[fetchOhlc] Done. ${ok} succeeded, ${err} failed.${
    missingToday ? ` ${missingToday} still missing today's bar (Groww hasn't published it yet) — catch-up run will retry.` : ''
  }`);
  return results;
}

// Catch-up pass, run a few hours after the nightly fetch: retries only the
// symbols that were still missing today's EOD candle at 4:15 PM, instead of
// re-fetching the whole universe. By the evening Groww has almost always
// finalized the candle, so this backfills the gap the same day instead of
// waiting for tomorrow's nightly run to pick it up.
async function runFetchOhlcCatchUp() {
  const today = todayIST();
  console.log(`[fetchOhlc] Starting catch-up pass for ${today}...`);

  const { data: universe, error: universeError } = await supabase
    .from('stock_universe')
    .select('symbol, consecutive_failures')
    .eq('active', true);

  if (universeError) {
    console.error('[fetchOhlc] Catch-up: failed to load stock universe:', universeError.message);
    return;
  }
  if (!universe?.length) return;

  const { data: haveToday, error: haveTodayError } = await supabase
    .from('ohlc_records')
    .select('symbol')
    .eq('date', today);

  if (haveTodayError) {
    console.error("[fetchOhlc] Catch-up: failed to check today's coverage:", haveTodayError.message);
    return;
  }

  const haveTodaySet = new Set((haveToday ?? []).map(r => r.symbol));
  const missing = universe.filter(({ symbol }) => !haveTodaySet.has(symbol));

  if (!missing.length) {
    console.log("[fetchOhlc] Catch-up: nothing missing, all symbols already have today's bar.");
    return;
  }

  console.log(`[fetchOhlc] Catch-up: ${missing.length} symbols still missing ${today}'s bar, retrying...`);

  const results = [];
  for (const { symbol, consecutive_failures } of missing) {
    const result = await processSymbol(symbol, consecutive_failures ?? 0);
    results.push(result);
    await new Promise(r => setTimeout(r, 300));
  }

  const filled       = results.filter(r => r.status === 'ok' && !r.missingToday).length;
  const stillMissing = results.filter(r => r.missingToday).length;
  console.log(`[fetchOhlc] Catch-up done. ${filled} filled, ${stillMissing} still missing (Groww likely still hasn't published).`);
  return results;
}

module.exports = { runFetchOhlc, runFetchOhlcCatchUp, processSymbol, enrichWithVolAvg };
