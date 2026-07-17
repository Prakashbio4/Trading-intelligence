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

    // instrument_type === 'EQ' alone isn't enough — Groww's master tags NCD/
    // bond instruments (e.g. "Sammaan Capital Mar'35", series N1/N0) with
    // instrument_type 'EQ' too. `series === 'EQ'` is what actually
    // distinguishes a real tradable stock (confirmed against real data:
    // RELIANCE has series 'EQ', the bond rows have 'N1'/'N0').
    const rows = data.filter(row => row.exchange === 'NSE' && row.instrument_type === 'EQ' && row.series === 'EQ');
    _cache = { rows, fetchedAt: Date.now() };
    return rows;
  })();

  try {
    return await _fetchPromise;
  } finally {
    _fetchPromise = null;
  }
}

// Rank NSE equity rows against a typed string: exact groww_symbol hit first
// (some rejected symbols are actually the groww_symbol, not the trading_symbol
// Groww expects for OHLC calls), then trading symbols that start with it
// (e.g. "GENUS" -> "GENUSPOWER"), then company names containing it.
function rankMatches(needle, rows, limit) {
  const exactGrowwSymbol = rows.filter(r => (r.groww_symbol || '').toUpperCase() === needle);
  const prefixMatches = rows.filter(r => (r.trading_symbol || '').toUpperCase().startsWith(needle));
  const nameMatches = rows.filter(r => (r.name || '').toUpperCase().includes(needle));

  const seen = new Set();
  const results = [];
  for (const row of [...exactGrowwSymbol, ...prefixMatches, ...nameMatches]) {
    if (seen.has(row.trading_symbol)) continue;
    seen.add(row.trading_symbol);
    results.push({ tradingSymbol: row.trading_symbol, name: row.name });
    if (results.length >= limit) break;
  }
  return results;
}

// Look up candidate NSE trading symbols for a ticker that Groww rejected as
// invalid (GA001). Every result here is a *candidate* for a human to confirm
// — never applied automatically, since a wrong auto-correction means silently
// pulling data for the wrong company.
async function findNseSymbolCandidates(rawSymbol, limit = 3) {
  const needle = rawSymbol.trim().toUpperCase();
  if (!needle) return [];
  const rows = await loadNseEquityRows();
  return rankMatches(needle, rows, limit);
}

// Typeahead search for the "Stock symbol" input — same ranking, more results,
// and a minimum query length so a single keystroke doesn't dump the whole list.
async function searchNseSymbols(query, limit = 8) {
  const needle = (query || '').trim().toUpperCase();
  if (needle.length < 2) return [];
  const rows = await loadNseEquityRows();
  return rankMatches(needle, rows, limit);
}

// Exact-match check against the same cached instrument master — used to
// gate expensive per-symbol operations (like a deep history backfill) so a
// partial string caught mid-typing ("SB", "SBC" while typing "SBCL") never
// triggers one, only a real, complete NSE trading symbol does.
async function isValidNseSymbol(symbol) {
  const needle = (symbol || '').trim().toUpperCase();
  if (!needle) return false;
  const rows = await loadNseEquityRows();
  return rows.some(r => (r.trading_symbol || '').toUpperCase() === needle);
}

// Every NSE cash-equity trading symbol Groww knows about — the target list
// for the chart-cache pre-warm job. Same cache as everything else here, so
// this costs nothing beyond what's already fetched daily.
async function loadAllNseEquitySymbols() {
  const rows = await loadNseEquityRows();
  return [...new Set(rows.map(r => r.trading_symbol).filter(Boolean))];
}

module.exports = { findNseSymbolCandidates, searchNseSymbols, isValidNseSymbol, loadAllNseEquitySymbols };
