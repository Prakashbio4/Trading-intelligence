const express = require('express');
const multer = require('multer');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const SYSTEM = `You are a technical analysis educator who applies established chart reading principles with practical, real-market judgment.

RULES:
1. Express confidence as HIGH / MEDIUM / LOW on every individual call.
2. Never give a buy or sell recommendation. Provide analysis and education only.
3. Respond with ONLY the JSON structure requested — no prose outside the schema. No markdown. No preamble.
4. Identify trend using Dow Theory: higher highs/higher lows = uptrend, lower highs/lower lows = downtrend, neither = ranging.
5. Always comment on whether volume supports or contradicts the pattern.
6. S&R levels must be grounded in prior swing pivots visible on the chart.
7. Flag any setup where risk-reward falls below 1:1.5.
8. Apply methodology silently — never say "per Varsity" or cite chapter numbers. State rules as fact.
9. "No pattern identified" is always a valid and complete answer. Never force a weak pattern.
10. The "whereYouWentWrong" array only fires on genuine disagreements. If the user's read is correct, return an empty array. No filler.
11. Corrections are ranked by trading significance: wrong stop loss > wrong pattern > wrong RSI read.
12. When deciding TAKE or WATCH, propose specific price levels with structural reasoning. Do not give round numbers without justification.
13. Apply a 5% real-market tolerance to all quantitative thresholds (except the hard 4% S&R-vs-SL rule in Step 4 and the 1.2 RRR hard floor in Step 7). Values within 5% of a threshold are borderline — flag explicitly rather than treating as a hard failure.
14. For WATCH verdicts, still propose entry / stopLoss / target / rrr if calculable — these represent the conditions under which the setup would qualify.

CHART LAYOUT — STANDARD DUAL-PANEL SCREENSHOT:
The uploaded chart image uses a standard dual-panel format. Apply each panel with its specific purpose:

  LEFT PANEL — Last 7–10 daily candles with volume:
    - Assess the trigger candle pattern (Step 1): body/shadow ratios, colour, size against the tolerances below
    - Read volume on the trigger candle vs the displayed SMA line (Step 3)
    - Read the candle sequence in detail (roles, quality of each candle)
    - Use for precise S&R level reading near the current price

  RIGHT PANEL — ~1-year daily chart with trend indicators (Bollinger Bands, RSI, MACD):
    - Establish the primary and secondary trend direction and duration (Steps 2, 6)
    - Identify Dow patterns at the broader scale — double tops/bottoms, flags, base formations (Step 5)
    - Read Bollinger Band position (is price at upper/lower band? band width expanding or contracting?)
    - Read RSI and MACD confirmation (Step 8) — always use the right-side pinned values
    - Identify S&R levels from prior swing highs/lows visible on the longer timeframe

INDICATOR VALUES — RIGHT-SIDE PANEL RULE:
TradingView displays values in TWO places:
  (a) TOP-LEFT LEGEND: Values at the cursor position when the screenshot was taken — NOT the current bar.
  (b) RIGHT-SIDE PANEL (values pinned against the right axis): Most recent bar's values — always current and accurate.

ALWAYS read indicator values (RSI, MACD, Bollinger Bands, Volume SMA, EMAs) from the RIGHT-SIDE PANEL only. Ignore top-left legend values when they differ. If the right panel is obscured, state LOW confidence rather than falling back to the legend.

CANDLESTICK READING — REAL MARKET APPROACH:
Textbook-perfect patterns are rare. Assess quality on a spectrum: Textbook clean / Acceptable / Borderline / Weak.
Practical tolerances:
- Marubozu: shadows up to 10–15% of body = Acceptable.
- Hammer / Hanging Man: lower shadow 2x body = ideal, 1.5x = Borderline. Upper shadow up to 30% of body is tolerable.
- Shooting Star / Inverted Hammer: upper shadow 2x body = ideal, same 1.5x Borderline rule.
- Engulfing: Day 2 body fully contains Day 1 = ideal. 90%+ coverage = Borderline Engulfing.
- Doji: body up to 5% of high-low range = Clean, up to 10% = Acceptable.
- Morning Star / Evening Star: Day 3 closes 50%+ into Day 1 body = ideal, 40–50% = Borderline.
- Harami: Day 2 body within Day 1. Within 110% = Borderline.
Always state what the ideal would be and how much the actual pattern deviates.

EVALUATION CHECKLIST — 8-STEP SEQUENTIAL FRAMEWORK:
Evaluate every setup through all 8 steps. Populate myDecision.checklistResults with one entry per step. Hard knockouts must be flagged even when the overall verdict is not SKIP.

Step 1 — PATTERN STRENGTH: Identifiable pattern? Rate quality using the candlestick tolerances above. Note deviations from ideal. Not a standalone knockout.
Step 2 — PRIOR TREND: Bullish pattern requires prior downtrend; bearish requires prior uptrend. Clearly wrong prior trend weighs heavily toward SKIP.
Step 3 — VOLUME: Must be ≥ 10-day average (use right-side panel value vs displayed SMA). Within 5% = borderline confirmed. Clearly below = fail.
Step 4 — S&R vs STOPLOSS ALIGNMENT: Compute |S&R − stoploss| / stoploss × 100. Above 4% → passed: false, knockout: true. Prefer user-provided levels; use chart estimates when not provided but flag uncertainty.
Step 5 — DOW PATTERNS: Identify double/triple tops/bottoms, flags, range breakouts. Supporting or contradicting the trigger?
Step 6 — PRIMARY & SECONDARY TREND: Both established and aligned with the trade direction?
Step 7 — RRR: (Target − Entry) / (Entry − SL). Below 1.2 → passed: false, knockout: true. Between 1.2–1.5 → borderline. Prefer user-provided levels; estimate from chart when not provided.
Step 8 — MACD & RSI CONFIRMATION (confirmatory only — never drives verdict alone): If steps 1–7 all pass cleanly AND both indicators confirm direction → conviction = "STRONG". Otherwise → conviction = "STANDARD".

VERDICT RULES:
TAKE: Steps 1–7 pass (borderline flags allowed). RRR ≥ 1.5.
WATCH: 1–2 steps are borderline/marginal, or a Dow pattern is forming but unconfirmed, or RRR is 1.2–1.5. Populate watchReason and provide estimated levels.
SKIP: Any hard knockout (Step 4 or 7 with knockout: true and passed: false), prior trend clearly wrong, or three or more soft fails stacked.`;


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

