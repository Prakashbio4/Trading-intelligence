'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { searchNseSymbols } = require('../lib/growwInstruments');

// UDF-compatible datafeed for the TradingView Advanced Charts widget embedded
// in Analyse. Public/unauthenticated — it only ever serves NSE OHLC, the same
// data already reachable via /universe, and the UDF adapter bundle doesn't
// support attaching an Authorization header.
// Spec: https://www.tradingview.com/charting-library-docs/latest/connecting_data/UDF

const EXCHANGE = 'NSE';
const SESSION = '0915-1530';
const TIMEZONE = 'Asia/Kolkata';

// GET /datafeed/udf/config
router.get('/config', (_req, res) => {
  res.json({
    supported_resolutions: ['D'],
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
    has_intraday: false,
    has_weekly_and_monthly: false,
    visible_plots_set: 'ohlcv',
    supported_resolutions: ['D'],
    volume_precision: 0,
    data_status: 'endofday',
  });
});

// GET /datafeed/udf/history?symbol=&resolution=&from=&to=&countback=
router.get('/history', async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const to = parseInt(req.query.to);
  const countback = req.query.countback ? parseInt(req.query.countback) : null;
  const from = req.query.from ? parseInt(req.query.from) : null;

  if (!symbol || !to) return res.status(400).json({ s: 'error', errmsg: 'symbol and to are required' });

  const toDate = new Date(to * 1000).toISOString().split('T')[0];

  let query = supabase
    .from('ohlc_records')
    .select('date, open, high, low, close, volume')
    .eq('symbol', symbol)
    .lte('date', toDate);

  // countback takes priority over from per the UDF spec — return the last
  // `countback` bars ending at `to`, ignoring `from` entirely.
  if (countback) {
    query = query.order('date', { ascending: false }).limit(countback);
  } else {
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    query = query.gte('date', fromDate).order('date', { ascending: true });
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ s: 'error', errmsg: error.message });

  const rows = countback ? [...data].reverse() : data;
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
