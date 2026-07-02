const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const { evaluateSetup, directionForBias, computeTradeLevels, TREND_LOOKBACK, SR_LOOKBACK } = require('../lib/setupContext');
const { evaluateOutcome } = require('../lib/setupOutcome');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

async function uploadToSupabase(buffer, mimetype, userId) {
  const ext = mimetype.split('/')[1] || 'png';
  const filename = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('chart-images')
    .upload(filename, buffer, { contentType: mimetype, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('chart-images').getPublicUrl(filename);
  return data.publicUrl;
}

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Conversion helpers ────────────────────────────────────────────────────────

function toDb(s) {
  return {
    module: s.module,
    ticker: s.ticker,
    timeframe: s.timeframe,
    chart_source: s.chartSource,
    date: s.date,
    lookback_window: s.lookbackWindow,
    image_path: s.imagePath,
    prompt_version: s.promptVersion,
    form_data: s.formData,
    user_input: s.userInput,
    ai_what_i_see: s.aiWhatISee,
    ai_narrative: s.aiNarrative,
    ai_decision: s.aiDecision,
    ai_corrections: s.aiCorrections,
    ai_annotation: s.aiAnnotation,
    ai_analysis: s.aiAnalysis,
    decision: s.decision,
    confidence: s.confidence,
    planned_entry: s.plannedEntry,
    planned_sl: s.plannedSL,
    planned_target: s.plannedTarget,
    planned_rrr: s.plannedRRR,
    actual_entry: s.actualEntry,
    actual_exit: s.actualExit,
    holding_period: s.holdingPeriod,
    trade_entry_date: s.tradeEntryDate ?? null,
    trade_exit_date:  s.tradeExitDate  ?? null,
    quantity:         s.quantity        ?? null,
    exit_price: s.exitPrice,
    pnl: s.pnl,
    outcome: s.outcome,
    outcome_data: s.outcomeData ?? null,
    notes: s.notes,
    learning_tags: s.learningTags,
    ai_verdict: s.aiVerdict,
    chat_history: s.chatHistory,
    user_id: s.userId,
    talib_patterns: s.talibPatterns ?? [],
  };
}

function fromDb(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    module: row.module,
    ticker: row.ticker,
    timeframe: row.timeframe,
    chartSource: row.chart_source,
    date: row.date,
    lookbackWindow: row.lookback_window,
    imagePath: row.image_path,
    promptVersion: row.prompt_version,
    formData: row.form_data,
    userInput: row.user_input,
    aiWhatISee: row.ai_what_i_see,
    aiNarrative: row.ai_narrative,
    aiDecision: row.ai_decision,
    aiCorrections: row.ai_corrections,
    aiAnnotation: row.ai_annotation,
    aiAnalysis: row.ai_analysis,
    decision: row.decision,
    confidence: row.confidence,
    plannedEntry: row.planned_entry,
    plannedSL: row.planned_sl,
    plannedTarget: row.planned_target,
    plannedRRR: row.planned_rrr,
    actualEntry: row.actual_entry,
    actualExit: row.actual_exit,
    holdingPeriod: row.holding_period,
    tradeEntryDate: row.trade_entry_date ?? null,
    tradeExitDate:  row.trade_exit_date  ?? null,
    quantity:       row.quantity         ?? null,
    exitPrice: row.exit_price,
    pnl: row.pnl,
    outcome: row.outcome,
    outcomeData: row.outcome_data ?? null,
    notes: row.notes,
    learningTags: row.learning_tags,
    aiVerdict: row.ai_verdict,
    chatHistory: row.chat_history,
    userId: row.user_id,
    outcomeChartEntry: row.outcome_chart_entry,
    outcomeChartExit:  row.outcome_chart_exit,
    priceT3:        row.price_t3,
    priceT5:        row.price_t5,
    priceT10:       row.price_t10,
    outcomeAuto:    row.outcome_auto ?? {},
    talibPatterns:  row.talib_patterns ?? [],
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /journal
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { module: mod, verdict, outcome, pattern } = req.query;
    const isSuperuser = req.user.role === 'superuser';

    let query = supabase
      .from('journal_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isSuperuser) query = query.eq('user_id', req.user.userId);
    if (mod) query = query.eq('module', mod);
    if (outcome) query = query.eq('outcome', outcome);

    const { data, error } = await query;
    if (error) throw error;

    let sessions = data.map(fromDb);

    if (verdict) sessions = sessions.filter(s => s.aiVerdict === verdict);
    if (pattern) sessions = sessions.filter(s =>
      s.userInput?.candlePattern?.toLowerCase().includes(pattern.toLowerCase())
    );

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Could not read journal', detail: err.message });
  }
});

// GET /journal/insights-context
router.get('/insights-context', authMiddleware, async (req, res) => {
  try {
    const isSuperuser = req.user.role === 'superuser';

    let query = supabase
      .from('journal_sessions')
      .select('decision, ai_decision, ai_verdict, user_input, form_data');

    if (!isSuperuser) query = query.eq('user_id', req.user.userId);

    const { data, error } = await query;
    if (error) throw error;

    const sessions = data.map(fromDb);
    const total = sessions.length;

    const verdictCounts = { Take: 0, Skip: 0, Watch: 0 };
    const patternCounts = {};
    const aiVerdictCounts = { TAKE: 0, SKIP: 0, WATCH: 0 };

    for (const s of sessions) {
      if (s.decision) verdictCounts[s.decision] = (verdictCounts[s.decision] || 0) + 1;
      const pattern = s.userInput?.candlePattern || s.formData?.candlePattern;
      if (pattern && pattern !== 'No pattern identified') {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      }
      const aiVerdict = s.aiDecision?.verdict || s.aiVerdict;
      if (aiVerdict) aiVerdictCounts[aiVerdict] = (aiVerdictCounts[aiVerdict] || 0) + 1;
    }

    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({ total, verdictCounts, aiVerdictCounts, topPatterns });
  } catch (err) {
    res.status(500).json({ error: 'Could not build insights context', detail: err.message });
  }
});

// GET /journal/missed-setups — patterns TA-Lib found, backed by prior trend +
// volume + S&R context (the same checklist Analyse applies), that the user
// didn't analyse, and that would have hit target before stop loss.
// strict=false      → skip the trend/volume/S&R context filter entirely
// onlyWinners=false → keep the context filter but also show setups that
//                     would have been stopped out (or haven't resolved yet)
router.get('/missed-setups', authMiddleware, async (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const strict = req.query.strict !== 'false';
  const onlyWinners = req.query.onlyWinners !== 'false';
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ohlc_records')
    .select('symbol, date, close, volume, vol_10day_avg, talib_patterns')
    .gte('date', fromStr)
    .neq('talib_patterns', '[]')
    .order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: sessions } = await supabase
    .from('journal_sessions')
    .select('ticker, date')
    .eq('user_id', req.user.userId)
    .gte('date', fromStr);

  const analysed = new Set((sessions || []).map(s => `${s.ticker}|${s.date}`));
  const candidates = (data || []).filter(r => !analysed.has(`${r.symbol}|${r.date}`));

  if (!strict) {
    return res.json(candidates.map(r => ({
      symbol: r.symbol, date: r.date, close: r.close, patterns: r.talib_patterns,
    })));
  }

  // Fetch enough prior history per symbol to classify trend and detect S&R levels
  const historyLimit = TREND_LOOKBACK + SR_LOOKBACK;
  const historyBySymbol = {};
  for (const symbol of new Set(candidates.map(c => c.symbol))) {
    const latestDate = candidates
      .filter(c => c.symbol === symbol)
      .reduce((max, c) => (c.date > max ? c.date : max), '0000-00-00');

    const { data: hist } = await supabase
      .from('ohlc_records')
      .select('date, high, low, close')
      .eq('symbol', symbol)
      .lte('date', latestDate)
      .order('date', { ascending: false })
      .limit(historyLimit);

    historyBySymbol[symbol] = (hist || []).reverse(); // ascending
  }

  // Step 1 (context) + Step 2 (would it have hit target before SL) per pattern.
  const missed = [];
  for (const r of candidates) {
    const history = historyBySymbol[r.symbol] || [];
    const patternCandle = { close: r.close, volume: r.volume, vol_10day_avg: r.vol_10day_avg };

    const evaluatedPatterns = [];
    for (const p of r.talib_patterns) {
      const context = evaluateSetup({
        patternCandle,
        priorCandles: history.filter(c => c.date < p.startDate),
        bias: p.bias,
      });
      if (!context.qualifies) continue;

      const direction = directionForBias(p.bias);
      const levels = direction
        ? computeTradeLevels({ entry: r.close, support: context.support, resistance: context.resistance, direction })
        : null;
      const { outcome, hitAt } = levels
        ? await evaluateOutcome({ symbol: r.symbol, completionDate: p.completionDate, levels })
        : { outcome: 'no_data', hitAt: null };

      if (onlyWinners && outcome === 'sl_hit') continue;

      evaluatedPatterns.push({ ...p, ...context, direction, levels, outcome, hitAt });
    }

    if (evaluatedPatterns.length) {
      missed.push({ symbol: r.symbol, date: r.date, close: r.close, patterns: evaluatedPatterns });
    }
  }

  res.json(missed);
});

