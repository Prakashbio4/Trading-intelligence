'use strict';

const supabase = require('../lib/supabase');
const { fetchDailyOhlc } = require('../lib/groww');
const { detectPatterns } = require('../lib/patterns');

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

  const { error } = await supabase.from('stock_universe').update(updates).eq('symbol', symbol);
  if (error) console.error(`[fetchOhlc] ${symbol}: failed to record fetch status — ${error.message}`);
}

async function recordSuccess(symbol) {
  const { error } = await supabase
    .from('stock_universe')
    .update({ last_fetch_status: 'ok', last_error: null, consecutive_failures: 0 })
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

  await recordSuccess(symbol);
  console.log(`[fetchOhlc] ${symbol}: ${enriched.length} candles, ${patterns.length} patterns`);
  return { symbol, status: 'ok', candles: enriched.length, patterns: patterns.length };
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

  const ok    = results.filter(r => r.status === 'ok').length;
  const err   = results.filter(r => r.status === 'error').length;
  console.log(`[fetchOhlc] Done. ${ok} succeeded, ${err} failed.`);
  return results;
}

module.exports = { runFetchOhlc, processSymbol };
