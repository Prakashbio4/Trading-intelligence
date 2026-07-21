'use strict';

const { fetchIntradayOhlc } = require('./groww');
const { withRetry } = require('./retry');
const { isValidNseSymbol } = require('./growwInstruments');

// Single source of truth for which intraday resolutions exist — datafeed.js
// derives /config and /symbols' supported_resolutions from this object's
// keys, so the declared resolutions and what /history actually serves can
// never drift apart.
const RESOLUTION_MINUTES = { '1': 1, '5': 5, '15': 15, '60': 60 };

// Max duration per single request, per Groww's documented limits (verified
// against their real docs — 1min: 7 days, 5min: 15 days, 60min: 150 days;
// 15min isn't explicitly documented, interpolated conservatively between
// 10min's 30-day limit and 60min's 150-day limit). We do one unchunked
// request per call (no multi-request stitching like backfillHistory.js does
// for daily), so this must never exceed what Groww actually allows in a
// single request — also doubles as the default lookback window when the
// widget doesn't pass an explicit `from`. Separately, Groww only retains
// intraday data at all for the last ~3 months regardless of resolution, so
// there's no point defaulting close to the per-request cap for 60min (150
// days) when data past ~90 days back won't exist anyway.
const MAX_WINDOW_DAYS = { '1': 7, '5': 15, '15': 20, '60': 90 };

const TTL_MS = 5 * 60 * 1000; // shorter than daily's 30 min — intraday changes more per interaction
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const _cache = new Map();   // `${symbol}:${resolution}` -> { rows (asc by timestamp), fetchedAt, coverFromTs }
const _pending = new Map(); // in-flight dedupe, same shape as ohlcCache.js/growwInstruments.js

function istDateTimeString(epochSeconds) {
  // Groww's start_time/end_time TZ semantics for intraday ranges are
  // UNVERIFIED — daily usage never exposed a TZ bug because a full calendar
  // day is timezone-agnostic. Assumes IST regardless of server TZ (Railway
  // may run UTC); the +/-1hr pad in getIntradayRows hedges a wrong guess,
  // and results are trimmed precisely afterward using Groww's own
  // unambiguous epoch timestamps.
  const d = new Date(epochSeconds * 1000 + IST_OFFSET_MS);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// toTs/fromTs are unix epoch seconds (as passed by the UDF widget). Returns
// rows ascending by timestamp, each { timestamp, open, high, low, close, volume }.
async function getIntradayRows(symbol, resolution, { toTs, fromTs }) {
  const minutes = RESOLUTION_MINUTES[resolution];
  if (!minutes) throw new Error(`Unsupported intraday resolution: ${resolution}`);

  const key = `${symbol}:${resolution}`;
  const maxWindowDays = MAX_WINDOW_DAYS[resolution];
  const requestedFrom = fromTs != null ? fromTs : toTs - maxWindowDays * 86400;
  const clampedFrom = Math.max(requestedFrom, toTs - maxWindowDays * 86400);

  const cached = _cache.get(key);
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS && clampedFrom >= cached.coverFromTs;
  if (fresh) return cached.rows;
  if (_pending.has(key)) return _pending.get(key);

  const promise = (async () => {
    // Cheap (cached instrument master, no network call) — avoids burning a
    // Groww request on a symbol that's mid-typing garbage or a typo.
    if (!(await isValidNseSymbol(symbol))) return [];

    const rawRows = await withRetry(
      () => fetchIntradayOhlc(symbol, istDateTimeString(clampedFrom - 3600), istDateTimeString(toTs + 3600), minutes),
      { retries: 2, baseDelayMs: 500 } // shorter than the cron-tuned default — this runs inside a live HTTP request
    );
    const rows = rawRows.slice().sort((a, b) => a.timestamp - b.timestamp);
    _cache.set(key, { rows, fetchedAt: Date.now(), coverFromTs: clampedFrom });
    return rows;
  })();

  _pending.set(key, promise);
  try {
    return await promise;
  } finally {
    _pending.delete(key);
  }
}

module.exports = { getIntradayRows, RESOLUTION_MINUTES };
