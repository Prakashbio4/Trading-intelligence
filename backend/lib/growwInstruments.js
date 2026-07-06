'use strict';

const Papa = require('papaparse');

// Public, unauthenticated instrument master — same file the official Groww
// SDKs read from. Covers every exchange/segment in one CSV, so we filter
// down to NSE cash-equity rows for our use case.
const INSTRUMENTS_CSV_URL = 'https://growwapi-assets.groww.in/instruments/instrument.csv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // instrument master changes rarely — refresh once a day

let _cache = null; // { rows, fetchedAt }
let _fetchPromise = null;

async function loadNseEquityRows() {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.rows;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    const res = await fetch(INSTRUMENTS_CSV_URL);
    if (!res.ok) throw new Error(`Failed to fetch Groww instrument master (${res.status})`);
    const csv = await res.text();
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

    const rows = data.filter(row => row.exchange === 'NSE' && row.instrument_type === 'EQ');
    _cache = { rows, fetchedAt: Date.now() };
    return rows;
  })();

  try {
    return await _fetchPromise;
  } finally {
    _fetchPromise = null;
  }
}

// Look up candidate NSE trading symbols for a ticker that Groww rejected as
// invalid. Matches on the exact groww_symbol first (some rejected symbols
// are actually the groww_symbol, not the trading_symbol Groww expects for
// OHLC calls), then falls back to trading symbols that start with the typed
// string (e.g. "GENUS" -> "GENUSPOWER") and company names containing it.
//
// Every result here is a *candidate* for a human to confirm — never applied
// automatically, since a wrong auto-correction means silently pulling data
// for the wrong company.
async function findNseSymbolCandidates(rawSymbol, limit = 3) {
  const needle = rawSymbol.trim().toUpperCase();
  if (!needle) return [];

  const rows = await loadNseEquityRows();

  const exactGrowwSymbol = rows.filter(r => (r.groww_symbol || '').toUpperCase() === needle);
  const prefixMatches = rows.filter(r => (r.trading_symbol || '').toUpperCase().startsWith(needle));
  const nameMatches = rows.filter(r => (r.name || '').toUpperCase().includes(needle));

  const seen = new Set();
  const candidates = [];
  for (const row of [...exactGrowwSymbol, ...prefixMatches, ...nameMatches]) {
    if (seen.has(row.trading_symbol)) continue;
    seen.add(row.trading_symbol);
    candidates.push({ tradingSymbol: row.trading_symbol, name: row.name });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

module.exports = { findNseSymbolCandidates };
