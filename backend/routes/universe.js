'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { processSymbol } = require('../jobs/fetchOhlc');
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

// POST /universe — add a stock
router.post('/', async (req, res) => {
  const { symbol, exchange = 'NSE', sector = '' } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const { data, error } = await supabase
    .from('stock_universe')
    .insert({ symbol: symbol.toUpperCase(), exchange, sector, active: true })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Immediately fetch OHLC for the new stock
  processSymbol(data.symbol).catch(err =>
    console.error(`[universe] Background OHLC fetch failed for ${data.symbol}:`, err.message)
  );

  res.status(201).json(data);
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

// POST /universe/fetch-now — manually trigger OHLC fetch for all active stocks
router.post('/fetch-now', async (_req, res) => {
  const { runFetchOhlc } = require('../jobs/fetchOhlc');
  res.json({ message: 'OHLC fetch started in background' });
  runFetchOhlc().catch(err => console.error('[universe] Manual fetch error:', err.message));
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
