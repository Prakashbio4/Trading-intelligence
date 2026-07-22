'use strict';

const speakeasy = require('speakeasy');
const { sendAlert } = require('./alerts');

const BASE_URL = 'https://api.groww.in/v1';

// Our own symbols carry an "EXCHANGE:" prefix for non-NSE listings (e.g.
// "BSE:ABBOTINDIA") — see growwInstruments.js. NSE stays bare for backward
// compatibility with every existing stored symbol. Groww's own API doesn't
// know about this convention, so every call site needs the split-out
// {exchange, symbol} before building request params.
function parseSymbol(symbol) {
  const i = symbol.indexOf(':');
  return i === -1 ? { exchange: 'NSE', symbol } : { exchange: symbol.slice(0, i), symbol: symbol.slice(i + 1) };
}

// Token cached in memory — nominally valid until 6 AM next day, but that's
// Groww's *documented* reset, not a guarantee it survives that long in
// practice (production has seen a token go bad well before 6 AM, taking
// every symbol down with it — see invalidateToken below). MAX_TOKEN_AGE_MS
// forces a proactive refresh well inside any single day's window regardless
// of the 6 AM boundary, so a mid-day failure mode gets less time to matter
// before a plain cache-age check would have caught it anyway.
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
let _cachedToken = null;
let _tokenFetchedAt = null;

function tokenIsStale() {
  if (!_cachedToken || !_tokenFetchedAt) return true;
  const now = new Date();
  const fetchedAt = new Date(_tokenFetchedAt);
  if (now - fetchedAt > MAX_TOKEN_AGE_MS) return true;
  // Groww resets tokens at 6 AM IST daily. If fetch date differs from today
  // OR it's past 6 AM and token was fetched before 6 AM today, it's stale.
  const todayReset = new Date(now);
  todayReset.setHours(6, 0, 0, 0); // 6 AM local (server should be IST)
  if (fetchedAt < todayReset && now >= todayReset) return true;
  if (fetchedAt.toDateString() !== now.toDateString()) return true;
  return false;
}

// Circuit breaker: protects against hammering a systemically broken Groww
// integration (token dead even right after a refresh, a sustained outage, a
// revoked API key) with doomed request after doomed request — the real risk
// for prewarmChartCache's ~7000-symbol loop, which would otherwise burn
// through the whole universe at 3 retries apiece before anyone noticed.
// Trips after CIRCUIT_THRESHOLD consecutive failures across ANY Groww call
// (auth or data endpoint — they share the same underlying integration and a
// broken one usually means the other is too), then fails fast without
// touching the network for CIRCUIT_COOLDOWN_MS, and fires a single alert
// rather than one per doomed call. Resets on the next success.
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000;
let _consecutiveFailures = 0;
let _circuitOpenUntil = 0;

function circuitCheck() {
  if (Date.now() < _circuitOpenUntil) {
    throw new Error(`Groww circuit breaker open — ${_consecutiveFailures} consecutive failures, cooling down until ${new Date(_circuitOpenUntil).toISOString()}`);
  }
}

function recordGrowwSuccess() {
  _consecutiveFailures = 0;
}

function recordGrowwFailure(context) {
  _consecutiveFailures++;
  if (_consecutiveFailures >= CIRCUIT_THRESHOLD && Date.now() >= _circuitOpenUntil) {
    _circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    sendAlert(
      'Groww API circuit breaker tripped',
      `${_consecutiveFailures} consecutive Groww failures (latest: ${context}). Pausing all Groww calls for ${CIRCUIT_COOLDOWN_MS / 60000} minutes to avoid hammering a broken integration.`,
      'groww-circuit-breaker'
    ).catch(err => console.error('[groww] failed to send circuit breaker alert:', err.message));
  }
}

