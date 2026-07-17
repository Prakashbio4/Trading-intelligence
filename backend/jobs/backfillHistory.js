'use strict';

const supabase = require('../lib/supabase');
const { fetchDailyOhlc } = require('../lib/groww');
const { detectPatterns } = require('../lib/patterns');
const { enrichWithVolAvg } = require('./fetchOhlc');

// One-time deep backfill for a symbol's full history — separate from the
// nightly job, which only ever pulls a rolling ~20-day window. Chunked into
// yearly requests so it stays well within any single-request range limit
// Groww's historical candle API might impose.
const CHUNK_DAYS = 365;
const UPSERT_BATCH_SIZE = 500;
const RATE_LIMIT_DELAY_MS = 500;

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function backfillSymbol(symbol, sinceDate = '2020-01-01') {
  const today = new Date().toISOString().split('T')[0];
  let cursor = sinceDate;
  const allCandles = [];

  while (cursor < today) {
    const chunkTo = addDays(cursor, CHUNK_DAYS) > today ? today : addDays(cursor, CHUNK_DAYS);
    console.log(`[backfill] ${symbol}: fetching ${cursor} -> ${chunkTo}`);
    const candles = await fetchDailyOhlc(symbol, cursor, chunkTo);
    allCandles.push(...candles);
    cursor = addDays(chunkTo, 1);
    await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
  }

  // Chunk boundaries can overlap by a day — de-dupe and sort ascending so
  // pattern detection sees a correctly ordered, contiguous series.
  const byDate = new Map(allCandles.map(c => [c.date, c]));
  const candles = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (!candles.length) {
    console.warn(`[backfill] ${symbol}: no candles returned for ${sinceDate} -> ${today}`);
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

  console.log(`[backfill] ${symbol}: ${rows.length} candles stored (${sinceDate} -> ${today})`);
  return { symbol, candles: rows.length };
}

module.exports = { backfillSymbol };
