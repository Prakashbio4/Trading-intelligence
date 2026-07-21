'use strict';

const { fetchLiveQuote } = require('./groww');
const { withRetry } = require('./retry');

// Short TTL — this exists specifically to stay current while a chart is
// open and being polled every ~45s by the widget, unlike ohlcCache's 30min
// (which caches settled, rarely-changing history).
const TTL_MS = 10 * 1000;
const _cache = new Map(); // symbol -> { bar, fetchedAt }
const _pending = new Map(); // symbol -> in-flight promise, dedupes concurrent hits

// Per Groww's response schema table for /live-data/quote, open/high/low/
// close/last_price/volume are plain top-level decimal/integer fields — not
// nested in a stringified object (an earlier, less authoritative example in
// their docs suggested otherwise; the schema table takes precedence).
function toBar(payload) {
  if (!payload) return null;
  const { open, high, low } = payload;
  if ([open, high, low].some(v => typeof v !== 'number' || Number.isNaN(v))) return null;

  // last_price is the current running price — more accurate for "close" of
  // the still-forming today bar than payload.close, which per the schema is
  // just "Closing price" (ambiguous whether that's yesterday's or today's
  // as-of-now). Fall back to payload.close if last_price is missing.
  const close = typeof payload.last_price === 'number' ? payload.last_price : payload.close;
  if (typeof close !== 'number' || Number.isNaN(close)) return null;

  return {
    date: new Date().toISOString().split('T')[0],
    open,
    high,
    low,
    close,
    volume: typeof payload.volume === 'number' ? payload.volume : 0,
  };
}

// Returns today's live bar for a symbol, or null if anything about the live
// fetch fails — a null here must never break the chart, only mean "no live
// overlay this time," falling back to whatever's already stored.
async function getLiveBar(symbol) {
  const cached = _cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.bar;
  if (_pending.has(symbol)) return _pending.get(symbol);

  const promise = (async () => {
    try {
      const payload = await withRetry(() => fetchLiveQuote(symbol), { retries: 1, baseDelayMs: 300 });
      const bar = toBar(payload);
      _cache.set(symbol, { bar, fetchedAt: Date.now() });
      return bar;
    } catch (err) {
      console.error(`[liveQuote] ${symbol}: live quote fetch failed — ${err.message}`);
      _cache.set(symbol, { bar: null, fetchedAt: Date.now() });
      return null;
    }
  })();

  _pending.set(symbol, promise);
  try {
    return await promise;
  } finally {
    _pending.delete(symbol);
  }
}

module.exports = { getLiveBar };
