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

  console.log(`[groww] auth attempt — totp=${totp} apiKeyPrefix=${apiKey.slice(0,20)}`);
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
// symbol: plain ticker e.g. "WIPRO" — we prefix "NSE-" internally
// fromDate / toDate: "YYYY-MM-DD" strings
async function fetchDailyOhlc(symbol, fromDate, toDate) {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    exchange: 'NSE',
    segment: 'CASH',
    groww_symbol: `NSE-${symbol}`,
    start_time: `${fromDate} 00:00:00`,
    end_time: `${toDate} 23:59:59`,
    candle_interval: 'DAILY',
  });

  const res = await fetch(`${BASE_URL}/historical/candles?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-API-VERSION': '1.0',
      'Content-Type': 'application/json',
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

module.exports = { getAccessToken, fetchDailyOhlc };
