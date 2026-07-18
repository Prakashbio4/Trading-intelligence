'use strict';

const express = require('express');
const router = express.Router();
const { searchNseSymbols } = require('../lib/growwInstruments');
const { getSymbolRows } = require('../lib/ohlcCache');
const { getIntradayRows, RESOLUTION_MINUTES } = require('../lib/ohlcIntradayCache');
const { aggregate } = require('../lib/ohlcAggregate');

// UDF-compatible datafeed for the TradingView Advanced Charts widget embedded
// in Analyse. Public/unauthenticated — it only ever serves NSE OHLC, the same
// data already reachable via /universe, and the UDF adapter bundle doesn't
// support attaching an Authorization header.
// Spec: https://www.tradingview.com/charting-library-docs/latest/connecting_data/UDF

const EXCHANGE = 'NSE';
const SESSION = '0915-1530';
const TIMEZONE = 'Asia/Kolkata';

// Single source of truth for what resolutions this datafeed serves — derived
// from ohlcIntradayCache's resolution map plus the daily/weekly/monthly set,
// so /config, /symbols, and /history's routing can never drift apart.
const RESOLUTIONS = [...Object.keys(RESOLUTION_MINUTES), 'D', 'W', 'M'];
const RESOLUTION_SET = new Set(RESOLUTIONS);

// GET /datafeed/udf/config
router.get('/config', (_req, res) => {
  res.json({
    supported_resolutions: RESOLUTIONS,
    supports_search: true,
    supports_group_request: false,
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,
    exchanges: [{ value: EXCHANGE, name: EXCHANGE, desc: EXCHANGE }],
    symbols_types: [{ name: 'Stock', value: 'stock' }],
  });
});

// GET /datafeed/udf/time
router.get('/time', (_req, res) => {
  res.json(Math.floor(Date.now() / 1000));
});

// GET /datafeed/udf/search?query=&limit=
router.get('/search', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 30);
    const results = await searchNseSymbols(req.query.query, limit);
    res.json(results.map(r => ({
      symbol: r.tradingSymbol,
      full_name: `${EXCHANGE}:${r.tradingSymbol}`,
      description: r.name,
      exchange: EXCHANGE,
      ticker: r.tradingSymbol,
      type: 'stock',
    })));
  } catch (err) {
    res.status(502).json({ s: 'error', errmsg: err.message });
  }
});

// GET /datafeed/udf/symbols?symbol=
// Resolves any well-formed symbol, not just ones already in stock_universe —
// Analyse needs to chart stocks a trader hasn't tracked yet. /history simply
// returns no_data for symbols with nothing fetched, which the widget handles
// gracefully (empty chart, no error), so there's nothing to gate here.
router.get('/symbols', (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ s: 'error', errmsg: 'symbol is required' });

  res.json({
    ticker: symbol,
    name: symbol,
    full_name: `${EXCHANGE}:${symbol}`,
    description: symbol,
    exchange: EXCHANGE,
    listed_exchange: EXCHANGE,
    type: 'stock',
    session: SESSION,
    timezone: TIMEZONE,
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    has_weekly_and_monthly: true,
    visible_plots_set: 'ohlcv',
    supported_resolutions: RESOLUTIONS,
    volume_precision: 0,
    // Still accurate even at 1-minute granularity — Groww's endpoint is a
    // historical-candle API, not a live/streaming feed.
    data_status: 'endofday',
  });
});

// GET /datafeed/udf/history?symbol=&resolution=&from=&to=&countback=
router.get('/history', async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const resolution = req.query.resolution || 'D';
  const to = parseInt(req.query.to);
  const countback = req.query.countback ? parseInt(req.query.countback) : null;
  const from = req.query.from ? parseInt(req.query.from) : null;

  if (!symbol || !to) return res.status(400).json({ s: 'error', errmsg: 'symbol and to are required' });
  if (!RESOLUTION_SET.has(resolution)) return res.status(400).json({ s: 'error', errmsg: `unsupported resolution: ${resolution}` });

  if (RESOLUTION_MINUTES[resolution]) {
    let rows;
    try {
      rows = await getIntradayRows(symbol, resolution, { toTs: to, fromTs: from });
    } catch (err) {
      // Groww's intraday behavior (lookback limits, empty vs error response
      // for an out-of-range request) is unverified — degrade to no_data
      // instead of a hard 500 so one bad symbol/range doesn't break the
      // widget. Still logged so it's diagnosable from Railway logs.
      console.error(`[datafeed] intraday fetch failed for ${symbol} ${resolution}: ${err.message}`);
      return res.json({ s: 'no_data' });
    }

    let filtered = rows.filter(r => r.timestamp <= to);
    filtered = countback ? filtered.slice(-countback) : filtered.filter(r => from == null || r.timestamp >= from);
    if (!filtered.length) return res.json({ s: 'no_data' });

    return res.json({
      s: 'ok',
      t: filtered.map(r => r.timestamp),
      o: filtered.map(r => Number(r.open)),
      h: filtered.map(r => Number(r.high)),
      l: filtered.map(r => Number(r.low)),
      c: filtered.map(r => Number(r.close)),
      v: filtered.map(r => Number(r.volume)),
    });
  }

  // --- daily / weekly / monthly ---
  const toDate = new Date(to * 1000).toISOString().split('T')[0];

  let allRows;
  try {
    allRows = await getSymbolRows(symbol);
  } catch (err) {
    return res.status(500).json({ s: 'error', errmsg: err.message });
  }

  // allRows is cached ascending by date — slice locally instead of
  // re-querying Supabase per pan/scroll step. Aggregate to W/M BEFORE
  // slicing to a range, not after — slicing first would silently truncate
  // a week/month's early days at the from/to boundary.
  const bars = resolution === 'D' ? allRows : aggregate(allRows, resolution);

  let rows = bars.filter(r => r.date <= toDate);

  // countback takes priority over from per the UDF spec — return the last
  // `countback` bars ending at `to`, ignoring `from` entirely.
  if (countback) {
    rows = rows.slice(-countback);
  } else {
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    rows = rows.filter(r => r.date >= fromDate);
  }

  if (!rows.length) return res.json({ s: 'no_data' });

  res.json({
    s: 'ok',
    t: rows.map(r => Math.floor(new Date(r.date).getTime() / 1000)),
    o: rows.map(r => Number(r.open)),
    h: rows.map(r => Number(r.high)),
    l: rows.map(r => Number(r.low)),
    c: rows.map(r => Number(r.close)),
    v: rows.map(r => Number(r.volume)),
  });
});

module.exports = router;
