'use strict';

const speakeasy = require('speakeasy');

const BASE_URL = 'https://api.groww.in/v1';

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

// Fetch daily OHLC candles for a NSE symbol over a date range.
// symbol: plain ticker e.g. "WIPRO"
// fromDate / toDate: "YYYY-MM-DD" strings
async function fetchDailyOhlc(symbol, fromDate, toDate) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    exchange: 'NSE',
    segment: 'CASH',
    trading_symbol: symbol,
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

// Fetch intraday OHLC candles for a NSE symbol over a date-time range.
// symbol: plain ticker. fromDateTime/toDateTime: "YYYY-MM-DD HH:MM:SS" strings.
// intervalMinutes: e.g. 1, 5, 15, 60. Left as a sibling to fetchDailyOhlc
// rather than a shared refactor — every cron/backfill job depends on
// fetchDailyOhlc's exact behavior, and this keeps that path untouched.
async function fetchIntradayOhlc(symbol, fromDateTime, toDateTime, intervalMinutes) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    exchange: 'NSE',
    segment: 'CASH',
    trading_symbol: symbol,
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

module.exports = { getAccessToken, fetchDailyOhlc, fetchIntradayOhlc };
