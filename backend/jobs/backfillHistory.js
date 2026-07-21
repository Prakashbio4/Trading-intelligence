'use strict';

const supabase = require('../lib/supabase');
const { fetchDailyOhlc } = require('../lib/groww');
const { detectPatterns } = require('../lib/patterns');
const { enrichWithVolAvg } = require('./fetchOhlc');
const { invalidateSymbol } = require('../lib/ohlcCache');

// One-time deep backfill for a symbol's full history — separate from the
// nightly job, which only ever pulls a rolling ~20-day window. Chunked into
// yearly requests so it stays well within any single-request range limit
// Groww's historical candle API might impose.
const CHUNK_DAYS = 365;
const UPSERT_BATCH_SIZE = 500;
const RATE_LIMIT_DELAY_MS = 500;

// A brand-new symbol's full history (back to 2020) takes several sequential
// Groww requests — too slow to make a trader wait on before the chart shows
// anything. Fetch and store this much first (awaited, fast — 1-2 chunks),
// then keep pulling everything older in the background.
const PRIORITY_WINDOW_DAYS = 500;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// True if the symbol's earliest stored row is already at or before sinceDate
// — i.e. nothing older to fetch. Lets callers (like "backfill on symbol typed
// in Analyse") re-trigger freely without re-hitting Groww every time. Says
// nothing about how current the *recent* end is — see latestStoredDate.
async function alreadyBackfilled(symbol, sinceDate) {
  const { data, error } = await supabase
    .from('ohlc_records')
    .select('date')
    .eq('symbol', symbol)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to check existing history for ${symbol}: ${error.message}`);
  return !!data && data.date <= sinceDate;
}

// Most recent stored date for a symbol, or null if nothing's stored yet.
async function latestStoredDate(symbol) {
  const { data, error } = await supabase
    .from('ohlc_records')
    .select('date')
    .eq('symbol', symbol)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to check latest stored date for ${symbol}: ${error.message}`);
  return data?.date ?? null;
}

// Fetches [fromDate, toDate], computes patterns/volume averages over just
// that range, and upserts it. Patterns within a few candles of `fromDate`
// may be incomplete if their setup started before this range (no earlier
// context available yet) — a minor, self-correcting gap once the
// background older-history fetch for the preceding range lands.
async function fetchAndStoreRange(symbol, fromDate, toDate) {
  let cursor = fromDate;
  const allCandles = [];

  while (cursor <= toDate) {
    const chunkTo = addDays(cursor, CHUNK_DAYS) > toDate ? toDate : addDays(cursor, CHUNK_DAYS);
    console.log(`[backfill] ${symbol}: fetching ${cursor} -> ${chunkTo}`);
    const candles = await fetchDailyOhlc(symbol, cursor, chunkTo);
    allCandles.push(...candles);
    cursor = addDays(chunkTo, 1);
    if (cursor <= toDate) await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  // Chunk boundaries can overlap by a day — de-dupe and sort ascending so
  // pattern detection sees a correctly ordered, contiguous series.
  const byDate = new Map(allCandles.map(c => [c.date, c]));
  const candles = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (!candles.length) {
    console.warn(`[backfill] ${symbol}: no candles returned for ${fromDate} -> ${toDate}`);
    return { symbol, candles: 0 };
  }

  const enriched = enrichWithVolAvg(candles);
  const patterns = detectPatterns(candles);
  const patternsByDate = {};
  for (const p of patterns) {
    if (!patternsByDate[p.completionDate]) patternsByDate[p.completionDate] = [];
    patternsByDate[p.completionDate].push(p);
  }

  const rows = enriched.map(c => ({
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

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from('ohlc_records').upsert(batch, { onConflict: 'symbol,date' });
    if (error) throw new Error(`Upsert failed for ${symbol} (batch starting row ${i}): ${error.message}`);
  }

  invalidateSymbol(symbol);
  console.log(`[backfill] ${symbol}: ${rows.length} candles stored (${fromDate} -> ${toDate})`);
  return { symbol, candles: rows.length };
}

async function backfillSymbol(symbol, sinceDate = '2020-01-01', { force = false, background = true } = {}) {
  const today = new Date().toISOString().split('T')[0];

  if (!force) {
    const [latest, hasDeepHistory] = await Promise.all([
      latestStoredDate(symbol),
      alreadyBackfilled(symbol, sinceDate),
    ]);

    if (hasDeepHistory) {
      if (latest === today) {
        console.log(`[backfill] ${symbol}: already up to date, skipping`);
        return { symbol, candles: 0, skipped: true };
      }
      // Deep history exists but the recent end is stale — top up just the
      // missing tail instead of a full re-backfill. alreadyBackfilled only
      // ever checks the OLD end of the range, never freshness, so without
      // this a symbol backfilled once would silently go stale forever, no
      // matter how many times it got re-typed into the chart. Groww
      // returning zero candles here (weekend/holiday/market not yet closed)
      // is expected and handled by fetchAndStoreRange already.
      const topUpFrom = addDays(latest, 1);
      const result = await fetchAndStoreRange(symbol, topUpFrom, today);
      console.log(`[backfill] ${symbol}: topped up ${topUpFrom} -> ${today} (stale since ${latest})`);
      return result;
    }
  }

  // No usable deep history yet (or force=true) — full backfill, same as before.
  const priorityFrom = addDays(today, -PRIORITY_WINDOW_DAYS);
  const recentFrom = priorityFrom > sinceDate ? priorityFrom : sinceDate;

  const recentResult = await fetchAndStoreRange(symbol, recentFrom, today);

  if (recentFrom > sinceDate) {
    const olderHistory = fetchAndStoreRange(symbol, sinceDate, addDays(recentFrom, -1));
    if (background) {
      // Fire-and-forget — right for the on-demand "symbol just typed into
      // Analyse" caller, which wants a fast return and doesn't need the
      // full multi-year history immediately. Wrong for a bulk caller
      // (prewarmChartCache.js) processing many symbols in a loop: without
      // awaiting here, each new symbol kicks off its own untracked
      // background fetch chain and the loop immediately moves to the next
      // one, so dozens of symbols' older-history chains end up running
      // concurrently, uncoordinated with each other or the loop's own
      // pacing delay. background:false makes this caller wait for the full
      // backfill before moving on, keeping the whole batch properly paced.
      olderHistory.catch(err =>
        console.error(`[backfill] ${symbol}: background older-history fetch failed — ${err.message}`)
      );
    } else {
      await olderHistory;
    }
  }

  return recentResult;
}

module.exports = { backfillSymbol, fetchAndStoreRange, alreadyBackfilled, latestStoredDate };
