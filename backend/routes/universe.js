'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { processSymbol } = require('../jobs/fetchOhlc');
const { backfillSymbol } = require('../jobs/backfillHistory');
const { searchNseSymbols } = require('../lib/growwInstruments');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /universe — list all stocks
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('stock_universe')
    .select('*')
    .order('symbol');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /universe/symbols/search?q= — typeahead against Groww's NSE instrument
// master, so the "Stock symbol" input can catch typos before they're saved.
router.get('/symbols/search', async (req, res) => {
  try {
    const results = await searchNseSymbols(req.query.q);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /universe — add a stock. Idempotent: re-adding an existing symbol is
// a no-op rather than a duplicate-key error, so retries from the auto-add
// call in Analyse are safe to fire more than once.
router.post('/', async (req, res) => {
  const { symbol, exchange = 'NSE', sector = '' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const upperSymbol = symbol.toUpperCase();

  const { error } = await supabase
    .from('stock_universe')
    .upsert({ symbol: upperSymbol, exchange, sector, active: true }, { onConflict: 'symbol', ignoreDuplicates: true });

  if (error) return res.status(500).json({ error: error.message });

  // Immediately fetch OHLC for the new stock
  processSymbol(upperSymbol).catch(err =>
    console.error(`[universe] Background OHLC fetch failed for ${upperSymbol}:`, err.message)
  );

  res.status(201).json({ symbol: upperSymbol });
});

// PATCH /universe/:symbol — update (e.g. toggle active, set sector)
router.patch('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const updates = {};
  if (req.body.active   !== undefined) updates.active = req.body.active;
  if (req.body.sector   !== undefined) updates.sector = req.body.sector;
  if (req.body.exchange !== undefined) updates.exchange = req.body.exchange;

  const { data, error } = await supabase
    .from('stock_universe')
    .update(updates)
    .eq('symbol', symbol)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /universe/:symbol
router.delete('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const { error } = await supabase
    .from('stock_universe')
    .delete()
    .eq('symbol', symbol);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: symbol });
});

// POST /universe/:symbol/apply-suggestion — accept the auto-detected correct
// symbol (set by fetchOhlc after a GA001 "invalid symbol" failure) and retry.
// Renames the row rather than updating in place since symbol is the primary key.
router.post('/:symbol/apply-suggestion', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();

  const { data: row, error: fetchErr } = await supabase
    .from('stock_universe')
    .select('*')
    .eq('symbol', symbol)
    .single();
  if (fetchErr || !row) return res.status(404).json({ error: 'symbol not found' });
  if (!row.suggested_symbol) return res.status(400).json({ error: 'no suggestion available for this symbol' });

  const newSymbol = row.suggested_symbol;

  const { error: upsertErr } = await supabase
    .from('stock_universe')
    .upsert({ symbol: newSymbol, exchange: row.exchange, sector: row.sector, active: true }, { onConflict: 'symbol' });
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  const { error: deleteErr } = await supabase.from('stock_universe').delete().eq('symbol', symbol);
  if (deleteErr) return res.status(500).json({ error: deleteErr.message });

  processSymbol(newSymbol).catch(err =>
    console.error(`[universe] Background OHLC fetch failed for ${newSymbol}:`, err.message)
  );

  res.json({ oldSymbol: symbol, newSymbol });
});

// POST /universe/fetch-now — manually trigger OHLC fetch for all active stocks
router.post('/fetch-now', async (_req, res) => {
  const { runFetchOhlc } = require('../jobs/fetchOhlc');
  res.json({ message: 'OHLC fetch started in background' });
  runFetchOhlc().catch(err => console.error('[universe] Manual fetch error:', err.message));
});

// GET /universe/:symbol/window — 7-day candle window around a session date
// ?date=YYYY-MM-DD&patternStart=YYYY-MM-DD&patternEnd=YYYY-MM-DD&windowSize=7
router.get('/:symbol/window', async (req, res) => {
  const symbol       = req.params.symbol.toUpperCase();
  const sessionDate  = req.query.date;
  const patternStart = req.query.patternStart;
  const patternEnd   = req.query.patternEnd   || sessionDate;
  const windowSize   = Math.min(parseInt(req.query.windowSize) || 7, 14);

  if (!sessionDate) return res.status(400).json({ error: 'date is required' });

  // Fetch enough candles before+after the session date
  const from = new Date(sessionDate);
  from.setDate(from.getDate() - (windowSize + 5));
  const to = new Date(sessionDate);
  to.setDate(to.getDate() + (windowSize + 5));

  const { data, error } = await supabase
    .from('ohlc_records')
    .select('date, open, high, low, close, volume, vol_10day_avg, talib_patterns')
    .eq('symbol', symbol)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Find session date index and slice windowSize candles ending on session date
  const sessionIdx = data.findIndex(c => c.date === sessionDate);
  if (sessionIdx === -1) return res.json([]);

  const start = Math.max(0, sessionIdx - windowSize + 1);
  const window = data.slice(start, sessionIdx + 1);

  // Tag each candle with its zone
  const tagged = window.map(c => {
    let zone = 'prior';
    if (patternStart && patternEnd) {
      if (c.date >= patternStart && c.date <= patternEnd) zone = 'pattern';
      else if (c.date === sessionDate) zone = 'today';
      else if (patternEnd && c.date > patternEnd) zone = 'aftermath';
    } else if (c.date === sessionDate) {
      zone = 'today';
    }
    return { ...c, zone };
  });

  res.json(tagged);
});

// POST /universe/:symbol/backfill — deep history backfill (full years, not
// the nightly job's ~20-day window) for a symbol just typed into Analyse's
// live chart. Awaits completion (can take up to ~30s for a brand-new symbol,
// chunked across several Groww calls) so the caller has a real signal for
// when to refresh the chart — backfillSymbol itself skips the work entirely
// if this symbol already has deep history stored, so repeat calls are cheap.
router.post('/:symbol/backfill', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await backfillSymbol(symbol);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /universe/:symbol/ohlc — get stored OHLC + patterns for a symbol
router.get('/:symbol/ohlc', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const days = Math.min(parseInt(req.query.days) || 14, 14);

  const from = new Date();
  from.setDate(from.getDate() - (days + 7)); // extra buffer for weekends/holidays

  const { data, error } = await supabase
    .from('ohlc_records')
    .select('*')
    .eq('symbol', symbol)
    .gte('date', from.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Return only the last `days` trading days (weekends filtered already by exchange)
  const trimmed = data.slice(-days);
  res.json(trimmed);
});

module.exports = router;