function imagePayloadFromBuffer(buffer, mimetype) {
  return { type: 'image', source: { type: 'base64', media_type: mimetype, data: buffer.toString('base64') } };
}

function stripFences(text) {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
}

function parseOrError(raw, label) {
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    console.error(`${label} JSON parse error. Raw:\n`, raw);
    return { ok: false, message: err.message };
  }
}

// ── UNIFIED ANALYSE ───────────────────────────────────────────────────────────
router.post('/', authMiddleware, upload.single('chart'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chart image is required' });

  let formData;
  try {
    formData = JSON.parse(req.body.formData);
  } catch {
    return res.status(400).json({ error: 'formData must be valid JSON' });
  }

  const {
    ticker, date, chartSource,
    primaryTrend, trendDuration, stockPhase, chartStructure, opposingStructure,
    patternName, patternCandles, contextCandles, priorTrendMatch,
    volumeVsAverage, volumeCharacter, macd, rsiValue, rsiDirection, bollingerBands,
    nearestSupport, nearestResistance, srConfidence,
    narrative,
  } = formData;

  const pCandles = Array.isArray(patternCandles) ? patternCandles : [];
  const cCandles = Array.isArray(contextCandles) ? contextCandles : [];
  const candleCount = pCandles.length || 1;

  const patternText = pCandles.length
    ? pCandles.map(c => {
        const parts = [c.candleType, c.direction !== 'N/A' ? c.direction : null, c.quality].filter(Boolean);
        return `  ${c.role} (Day ${c.day}): ${parts.join(' — ')}`;
      }).join('\n')
    : '  Not provided';

  const contextText = cCandles.length
    ? cCandles.map(c => {
        const parts = [c.candleType, c.direction !== 'N/A' ? c.direction : null, c.quality].filter(Boolean);
        return `  Day ${c.day}: ${parts.join(' — ')}`;
      }).join('\n')
    : '  None provided';

  const prompt = `Analyse the chart image. The user submitted their factual observations BEFORE seeing any AI analysis. Derive your verdict, levels, and checklist evaluation independently — you have NOT been told the user's decision, and it must not influence your output.

USER'S READ:
Ticker: ${ticker}  |  Date: ${date}  |  Source: ${chartSource}

TREND:
Primary trend: ${primaryTrend}
Duration: ${trendDuration}
Stock phase: ${stockPhase || 'Not specified'}
Chart structure: ${chartStructure}
Opposing structure: ${opposingStructure || 'None'}

TRIGGER PATTERN: ${patternName || 'Not specified'} (${candleCount === 1 ? 'single candle' : `${candleCount}-candle pattern`})
Pattern candles (oldest → newest):
${patternText}

CONTEXT CANDLES (days before the pattern, optional):
${contextText}

Prior trend match (sequence overall): ${priorTrendMatch || 'N/A'}

VOLUME & INDICATORS:
Volume vs average: ${volumeVsAverage}
Volume character: ${volumeCharacter || 'Not specified'}
MACD: ${macd}
RSI value: ${rsiValue || 'Not entered'}
RSI direction: ${rsiDirection}
Bollinger bands: ${bollingerBands || 'Not specified'}

S&R LEVELS:
Support: ${nearestSupport || 'Not entered'}
Resistance: ${nearestResistance || 'Not entered'}
S&R confidence: ${srConfidence || 'Not specified'}

NARRATIVE:
${narrative || 'Not provided'}

Respond with ONLY valid JSON matching this exact schema:
{
  "whatISee": {
    "trend": { "direction": "", "basis": "", "duration": "", "confidence": "HIGH|MEDIUM|LOW" },
    "chartStructure": { "pattern": "", "confirmed": false, "confidence": "HIGH|MEDIUM|LOW" },
    "candlePattern": { "name": "", "direction": "", "quality": "", "priorTrendMatch": false, "reasoning": "", "confidence": "HIGH|MEDIUM|LOW" },
    "candleSequence": { "sequenceType": "Exhaustion|Reversal building|Continuation|Indecision cluster|No clear sequence", "sequenceReadable": "", "interpretation": "", "contradictsTrigger": false, "contradictionNote": "", "confidence": "HIGH|MEDIUM|LOW" },
    "volume": { "vsAverage": "", "character": "", "supportsTrade": false, "note": "", "confidence": "HIGH|MEDIUM|LOW" },
    "macd": { "status": "", "confidence": "HIGH|MEDIUM|LOW" },
    "rsi": { "value": null, "direction": "", "confidence": "HIGH|MEDIUM|LOW" },
    "bollingerBands": { "status": "", "confidence": "HIGH|MEDIUM|LOW" },
    "keyLevels": { "support": [], "resistance": [] }
  },
  "narrativeIRead": {
    "aiNarrative": "",
    "agreementWithUser": "",
    "divergences": ""
  },
  "myDecision": {
    "verdict": "TAKE|SKIP|WATCH",
    "conviction": "STRONG|STANDARD",
    "watchReason": "",
    "checklistResults": [
      { "step": 1, "label": "Pattern Strength", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 2, "label": "Prior Trend", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 3, "label": "Volume", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 4, "label": "S&R vs SL Alignment", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 5, "label": "Dow Patterns", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 6, "label": "Primary & Secondary Trend", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 7, "label": "RRR", "passed": true, "borderline": false, "knockout": false, "note": "" },
      { "step": 8, "label": "MACD & RSI Confirmation", "passed": true, "borderline": false, "knockout": false, "note": "" }
    ],
    "reasoning": "",
    "entry": null,
    "stopLoss": null,
    "target": null,
    "rrr": null,
    "entryReasoning": "",
    "slReasoning": "",
    "targetReasoning": ""
  },
  "whereYouWentWrong": [
    { "rank": 1, "field": "", "correction": "" }
  ]
}

IMPORTANT:
- whereYouWentWrong must be an empty array [] if there are no genuine errors in the user's factual read (trend, pattern, volume, indicators, S&R). Do NOT flag the user's unstated decision.
- myDecision.entry / stopLoss / target / rrr are null only if verdict is SKIP. For WATCH, populate these if calculable (qualifying conditions). For TAKE they are always required.
- conviction is always "STRONG" or "STANDARD" — never omit it. STRONG requires steps 1–7 all clean AND both MACD and RSI confirming; STANDARD otherwise.
- watchReason is an empty string unless verdict is WATCH — then it must explain specifically which step(s) are borderline or unconfirmed.
- checklistResults must contain exactly 8 entries in order (steps 1–8). Set passed: false AND knockout: true only for hard knockouts (Step 4 >4% S&R-vs-SL gap, Step 7 RRR <1.2). Set borderline: true (with passed still true) for values within 5% of thresholds.
- candlePattern assesses the trigger pattern as a whole unit. For multi-candle patterns (Engulfing, Morning Star etc.) evaluate whether the pattern meets quality thresholds: did the engulfing candle fully cover? Did the Morning Star confirmation close deep enough? Apply the tolerances from your CANDLESTICK READING rules.
- For multi-candle patterns, candlePattern.name should be the pattern name (not the individual candle type of Day 0).
- candleSequence.interpretation must explain the arc across pattern candles AND context candles combined.
- If candleSequence.contradictsTrigger is true, rank the correction high in whereYouWentWrong and explain specifically what the sequence context changes about the trigger pattern's signal.
- If fewer than 2 total candles are provided across pattern + context, set candleSequence.sequenceType to "No clear sequence" and confidence to "LOW".`;

  try {
    let imagePath;
    try {
      imagePath = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.user.userId);
    } catch (uploadErr) {
      console.error('Supabase upload failed:', uploadErr.message);
      imagePath = '';
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imagePayloadFromBuffer(req.file.buffer, req.file.mimetype),
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = stripFences(message.content[0].text);
    const { ok, data, message: parseMsg } = parseOrError(raw, 'Analyse');
    if (!ok) return res.status(502).json({ error: 'AI returned malformed JSON', detail: parseMsg, raw: raw.slice(0, 500) });

    res.json({
      analysis: data,
      imagePath,
      promptVersion: 'unified_v1',
    });
  } catch (err) {
    console.error('Analyse error:', err.message);
    res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
});

// ── MODULE 1 (legacy) ────────────────────────────────────────────────────────
router.post('/module1', authMiddleware, upload.single('chart'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chart image is required' });

  let userRead;
  try {
    userRead = JSON.parse(req.body.userRead);
  } catch {
    return res.status(400).json({ error: 'userRead must be valid JSON' });
  }

  const prompt = `Analyse the chart image using established technical analysis principles.

The user submitted their read BEFORE seeing any AI analysis. Form your own independent view first, then compare field by field.

USER'S READ:
${JSON.stringify(userRead, null, 2)}

Respond with ONLY valid JSON matching this schema:
{
  "aiAnnotation": {
    "trend": {
      "direction": "",
      "basis": "",
      "duration": "",
      "confidence": "HIGH|MEDIUM|LOW"
    },
    "chartStructure": {
      "pattern": "",
      "confirmed": false,
      "confidence": "HIGH|MEDIUM|LOW"
    },
    "candlePattern": {
      "name": "",
      "direction": "",
      "quality": "",
      "priorTrendMatch": false,
      "reasoning": "",
      "confidence": "HIGH|MEDIUM|LOW"
    },
    "volume": {
      "vsAverage": "",
      "supportsTrade": false,
      "note": "",
      "confidence": "HIGH|MEDIUM|LOW"
    },
    "indicators": {
      "macd": { "status": "", "confidence": "HIGH|MEDIUM|LOW" },
      "rsi": { "value": null, "direction": "", "confidence": "HIGH|MEDIUM|LOW" },
      "bollingerBands": { "status": "", "confidence": "HIGH|MEDIUM|LOW" }
    },
    "keyLevels": {
      "support": [1000, 1050],
      "resistance": [1100, 1150]
    }
  },
  "comparison": {
    "trend":          { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "chartStructure": { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "candlePattern":  { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "volume":         { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "indicators":     { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "srLevels":       { "match": false, "userRead": "", "aiRead": "", "note": "" },
    "overallAgreement": "HIGH|MEDIUM|LOW",
    "primaryLearningPoint": "",
    "learningTags": []
  },
  "setupAssessment": {
    "checklistPassed": false,
    "checklistScore": "0/5",
    "checks": [
      { "label": "Prior trend present",       "passed": false, "note": "" },
      { "label": "Pattern confirmed",          "passed": false, "note": "" },
      { "label": "Volume supports move",       "passed": false, "note": "" },
      { "label": "No opposing structure",      "passed": false, "note": "" },
      { "label": "Indicators aligned",         "passed": false, "note": "" }
    ],
    "proposedLevels": {
      "entry": null,
      "stopLoss": null,
      "target": null,
      "rrr": null,
      "reasoning": ""
    },
    "verdict": "TRADE|PASS|WATCH",
    "verdictReason": ""
  }
}`;

  try {
    let imagePath;
    try {
      imagePath = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.user.userId);
    } catch (uploadErr) {
      console.error('Supabase upload failed:', uploadErr.message);
      imagePath = '';
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imagePayloadFromBuffer(req.file.buffer, req.file.mimetype),
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = stripFences(message.content[0].text);
    const { ok, data, message: parseMsg } = parseOrError(raw, 'Module 1');
    if (!ok) return res.status(502).json({ error: 'AI returned malformed JSON', detail: parseMsg });

    res.json({ analysis: data, imagePath, promptVersion: 'm1_v3' });
  } catch (err) {
    console.error('Module 1 error:', err.message);
    res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
});

// ── MODULE 3 (legacy) ────────────────────────────────────────────────────────
router.post('/module3', authMiddleware, upload.single('chart'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chart image is required' });

  let userAnalysis;
  try {
    userAnalysis = JSON.parse(req.body.userAnalysis);
  } catch {
    return res.status(400).json({ error: 'userAnalysis must be valid JSON' });
  }

  const prompt = `Validate the following trading setup against a standard technical analysis checklist.
Examine the chart independently, then score each checklist item against what you observe.

USER SETUP:
${JSON.stringify(userAnalysis, null, 2)}

Respond with ONLY valid JSON matching this schema:
{
  "verdict": "TRADE|PASS|CONDITIONAL|NO_TRADE",
  "confidence": "HIGH|MEDIUM|LOW",
  "chartObservations": {
    "trend":         { "direction": "", "basis": "", "confidence": "HIGH|MEDIUM|LOW" },
    "candlePattern": { "name": "", "confirmed": false, "reasoning": "", "confidence": "HIGH|MEDIUM|LOW" },
    "volume":        { "assessment": "", "supportsTrade": false, "confidence": "HIGH|MEDIUM|LOW" },
    "keyLevels":     { "support": [1000, 1050], "resistance": [1100, 1150] }
  },
  "checklistResults": [
    {
      "item": "",
      "passed": false,
      "comment": "",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "levelValidation": {
    "entry":    { "valid": false, "comment": "" },
    "stopLoss": { "valid": false, "comment": "", "suggestedLevel": null },
    "target":   { "valid": false, "comment": "" },
    "rrr":      { "calculated": null, "meetsMinimum": false, "minimum": "1:1.5" }
  },
  "deviations": [],
  "learningTags": []
}`;

  try {
    let imagePath;
    try {
      imagePath = await uploadToSupabase(req.file.buffer, req.file.mimetype, req.user.userId);
    } catch (uploadErr) {
      console.error('Supabase upload failed:', uploadErr.message);
      imagePath = '';
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imagePayloadFromBuffer(req.file.buffer, req.file.mimetype),
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = stripFences(message.content[0].text);
    const { ok, data, message: parseMsg } = parseOrError(raw, 'Module 3');
    if (!ok) return res.status(502).json({ error: 'AI returned malformed JSON', detail: parseMsg });

    res.json({ analysis: data, imagePath, promptVersion: 'm3_v3' });
  } catch (err) {
    console.error('Module 3 error:', err.message);
    res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
});

module.exports = router;
