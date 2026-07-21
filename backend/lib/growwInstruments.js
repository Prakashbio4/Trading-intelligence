'use strict';

const Papa = require('papaparse');

// Public, unauthenticated instrument master — same file the official Groww
// SDKs read from. Covers every exchange/segment in one CSV, so we filter
// down to the tradable-equity rows we actually want.
const INSTRUMENTS_CSV_URL = 'https://growwapi-assets.groww.in/instruments/instrument.csv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // instrument master changes rarely — refresh once a day

// NSE 'SM' = NSE Emerge/SME. BSE 'A'/'X'/'XT'/'M'/'MT' = real, sampled-and-
// confirmed equity groups (M/MT look like BSE's SME segment). Deliberately
// excludes BSE 'F' (sampled: bonds/NCDs mistagged instrument_type EQ, same
// problem as NSE's N0/N1) and BSE 'B' (sampled: contains real equity mixed
// with mutual-fund segregated-portfolio units in the same series code —
// series alone can't separate them; not confidently includable yet).
const SERIES_BY_EXCHANGE = {
  NSE: ['EQ', 'SM'],
  BSE: ['A', 'X', 'XT', 'M', 'MT'],
};

let _cache = null; // { rows, fetchedAt }
let _fetchPromise = null;

// Catches placeholder/junk rows that slip past the series allowlist: a row
// whose name is empty or identical to its own symbol (seen throughout the
// bond-tagged-EQ samples, e.g. "07AQR — 07AQR"), or whose name matches a
// mutual-fund-scheme naming pattern (seen in BSE's 'B' series sample,
// e.g. "... Segregated Portfolio 2 - Director Bonus Plan").
function looksLikeJunk(row) {
  const name = (row.name || '').trim();
  if (!name || name.toUpperCase() === (row.trading_symbol || '').toUpperCase()) return true;
  return /segregated portfolio|dividend plan|bonus plan|growth plan|regular plan|direct plan/i.test(name);
}

// Our own identifier for a row — NSE (incl. SME) stays bare, matching every
// existing stored symbol exactly (zero migration needed for the ~2389
// already-backfilled NSE symbols). BSE gets a "BSE:" prefix so it can never
// collide with an NSE symbol of the same raw trading_symbol in storage
// (ohlc_records/stock_universe keep their existing plain `symbol text`
// column — this prefix is a pure string convention, not a schema change).
function identifierFor(row) {
  return row.exchange === 'BSE' ? `BSE:${row.trading_symbol}` : row.trading_symbol;
}

async function loadEquityRows() {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.rows;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    const res = await fetch(INSTRUMENTS_CSV_URL);
    if (!res.ok) throw new Error(`Failed to fetch Groww instrument master (${res.status})`);
    const csv = await res.text();
    const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });

    const rows = data.filter(row => {
      const allowedSeries = SERIES_BY_EXCHANGE[row.exchange];
      if (!allowedSeries || row.instrument_type !== 'EQ' || !allowedSeries.includes(row.series)) return false;
      return !looksLikeJunk(row);
    });
    _cache = { rows, fetchedAt: Date.now() };
    return rows;
  })();

  try {
    return await _fetchPromise;
  } finally {
    _fetchPromise = null;
  }
}

// Rank equity rows against a typed string: exact groww_symbol hit first
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
    const id = identifierFor(row);
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({ tradingSymbol: id, name: row.name });
    if (results.length >= limit) break;
  }
  return results;
}

// Look up candidate trading symbols for a ticker that Groww rejected as
// invalid (GA001). Every result here is a *candidate* for a human to confirm
// — never applied automatically, since a wrong auto-correction means silently
// pulling data for the wrong company.
async function findSymbolCandidates(rawSymbol, limit = 3) {
  const needle = rawSymbol.trim().toUpperCase();
  if (!needle) return [];
  const rows = await loadEquityRows();
  return rankMatches(needle, rows, limit);
}

// Typeahead search for the "Stock symbol" input — same ranking, more results,
// and a minimum query length so a single keystroke doesn't dump the whole list.
async function searchSymbols(query, limit = 8) {
  const needle = (query || '').trim().toUpperCase();
  if (needle.length < 2) return [];
  const rows = await loadEquityRows();
  return rankMatches(needle, rows, limit);
}

// Exact-match check against the same cached instrument master — used to
// gate expensive per-symbol operations (like a deep history backfill) so a
// partial string caught mid-typing ("SB", "SBC" while typing "SBCL") never
// triggers one, only a real, complete trading symbol does. Matches against
// our own identifier (bare for NSE, "BSE:"-prefixed for BSE), so callers
// pass exactly what search/chart already use.
async function isValidSymbol(symbol) {
  const needle = (symbol || '').trim().toUpperCase();
  if (!needle) return false;
  const rows = await loadEquityRows();
  return rows.some(r => identifierFor(r).toUpperCase() === needle);
}

// Every equity identifier Groww knows about (NSE mainboard + SME, BSE's
// confirmed equity groups) — the target list for the chart-cache pre-warm
// job. Same cache as everything else here, so this costs nothing beyond
// what's already fetched daily.
async function loadAllEquitySymbols() {
  const rows = await loadEquityRows();
  return [...new Set(rows.map(identifierFor).filter(Boolean))];
}

module.exports = {
  findSymbolCandidates,
  searchSymbols,
  isValidSymbol,
  loadAllEquitySymbols,
  loadEquityRows,
  // Backwards-compatible aliases — kept so nothing outside this file needs
  // to change names in the same commit as the underlying multi-exchange
  // widening. New call sites should prefer the names above.
  findNseSymbolCandidates: findSymbolCandidates,
  searchNseSymbols: searchSymbols,
  isValidNseSymbol: isValidSymbol,
  loadAllNseEquitySymbols: loadAllEquitySymbols,
  loadNseEquityRows: loadEquityRows,
};
