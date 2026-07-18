'use strict';

const { fetchIntradayOhlc } = require('./groww');
const { withRetry } = require('./retry');
const { isValidNseSymbol } = require('./growwInstruments');

// Single source of truth for which intraday resolutions exist — datafeed.js
// derives /config and /symbols' supported_resolutions from this object's
// keys, so the declared resolutions and what /history actually serves can
// never drift apart.
const RESOLUTION_MINUTES = { '1': 1, '5': 5, '15': 15, '60': 60 };

// Cold-fetch lookback window per resolution. UNVERIFIED against a real Groww
// account — these just bound request size; if Groww errors or returns empty
// for the full window, tune down. An overly optimistic default degrades
// gracefully (empty payload -> no_data), it doesn't crash anything.
const LOOKBACK_DAYS = { '1': 30, '5': 30, '15': 60, '60': 90 };
const MAX_WINDOW_DAYS = 400; // hard ceiling regardless of what the widget requests

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
  const requestedFrom = fromTs != null ? fromTs : toTs - LOOKBACK_DAYS[resolution] * 86400;
  const clampedFrom = Math.max(requestedFrom, toTs - MAX_WINDOW_DAYS * 86400);

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
