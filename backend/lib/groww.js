'use strict';

const speakeasy = require('speakeasy');

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

// Token cached in memory — valid until 6 AM next day
let _cachedToken = null;
let _tokenFetchedAt = null;

function tokenIsStale() {
  if (!_cachedToken || !_tokenFetchedAt) return true;
  const now = new Date();
  const fetchedAt = new Date(_tokenFetchedAt);
  // Groww resets tokens at 6 AM IST daily. If fetch date differs from today
  // OR it's past 6 AM and token was fetched before 6 AM today, it's stale.
  const todayReset = new Date(now);
  todayReset.setHours(6, 0, 0, 0); // 6 AM local (server should be IST)
  if (fetchedAt < todayReset && now >= todayReset) return true;
  if (fetchedAt.toDateString() !== now.toDateString()) return true;
  return false;
}

async function getAccessToken() {
  if (!tokenIsStale()) return _cachedToken;

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
    const text = await res.text();
    throw new Error(`Groww auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error(`Groww auth error: ${JSON.stringify(data)}`);
  }

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
    const text = await res.text();
    throw new Error(`Groww OHLC fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(`Groww OHLC error for ${symbol}: ${JSON.stringify(data)}`);
  }

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
    const text = await res.text();
    throw new Error(`Groww intraday OHLC fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(`Groww intraday OHLC error for ${symbol}: ${JSON.stringify(data)}`);
  }

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
    const text = await res.text();
    throw new Error(`Groww live quote fetch failed for ${symbol} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status !== 'SUCCESS') {
    throw new Error(`Groww live quote error for ${symbol}: ${JSON.stringify(data)}`);
  }

  return data.payload;
}

module.exports = { getAccessToken, fetchDailyOhlc, fetchIntradayOhlc, fetchLiveQuote, parseSymbol, invalidateToken };
