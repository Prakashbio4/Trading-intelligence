const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const JOURNAL_PATH = path.join(__dirname, '../data/journal.json');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function readJournal() {
  return JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
}

function writeJournal(data) {
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// GET /journal
router.get('/', (req, res) => {
  try {
    let sessions = readJournal();
    const { module: mod, verdict, outcome, pattern } = req.query;
    if (mod)     sessions = sessions.filter(s => s.module === mod);
    if (verdict) sessions = sessions.filter(s => s.aiVerdict === verdict);
    if (outcome) sessions = sessions.filter(s => s.outcome === outcome);
    if (pattern) sessions = sessions.filter(s =>
      s.userInput?.candlePattern?.toLowerCase().includes(pattern.toLowerCase())
    );
    res.json(sessions.slice().reverse());
  } catch (err) {
    res.status(500).json({ error: 'Could not read journal', detail: err.message });
  }
});

// GET /journal/:id
router.get('/:id', (req, res) => {
  try {
    const sessions = readJournal();
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Could not read journal', detail: err.message });
  }
});

// POST /journal
router.post('/', (req, res) => {
  const {
    // legacy fields (kept for backwards compat with existing module1/3 saves)
    module: moduleId, ticker, timeframe, date, lookbackWindow,
    imagePath, promptVersion, userInput, aiAnnotation, aiAnalysis,
    learningTags, aiVerdict, entryPrice,
    // new unified fields
    formData, chartSource,
    decision, confidence,
    plannedEntry, plannedSL, plannedTarget, plannedRRR,
    aiWhatISee, aiNarrative, aiDecision, aiCorrections,
  } = req.body;

  const session = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: null,
    module: moduleId || 'unified',
    ticker: ticker || formData?.ticker || '',
    timeframe: timeframe || '',
    chartSource: chartSource || formData?.chartSource || '',
    date: date || formData?.date || new Date().toISOString().split('T')[0],
    lookbackWindow: lookbackWindow || formData?.lookbackWindow || 3,
    imagePath: imagePath || '',
    promptVersion: promptVersion || '',
    // user read — unified sessions store formData, legacy store userInput
    formData: formData || null,
    userInput: userInput || null,
    // ai response — unified sessions use the four-section structure
    aiWhatISee: aiWhatISee || null,
    aiNarrative: aiNarrative || null,
    aiDecision: aiDecision || null,
    aiCorrections: aiCorrections || [],
    // legacy ai response fields
    aiAnnotation: aiAnnotation || null,
    aiAnalysis: aiAnalysis || null,
    // decision
    decision: decision || null,
    confidence: confidence || null,
    plannedEntry: plannedEntry ?? null,
    plannedSL: plannedSL ?? null,
    plannedTarget: plannedTarget ?? null,
    plannedRRR: plannedRRR ?? null,
    // outcome (filled later via PATCH)
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
  };

  try {
    const sessions = readJournal();
    sessions.push(session);
    writeJournal(sessions);
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Could not save session', detail: err.message });
  }
});

// PATCH /journal/:id
router.patch('/:id', (req, res) => {
  const { outcome, exitPrice, notes, actualEntry, actualExit, holdingPeriod } = req.body;

  try {
    const sessions = readJournal();
    const idx = sessions.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Session not found' });

    if (outcome        !== undefined) sessions[idx].outcome = outcome;
    if (notes          !== undefined) sessions[idx].notes = notes;
    if (actualEntry    !== undefined) sessions[idx].actualEntry = actualEntry;
    if (holdingPeriod  !== undefined) sessions[idx].holdingPeriod = holdingPeriod;

    if (actualExit !== undefined) {
      sessions[idx].actualExit = actualExit;
      sessions[idx].exitPrice  = actualExit;
      const entry = sessions[idx].actualEntry ?? sessions[idx].plannedEntry;
      if (entry != null) {
        sessions[idx].pnl = parseFloat((actualExit - entry).toFixed(2));
      }
    } else if (exitPrice !== undefined) {
      sessions[idx].exitPrice = exitPrice;
      const entry = sessions[idx].actualEntry ?? sessions[idx].plannedEntry;
      if (entry != null) {
        sessions[idx].pnl = parseFloat((exitPrice - entry).toFixed(2));
      }
    }

    sessions[idx].updatedAt = new Date().toISOString();
    writeJournal(sessions);
    res.json(sessions[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update session', detail: err.message });
  }
});

// GET /journal/insights-context — aggregate summary for Insights page chat
router.get('/insights-context', (req, res) => {
  try {
    const sessions = readJournal();
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

// POST /journal/:id/chat — follow-up conversation about a specific session
router.post('/:id/chat', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  let sessions, idx, session;
  try {
    sessions = readJournal();
    idx = sessions.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Session not found' });
    session = sessions[idx];
  } catch (err) {
    return res.status(500).json({ error: 'Could not load session', detail: err.message });
  }

  // Build prior conversation turns for the API
  const history = (session.chatHistory ?? []).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Load the chart image if it exists
  const imageContent = [];
  if (session.imagePath) {
    const absPath = path.join(__dirname, '..', session.imagePath);
    if (fs.existsSync(absPath)) {
      const ext = path.extname(absPath).slice(1).toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      const data = fs.readFileSync(absPath).toString('base64');
      imageContent.push({ type: 'image', source: { type: 'base64', media_type: mime, data } });
    }
  }

  const systemPrompt = `You are a technical analysis educator reviewing a chart with a student.

The student previously analysed this chart and received an AI analysis. The full context of that session is below.
Answer the student's follow-up questions about this specific chart and analysis. Be specific — reference visible price levels, candle shapes, indicator readings, and anything else you can see in the chart image.
Explain your reasoning clearly so the student understands the "why", not just the "what".
Do not give buy or sell recommendations. Keep answers focused and educational.

SESSION CONTEXT:
Ticker: ${session.ticker}
Date: ${session.date}
Module: ${session.module === '1' ? 'Chart Eye Training' : session.module === '3' ? 'Trade Validator' : 'Narrative Builder'}

User's read:
${JSON.stringify(session.userInput, null, 2)}

AI analysis:
${JSON.stringify(session.aiAnalysis, null, 2)}`;

  // First message includes the chart image + context; subsequent turns are text only
  const isFirstMessage = history.length === 0;

  const newUserContent = isFirstMessage
    ? [...imageContent, { type: 'text', text: message }]
    : message;

  try {
    const apiMessages = [
      ...history,
      { role: 'user', content: newUserContent },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    const reply = response.content[0].text;

    // Save both turns to chatHistory
    const userTurn      = { role: 'user',      content: message, timestamp: new Date().toISOString() };
    const assistantTurn = { role: 'assistant',  content: reply,   timestamp: new Date().toISOString() };

    if (!sessions[idx].chatHistory) sessions[idx].chatHistory = [];
    sessions[idx].chatHistory.push(userTurn, assistantTurn);
    sessions[idx].updatedAt = new Date().toISOString();
    writeJournal(sessions);

    res.json({ reply, chatHistory: sessions[idx].chatHistory });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(502).json({ error: 'Chat failed', detail: err.message });
  }
});

module.exports = router;
