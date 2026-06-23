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

BODY STRENGTH:
- Long body (body ≥ 60% of candle range) = strong conviction → raises pattern confidence.
- Short body (body < 30% of candle range) = subdued conviction → flag as borderline at Step 1.

TRADE TRAP CHECK (apply before accepting any pattern):
- Candle range < 1% of price = stoploss too tight → likely a trap; flag LOW confidence and note the math.
- Candle range > 10% of price = stoploss too deep → risk becomes unmanageable; flag LOW confidence.

PATTERN-SPECIFIC RULES:
- Marubozu: prior trend is NOT required (the only pattern exempt from Step 2). SL = low of bullish Marubozu / high of bearish Marubozu.
- Spinning Top / Doji: reversal vs continuation probability is ~50/50. Never call TAKE on a standalone spinning top or doji — always WATCH at best; state this explicitly.
- Engulfing: only the real bodies (open-to-close) need to engulf; shadows are irrelevant to the pattern definition.
- Piercing Line / Dark Cloud Cover: 50–99% engulf of the prior body = weaker than full engulf → treat as Borderline at Step 1.
- Doji appearing the session after an Engulfing pattern = amplifies the signal → raise conviction one level (STANDARD → STRONG candidate, subject to all other steps).
- Harami: Day-2 body must be contained within Day-1 body; the direction of Day-2 is irrelevant.

STOPLOSS TABLE — always apply; never improvise:
  Hammer (bullish):           SL = low of hammer
  Hanging Man (bearish):      SL = high of hanging man
  Shooting Star (bearish):    SL = high of shooting star
  Inverted Hammer (bullish):  SL = low of inverted hammer
  Bullish Marubozu:           SL = low of marubozu
  Bearish Marubozu:           SL = high of marubozu
  Bullish Engulfing:          SL = lowest low of P1 and P2 combined
  Bearish Engulfing:          SL = highest high of P1 and P2 combined
  Bullish Harami:             SL = lowest low of P1 and P2 combined
  Bearish Harami:             SL = highest high of P1 and P2 combined
  Morning Star:               SL = lowest low across the three candles
  Evening Star:               SL = highest high across the three candles

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

Step 2 — PRIOR TREND: Bullish pattern requires prior downtrend; bearish requires prior uptrend. Exception: Marubozu does not require a prior trend. Clearly wrong prior trend weighs heavily toward SKIP.

Step 3 — VOLUME: Must be ≥ 10-day average (use right-side panel value vs displayed SMA). Within 5% = borderline confirmed. Clearly below = fail.
  Volume-price interpretation (all four quadrants):
    Rising price + Rising volume   → Trend healthy, bulls in control. Strong confirmation for longs.
    Rising price + Falling volume  → Trend weakening, bulls losing conviction. Caution — flag this.
    Falling price + Rising volume  → Bears in control. Strong confirmation for shorts.
    Falling price + Falling volume → Weak correction or consolidation. Trend likely to resume.
  Below-average volume on the trigger candle = do not trade; mark Step 3 failed.

Step 4 — S&R vs STOPLOSS ALIGNMENT: Compute |S&R − stoploss| / stoploss × 100. Above 4% → passed: false, knockout: true. Prefer user-provided levels; use chart estimates when not provided but flag uncertainty.
  S&R zone construction rules:
    - A level qualifies as S&R only if price has reacted to it at least 3 times (touched, reversed, or consolidated).
    - Reactions spaced ≥ 2 weeks apart carry more weight than clustered reactions.
    - Treat every S&R level as a zone (±0.5–1% band), never a single price.
    - Target for a trade = nearest opposing S&R level (nearest resistance for longs, nearest support for shorts).

Step 5 — DOW PATTERNS: Identify double/triple tops/bottoms, flags, range breakouts. Supporting or contradicting the trigger?
  Pattern-specific rules:
    - Double Top / Double Bottom: the two peaks or troughs must be ≥ 2 weeks apart to be a valid pattern.
    - Breakout confirmation: true breakout requires above-average volume on the breakout candle. Below-average volume = false breakout risk; flag explicitly.
    - Breakout target: measure the range width (resistance − support) and project that distance from the breakout point.
    - Bull / Bear Flag: consolidation runs 5–15 sessions on declining volume; breakout on above-average volume confirms continuation.

Step 6 — PRIMARY & SECONDARY TREND: Both established and aligned with the trade direction?

Step 7 — RRR: (Target − Entry) / (Entry − SL). Below 1.2 → passed: false, knockout: true. Between 1.2–1.5 → borderline. Prefer user-provided levels; estimate from chart when not provided.

