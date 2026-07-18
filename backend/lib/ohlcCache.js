'use strict';

const supabase = require('./supabase');

// Full per-symbol OHLC row cache. The chart datafeed's /history route gets
// hit repeatedly with different date ranges as a user pans/scrolls — each
// hit used to be its own Supabase round trip. A symbol's stored history only
// ever changes via the nightly fetch job or an explicit backfill, and both
// call invalidateSymbol() after writing, so this can be cached in memory and
// sliced locally instead of re-querying per pan step. TTL is just a safety
// net in case some future write path forgets to invalidate.
const TTL_MS = 30 * 60 * 1000;
const _cache = new Map(); // symbol -> { rows, fetchedAt }
const _pending = new Map(); // symbol -> in-flight fetch promise, dedupes concurrent cold hits

async function getSymbolRows(symbol) {
  const cached = _cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rows;
  if (_pending.has(symbol)) return _pending.get(symbol);

  const promise = (async () => {
    const { data, error } = await supabase
      .from('ohlc_records')
      .select('date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('date', { ascending: true });
    if (error) throw new Error(`Failed to load OHLC history for ${symbol}: ${error.message}`);
    _cache.set(symbol, { rows: data, fetchedAt: Date.now() });
    return data;
  })();

  _pending.set(symbol, promise);
  try {
    return await promise;
  } finally {
    _pending.delete(symbol);
  }
}

function invalidateSymbol(symbol) {
  _cache.delete(symbol);
}

module.exports = { getSymbolRows, invalidateSymbol };
