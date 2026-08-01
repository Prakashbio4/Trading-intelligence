'use strict';

const supabase = require('./supabase');

// NSE/BSE trading-day awareness. Weekends are a fixed rule, but most Indian
// market holidays (Diwali, Holi, Eid, etc.) are festival-based and shift
// every year, so they're backed by a Supabase table (trading_holidays)
// instead of a hardcoded list — see db/migrations/016_trading_holidays.sql.
// An empty/unreachable table degrades to weekend-only trading-day logic
// (the previous behavior), so nothing breaks before it's populated.
const TTL_MS = 24 * 60 * 60 * 1000; // holidays don't change intra-day; cache generously
let _cache = null; // { dates: Set<string>, fetchedAt }

async function loadHolidays() {
  if (_cache && Date.now() - _cache.fetchedAt < TTL_MS) return _cache.dates;

  const { data, error } = await supabase.from('trading_holidays').select('date');
  if (error) {
    console.error('[tradingCalendar] Failed to load trading_holidays, falling back to weekend-only:', error.message);
    return _cache?.dates ?? new Set();
  }

  const dates = new Set((data ?? []).map(r => r.date));
  _cache = { dates, fetchedAt: Date.now() };
  return dates;
}

// Re-bases "now" onto the IST calendar date regardless of host timezone
// (Railway runs UTC) — same trick used by fetchOhlc.js's todayIST().
function nowIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function isTradingDay(date) {
  if (isWeekend(date)) return false;
  const holidays = await loadHolidays();
  return !holidays.has(date.toISOString().split('T')[0]);
}

// Walks backward from `date` to the most recent trading day. `inclusive`
// (default true) controls whether `date` itself is eligible — pass false
// when `date`'s own session hasn't closed/finalized yet, so it never
// qualifies as "the last trading day" even if it is one.
async function mostRecentTradingDay(date, { inclusive = true } = {}) {
  const d = new Date(date);
  if (!inclusive) d.setDate(d.getDate() - 1);
  while (!(await isTradingDay(d))) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function invalidateCache() {
  _cache = null;
}

module.exports = { isTradingDay, mostRecentTradingDay, nowIST, invalidateCache };
