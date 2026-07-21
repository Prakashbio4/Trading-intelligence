'use strict';

const Papa = require('papaparse');

// Public, unauthenticated instrument master — same file the official Groww
// SDKs read from. Covers every exchange/segment in one CSV, so we filter
// down to the tradable-equity rows we actually want.
const INSTRUMENTS_CSV_URL = 'https://growwapi-assets.groww.in/instruments/instrument.csv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // instrument master changes rarely — refresh once a day

// Verified against the full instrument master (147k rows), not just samples.
// NSE 'SM' = NSE Emerge/SME, 'BE' = Trade-to-Trade mainboard (real companies,
// just settled differently — was missing from the filter entirely before).
// BSE 'A'/'B'/'T'/'X'/'XT'/'M'/'MT'/'Z' = real equity groups, confirmed by
// spot-checking company names across the full dataset (B looked mixed from
// an 8-row sample earlier, but at full scale is 1347 real companies vs 197
// mutual-fund units — cleanly separable by ISIN prefix, see looksLikeJunk).
// Deliberately excludes:
//  - BSE 'F' (3266 rows, 100% NCDs/bonds mistagged instrument_type=EQ — same
//    problem as NSE's N0/N1 — confirmed via maturity-date-suffixed names
//    like "Kosamattam Finance Limited Aug'31" and terse bond codes)
//  - BSE 'G' (162 rows — government securities/gilts, e.g. "654GOI2032",
//    not company equity, doesn't trip any of the junk heuristics below so
//    has to be excluded at the series level)
const SERIES_BY_EXCHANGE = {
  NSE: ['EQ', 'SM', 'BE'],
  BSE: ['A', 'B', 'T', 'X', 'XT', 'M', 'MT', 'Z'],
};

let _cache = null; // { rows, fetchedAt }
let _fetchPromise = null;

// Catches non-equity rows that slip past the series allowlist:
//  - name is empty (placeholder rows within bond-tagged series)
//  - ISIN starts with "INF" — the standard Indian ISIN prefix for mutual
//    fund/ETF units, as opposed to "INE" for company-issued securities
//    (equity or debt). This is what actually separates BSE 'B's real
//    companies from its mixed-in fund units — found 327 of these already
//    silently present in the *existing*, already-deployed NSE filter too.
//  - name ends in a maturity-date suffix like "Jul'27" — NCD/bond naming
//    convention, catches debt instruments an INF/empty check alone misses
//    (an earlier "name === trading_symbol" heuristic here produced false
//    positives on real companies whose short name equals their ticker,
//    e.g. "ALANKIT — Alankit" — replaced with these more precise checks).
function looksLikeJunk(row) {
  const name = (row.name || '').trim();
  if (!name) return true;
  if ((row.isin || '').startsWith('INF')) return true;
  return /'\d{2}[A-Z]?$/i.test(name);
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
      if (!row.trading_symbol || looksLikeJunk(row)) return false;
      // Indices (NIFTY, BANKNIFTY, SENSEX, INDIA VIX, ...) have no series
      // value at all in Groww's data (instrument_type='IDX' instead) — 31
      // real rows across NSE/BSE, all clean, verified against the full file.
      if (row.instrument_type === 'IDX') return true;
      const allowedSeries = SERIES_BY_EXCHANGE[row.exchange];
      return !!allowedSeries && row.instrument_type === 'EQ' && allowedSeries.includes(row.series);
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
    results.push({ tradingSymbol: id, name: row.name, type: row.instrument_type === 'IDX' ? 'index' : 'stock' });
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