// GET /journal/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Session not found' });

    const session = fromDb(data);

    // Non-superusers can only access their own sessions
    if (req.user.role !== 'superuser' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Could not read session', detail: err.message });
  }
});

// POST /journal
router.post('/', authMiddleware, async (req, res) => {
  const {
    module: moduleId, ticker, timeframe, date, lookbackWindow,
    imagePath, promptVersion, userInput, aiAnnotation, aiAnalysis,
    learningTags, aiVerdict, entryPrice,
    formData, chartSource,
    decision, confidence,
    plannedEntry, plannedSL, plannedTarget, plannedRRR,
    aiWhatISee, aiNarrative, aiDecision, aiCorrections,
  } = req.body;

  const record = toDb({
    module: moduleId || 'unified',
    ticker: ticker || formData?.ticker || '',
    timeframe: timeframe || '',
    chartSource: chartSource || formData?.chartSource || '',
    date: date || formData?.date || new Date().toISOString().split('T')[0],
    lookbackWindow: lookbackWindow || formData?.lookbackWindow || 3,
    imagePath: imagePath || '',
    promptVersion: promptVersion || '',
    formData: formData || null,
    userInput: userInput || null,
    aiWhatISee: aiWhatISee || null,
    aiNarrative: aiNarrative || null,
    aiDecision: aiDecision || null,
    aiCorrections: aiCorrections || [],
    aiAnnotation: aiAnnotation || null,
    aiAnalysis: aiAnalysis || null,
    decision: decision || null,
    confidence: confidence || null,
    plannedEntry: plannedEntry ?? null,
    plannedSL: plannedSL ?? null,
    plannedTarget: plannedTarget ?? null,
    plannedRRR: plannedRRR ?? null,
    actualEntry: null,
    actualExit: null,
    holdingPeriod: null,
    exitPrice: entryPrice || null,
    pnl: null,
    outcome: null,
    notes: '',
    learningTags: learningTags || [],
    aiVerdict: aiVerdict || null,
    chatHistory: [],
    userId: req.user.userId,
  });

  try {
    const insertRecord = { ...record };
    delete insertRecord.outcome_data; // column added via migration; omit until it exists

    const { data, error } = await supabase
      .from('journal_sessions')
      .insert(insertRecord)
      .select('*')
      .single();

    if (error) throw error;

    // Attach talib patterns from ohlc_records for the same ticker + date
    const sessionTicker = record.ticker?.toUpperCase();
    const sessionDate   = record.date;
    if (sessionTicker && sessionDate) {
      const { data: ohlc } = await supabase
        .from('ohlc_records')
        .select('talib_patterns')
        .eq('symbol', sessionTicker)
        .eq('date', sessionDate)
        .maybeSingle();

      if (ohlc?.talib_patterns?.length) {
        await supabase
          .from('journal_sessions')
          .update({ talib_patterns: ohlc.talib_patterns })
          .eq('id', data.id);
        data.talib_patterns = ohlc.talib_patterns;
      }
    }

    res.status(201).json(fromDb(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not save session', detail: err.message });
  }
});

// PATCH /journal/:id
router.patch('/:id', authMiddleware, async (req, res) => {
  const { outcome, exitPrice, notes, actualEntry, actualExit, holdingPeriod, outcomeData,
          tradeEntryDate, tradeExitDate, quantity } = req.body;

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    const session = fromDb(existing);
    if (req.user.role !== 'superuser' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const patch = { updated_at: new Date().toISOString() };
    if (notes            !== undefined) patch.notes = notes;
    if (actualEntry      !== undefined) patch.actual_entry = actualEntry;
    if (holdingPeriod    !== undefined) patch.holding_period = holdingPeriod;
    if (outcomeData      !== undefined) patch.outcome_data = outcomeData;
    if (tradeEntryDate   !== undefined) patch.trade_entry_date = tradeEntryDate;
    if (tradeExitDate    !== undefined) patch.trade_exit_date  = tradeExitDate;
    if (quantity         !== undefined) patch.quantity = quantity;

    // Derive outcome label from outcomeData when present
    if (outcomeData !== undefined) {
      const isTake = session.decision === 'Take';
      if (isTake) {
        const resultMap = {
          hit_target:   'Win',
          manual_exit:  'Win',
          stopped_out:  'Loss',
          open:         'Open',
        };
        patch.outcome = resultMap[outcomeData.result] ?? outcome ?? session.outcome;
      } else {
        // Skip / Watch
        const dirMap = {
          yes:       session.decision ?? 'Skip', // right to skip/watch
          no:        'Missed',
          too_early: 'Open',
        };
        patch.outcome = dirMap[outcomeData.decisionCorrect] ?? session.outcome;
      }
    } else if (outcome !== undefined) {
      patch.outcome = outcome;
    }

    if (actualExit !== undefined) {
      patch.actual_exit = actualExit;
      patch.exit_price  = actualExit;
      const entry = actualEntry ?? session.actualEntry ?? session.plannedEntry;
      const qty   = quantity   ?? session.quantity ?? 1;
      if (entry != null) patch.pnl = parseFloat(((actualExit - entry) * qty).toFixed(2));
    } else if (exitPrice !== undefined) {
      patch.exit_price = exitPrice;
      const entry = session.actualEntry ?? session.plannedEntry;
      const qty   = quantity ?? session.quantity ?? 1;
      if (entry != null) patch.pnl = parseFloat(((exitPrice - entry) * qty).toFixed(2));
    } else if (quantity !== undefined) {
      // quantity updated without a new exit price — recompute P&L if we have entry+exit
      const exit  = session.actualExit ?? session.exitPrice;
      const entry = session.actualEntry ?? session.plannedEntry;
      if (exit != null && entry != null) {
        patch.pnl = parseFloat(((exit - entry) * quantity).toFixed(2));
      }
    }

    const { data, error } = await supabase
      .from('journal_sessions')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(fromDb(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not update session', detail: err.message });
  }
});

// DELETE /journal/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('journal_sessions')
      .select('id, user_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    if (req.user.role !== 'superuser' && existing.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { error } = await supabase
      .from('journal_sessions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete session', detail: err.message });
  }
});

// DELETE /journal  (bulk — ids in request body)
router.delete('/', authMiddleware, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  try {
    let query = supabase.from('journal_sessions').delete().in('id', ids);
    if (req.user.role !== 'superuser') query = query.eq('user_id', req.user.userId);
    const { error } = await query;
    if (error) throw error;
    res.json({ deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete sessions', detail: err.message });
  }
});

// POST /journal/insights-chat
router.post('/insights-chat', authMiddleware, async (req, res) => {
  const { message, context, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const { total = 0, verdictCounts = {}, aiVerdictCounts = {}, topPatterns = [] } = context || {};

  const systemPrompt = `You are a technical analysis coach reviewing a student's complete trading journal.

JOURNAL SUMMARY:
Total sessions: ${total}
User decisions: ${JSON.stringify(verdictCounts)}
AI verdicts: ${JSON.stringify(aiVerdictCounts)}
Top patterns identified: ${topPatterns.map(p => `${p.name} (${p.count}x)`).join(', ') || 'none yet'}

Answer questions about the student's learning patterns, common errors, and areas of strength.
Be specific and actionable. Do not give buy/sell recommendations.
If there are fewer than 5 sessions, note that the sample is too small for reliable patterns.`;

  const apiMessages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    res.status(502).json({ error: 'Chat failed', detail: err.message });
  }
});

// POST /journal/:id/images — upload entry/exit candle screenshots
router.post('/:id/images', authMiddleware, upload.fields([
  { name: 'entryChart', maxCount: 1 },
  { name: 'exitChart',  maxCount: 1 },
]), async (req, res) => {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('journal_sessions')
      .select('id, user_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'superuser' && existing.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const patch = { updated_at: new Date().toISOString() };

    if (req.files?.entryChart?.[0]) {
      const f = req.files.entryChart[0];
      patch.outcome_chart_entry = await uploadToSupabase(f.buffer, f.mimetype, req.user.userId);
    }
    if (req.files?.exitChart?.[0]) {
      const f = req.files.exitChart[0];
      patch.outcome_chart_exit = await uploadToSupabase(f.buffer, f.mimetype, req.user.userId);
    }

    if (Object.keys(patch).length === 1) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const { data, error } = await supabase
      .from('journal_sessions')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(fromDb(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not upload images', detail: err.message });
  }
});

// POST /journal/:id/chat
router.post('/:id/chat', authMiddleware, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  let session;
  try {
    const { data, error } = await supabase
      .from('journal_sessions')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Session not found' });

    session = fromDb(data);

    if (req.user.role !== 'superuser' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Could not load session', detail: err.message });
  }

  const history = (session.chatHistory ?? []).map(m => ({ role: m.role, content: m.content }));

  // Load chart images from Supabase Storage (original + outcome candle screenshots)
  const imageContent = [];
  async function fetchImage(url) {
    if (!url || !url.startsWith('http')) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return;
      const buffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'image/png';
      const data = Buffer.from(buffer).toString('base64');
      imageContent.push({ type: 'image', source: { type: 'base64', media_type: contentType, data } });
    } catch { /* skip if image unavailable */ }
  }
  await fetchImage(session.imagePath);
  await fetchImage(session.outcomeChartEntry);
  await fetchImage(session.outcomeChartExit);

  const aiContext = session.aiWhatISee
    ? [
        `WHAT I SEE:\n${JSON.stringify(session.aiWhatISee, null, 2)}`,
        `NARRATIVE I READ:\n${JSON.stringify(session.aiNarrative, null, 2)}`,
        `MY DECISION:\n${JSON.stringify(session.aiDecision, null, 2)}`,
        session.aiCorrections?.length
          ? `WHERE YOU WENT WRONG:\n${JSON.stringify(session.aiCorrections, null, 2)}`
          : 'WHERE YOU WENT WRONG: none — your read was correct.',
      ].join('\n\n')
    : `AI analysis:\n${JSON.stringify(session.aiAnalysis, null, 2)}`;

  const userContext = session.formData
    ? JSON.stringify(session.formData, null, 2)
    : JSON.stringify(session.userInput, null, 2);

  const hasOutcomeCharts = session.outcomeChartEntry || session.outcomeChartExit;
  const systemPrompt = `You are a technical analysis educator reviewing a chart with a student.

You already analysed this chart and gave the student the verdict below. The student is now asking follow-up questions about YOUR analysis.
When answering, refer back to what you said — your own trend read, your candle pattern call, your decision, your levels. Own your analysis.
Be specific — reference visible price levels, candle shapes, indicator readings, and anything else you can see in the chart image.
Explain your reasoning clearly so the student understands the "why", not just the "what".
Do not give buy or sell recommendations. Keep answers focused and educational.${hasOutcomeCharts ? '\n\nThe student has uploaded additional candle screenshots showing the chart at entry and/or what happened after the trade. Use these to give detailed feedback on whether the setup played out as expected, what the market actually did, and what the student can learn from the difference between the setup and the outcome.' : ''}

SESSION CONTEXT:
Ticker: ${session.ticker}
Date: ${session.date}

USER'S READ:
${userContext}

YOUR PRIOR ANALYSIS:
${aiContext}`;

  const isFirstMessage = history.length === 0;
  const newUserContent = isFirstMessage
    ? [...imageContent, { type: 'text', text: message }]
    : message;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: newUserContent }],
    });

    const reply = response.content[0].text;
    const now = new Date().toISOString();
    const userTurn      = { role: 'user',      content: message, timestamp: now };
    const assistantTurn = { role: 'assistant',  content: reply,   timestamp: now };

    const newHistory = [...(session.chatHistory ?? []), userTurn, assistantTurn];

    const { error: updateErr } = await supabase
      .from('journal_sessions')
      .update({ chat_history: newHistory, updated_at: now })
      .eq('id', req.params.id);

    if (updateErr) console.error('Failed to save chat history:', updateErr.message);

    res.json({ reply, chatHistory: newHistory });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(502).json({ error: 'Chat failed', detail: err.message });
  }
});

module.exports = router;