async function getAccessToken() {
  if (!tokenIsStale()) return _cachedToken;
  circuitCheck();

  const apiKey = process.env.GROWW_API_KEY;
  const totpSecret = process.env.GROWW_TOTP_SECRET;

  if (!apiKey || !totpSecret) {
    throw new Error('GROWW_API_KEY and GROWW_TOTP_SECRET must be set in .env');
  }

  const totp = speakeasy.totp({ secret: totpSecret, encoding: 'base32' });

  const res = await fetch(`${BASE_URL}/token/api/access`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key_type: 'totp', totp }),
  });

  if (!res.ok) {
    recordGrowwFailure(`auth (${res.status})`);
    const text = await res.text();
    throw new Error(`Groww auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) {
    recordGrowwFailure('auth (no token in response)');
    throw new Error(`Groww auth error: ${JSON.stringify(data)}`);
  }

  // Deliberately no recordGrowwSuccess() here — issuing a token isn't the
  // outcome callers actually want, and the exact failure mode this circuit
  // breaker exists for is auth succeeding while the subsequent data call
  // keeps 401ing (confirmed in production). Resetting on token issuance
  // would let that loop reset the counter every cycle and never trip.
  // Only a genuinely successful data call (recordGrowwSuccess in the fetch*
  // functions below) should reset it; a real auth failure still counts
  // toward tripping via recordGrowwFailure above.
  _cachedToken = data.token;
  _tokenFetchedAt = new Date().toISOString();
  return _cachedToken;
}

// Groww's token can go bad before our 6 AM cache-expiry assumption thinks it
// should (observed in production: a run of consecutive 401s across unrelated
// symbols, meaning the token itself — not any per-symbol condition — went
// dead early). Call this on a 401 response so the next withRetry attempt
// re-authenticates instead of hammering the same dead token until the next
// natural 6 AM refresh or a manual restart.
function invalidateToken() {
  _cachedToken = null;
  _tokenFetchedAt = null;
}

// Fetch daily OHLC candles for a symbol over a date range.
// symbol: plain NSE ticker (e.g. "WIPRO") or "EXCHANGE:ticker" (e.g. "BSE:ABBOTINDIA")
// fromDate / toDate: "YYYY-MM-DD" strings
async function fetchDailyOhlc(symbol, fromDate, toDate) {
  circuitCheck();
  const token = await getAccessToken();
  const { exchange, symbol: tradingSymbol } = parseSymbol(symbol);

  const params = new URLSearchParams({
    exchange,
    segment: 'CASH',
    trading_symbol: tradingSymbol,
    start_time: `${fromDate} 00:00:00`,
    end_time: `${toDate} 23:59:59`,
    interval_in_minutes: '1440',
  });

  const res = await fetch(`${BASE_URL}/historical/candle/range?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-API-VERSION': '1.0',
    },
  });

  if (!res.ok) {
    if (res.status === 401) invalidateToken();
    recordGrowwFailure(`${symbol} OHLC (${res.status})`);
    const text = await res.text();
    throw new Error(`Groww OHLC fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    recordGrowwFailure(`${symbol} OHLC (non-SUCCESS payload)`);
    throw new Error(`Groww OHLC error for ${symbol}: ${JSON.stringify(data)}`);
  }
  recordGrowwSuccess();

  // Raw candle format: [timestamp_epoch_seconds, open, high, low, close, volume]
  return (data.payload.candles || []).map(([ts, open, high, low, close, volume]) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    open:   Number(open),
    high:   Number(high),
    low:    Number(low),
    close:  Number(close),
    volume: Number(volume),
  }));
}

// Fetch intraday OHLC candles for a symbol over a date-time range.
// symbol: plain NSE ticker or "EXCHANGE:ticker" (see parseSymbol).
// fromDateTime/toDateTime: "YYYY-MM-DD HH:MM:SS" strings.
// intervalMinutes: e.g. 1, 5, 15, 60. Left as a sibling to fetchDailyOhlc
// rather than a shared refactor — every cron/backfill job depends on
// fetchDailyOhlc's exact behavior, and this keeps that path untouched.
async function fetchIntradayOhlc(symbol, fromDateTime, toDateTime, intervalMinutes) {
  circuitCheck();
  const token = await getAccessToken();
  const { exchange, symbol: tradingSymbol } = parseSymbol(symbol);

  const params = new URLSearchParams({
    exchange,
    segment: 'CASH',
    trading_symbol: tradingSymbol,
    start_time: fromDateTime,
    end_time: toDateTime,
    interval_in_minutes: String(intervalMinutes),
  });

  const res = await fetch(`${BASE_URL}/historical/candle/range?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-API-VERSION': '1.0',
    },
  });

  if (!res.ok) {
    if (res.status === 401) invalidateToken();
    recordGrowwFailure(`${symbol} intraday (${res.status})`);
    const text = await res.text();
    throw new Error(`Groww intraday OHLC fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    recordGrowwFailure(`${symbol} intraday (non-SUCCESS payload)`);
    throw new Error(`Groww intraday OHLC error for ${symbol}: ${JSON.stringify(data)}`);
  }
  recordGrowwSuccess();

  // Keep the full epoch timestamp (unlike fetchDailyOhlc, which collapses to
  // a date string) — intraday bars need time-of-day precision.
  return (data.payload.candles || []).map(([ts, open, high, low, close, volume]) => ({
    timestamp: ts,
    open:   Number(open),
    high:   Number(high),
    low:    Number(low),
    close:  Number(close),
    volume: Number(volume),
  }));
}

// Fetch a real-time quote snapshot (today's running OHLC + volume + last
// price) for a single symbol (plain NSE ticker or "EXCHANGE:ticker").
// Distinct from fetchDailyOhlc/fetchIntradayOhlc — those hit the
// historical-candle API and only ever return completed candles; this hits
// Groww's live-data API for the still-forming "today" bar. Returns the raw
// payload — parsing/shaping into a bar happens in lib/liveQuote.js.
async function fetchLiveQuote(symbol) {
  circuitCheck();
  const token = await getAccessToken();
  const { exchange, symbol: tradingSymbol } = parseSymbol(symbol);

  const params = new URLSearchParams({
    exchange,
    segment: 'CASH',
    trading_symbol: tradingSymbol,
  });

  const res = await fetch(`${BASE_URL}/live-data/quote?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-API-VERSION': '1.0',
    },
  });

  if (!res.ok) {
    if (res.status === 401) invalidateToken();
    recordGrowwFailure(`${symbol} live quote (${res.status})`);
    const text = await res.text();
    throw new Error(`Groww live quote fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    recordGrowwFailure(`${symbol} live quote (non-SUCCESS payload)`);
    throw new Error(`Groww live quote error for ${symbol}: ${JSON.stringify(data)}`);
  }
  recordGrowwSuccess();

  return data.payload;
}

module.exports = { getAccessToken, fetchDailyOhlc, fetchIntradayOhlc, fetchLiveQuote, parseSymbol, invalidateToken };