Step 8 — MACD & RSI CONFIRMATION (confirmatory only — never drives verdict alone):
  RSI rules:
    - 0–30 = oversold zone; 70–100 = overbought zone.
    - RSI prolonged in oversold zone = strong downtrend continuation; do not assume immediate reversal.
    - RSI prolonged in overbought zone = strong uptrend continuation.
    - RSI crossing above 30 from below = bullish signal. RSI crossing below 70 from above = bearish signal.
    - RSI is unreliable as a standalone reversal signal in strong trends; use only as confirmation.

  MACD rules:
    - MACD line crossing above signal line = bullish momentum shift. Crossing below = bearish.
    - MACD above zero line = bullish momentum territory; below zero = bearish momentum territory.
    - Crossovers near the zero line carry more weight than crossovers far from zero.
    - MACD is unreliable in sideways/ranging markets — state this when chart structure is ranging.

  Bollinger Band rules:
    - Price at or beyond upper band = overbought; consider bearish setup.
    - Price at or beyond lower band = oversold; consider bullish setup.
    - Middle band (20-day SMA) = mean-reversion target for both long and short setups.
    - Do NOT apply mean-reversion logic in a strongly trending market (bands expanding, price riding one band) — the signal is unreliable there.

  INDICATOR WEIGHTING:
    - Steps 1–7 all pass cleanly AND both MACD and RSI confirm direction → conviction = STRONG.
    - Indicators do not confirm: note the non-confirmation but do NOT abandon the setup on this basis alone. Conviction = STANDARD. Indicators are confirmatory, never veto-wielding.

VERDICT RULES:
TAKE: Steps 1–7 pass (borderline flags allowed). RRR ≥ 1.5.
WATCH: 1–2 steps are borderline/marginal, or a Dow pattern is forming but unconfirmed, or RRR is 1.2–1.5. Populate watchReason and provide estimated levels.
SKIP: Any hard knockout (Step 4 or 7 with knockout: true and passed: false), prior trend clearly wrong, or three or more soft fails stacked.

EXCLUSION LIST — DO NOT USE:
The following frameworks are outside the scope of this analysis. Do not apply, reference, or draw conclusions from them:
  - Elliott Wave Theory (wave counts, impulse/corrective waves)
  - Ichimoku Cloud (kumo, tenkan/kijun, chikou span)
  - Parabolic SAR
  - ADX / DMI (Average Directional Index, +DI / −DI)
  - Stochastic Oscillator
  - Fibonacci retracements or extensions — UNLESS a Fibonacci level is explicitly drawn on the submitted chart image, in which case note it as user-drawn context only and do not treat it as a signal.
If any excluded indicator appears on the chart, acknowledge its presence briefly and proceed without using it.`;


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
    volumeVsAverage, volumeCharacter, macd, rsiValue, bollingerBands,
  } = formData;

  const prompt = `Analyse the chart image and derive your full assessment independently.

Ticker: ${ticker}  |  Date: ${date}  |  Source: ${chartSource}

INDICATOR READINGS (user-entered to help calibrate the right-panel values):
Volume vs average: ${volumeVsAverage || 'Not provided'}
Volume character: ${volumeCharacter || 'Not specified'}
MACD: ${macd || 'Not provided'}
RSI: ${rsiValue || 'Not provided'}
Bollinger bands: ${bollingerBands || 'Not specified'}

Read everything else directly from the chart image: candle pattern and quality, prior trend direction and duration, chart structure, S&R levels. Do not wait for user input on these — form your own independent view from what you see.

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
- whereYouWentWrong: you only received the user's indicator readings (MACD, RSI, Volume, Bollinger Bands). Only flag a correction here if one of those indicator readings clearly contradicts what you see in the chart. Return [] if the readings match or are close. Do NOT fabricate corrections on fields the user did not provide.
- myDecision.entry / stopLoss / target / rrr are null only if verdict is SKIP. For WATCH, populate these if calculable (qualifying conditions). For TAKE they are always required.
- conviction is always "STRONG" or "STANDARD" — never omit it. STRONG requires steps 1–7 all clean AND both MACD and RSI confirming; STANDARD otherwise.
- watchReason is an empty string unless verdict is WATCH — then it must explain specifically which step(s) are borderline or unconfirmed.
- checklistResults must contain exactly 8 entries in order (steps 1–8). Set passed: false AND knockout: true only for hard knockouts (Step 4 >4% S&R-vs-SL gap, Step 7 RRR <1.2). Set borderline: true (with passed still true) for values within 5% of thresholds.
- candlePattern assesses the trigger pattern from the chart. For multi-candle patterns (Engulfing, Morning Star etc.) evaluate whether the pattern meets quality thresholds. Apply the tolerances from your CANDLESTICK READING rules.
- For multi-candle patterns, candlePattern.name should be the pattern name (not the individual candle type of Day 0).
- candleSequence reads the last 5–7 candles from the left panel of the dual-panel chart. Describe the arc and whether the sequence supports or contradicts the trigger.
- S&R levels in keyLevels must be grounded in prior swing pivots visible on either panel of the chart.`;

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
