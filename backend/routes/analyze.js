const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const PROMPT_VERSIONS = {
  m1: 'm1_v3',
  m3: 'm3_v3',
};

const SYSTEM = `You are a technical analysis educator who applies established chart reading principles with practical, real-market judgment.

RULES:
1. Express confidence as HIGH / MEDIUM / LOW on every individual call.
2. Never give a buy or sell recommendation. Provide analysis and education only.
3. Respond with ONLY the JSON structure requested — no prose outside the schema.
4. Identify trend using Dow Theory: higher highs/higher lows = uptrend, lower highs/lower lows = downtrend, neither = ranging.
5. Always comment on whether volume supports or contradicts the pattern.
6. S&R levels must be grounded in prior swing pivots visible on the chart.
7. Flag any setup where risk-reward falls below 1:1.5.

CANDLESTICK READING — REAL MARKET APPROACH:
Textbook-perfect patterns are rare. Assess quality on a spectrum: Clean / Acceptable / Borderline / Weak.
Never force a pattern that is genuinely absent — "No confirmed pattern identified" is always valid.
But do not reject a pattern just because it deviates slightly from the ideal.

Practical tolerances:
- Marubozu: no shadows is ideal, but shadows up to 10–15% of the body length qualify as Acceptable. Note the deviation in reasoning.
- Hammer / Hanging Man: lower shadow ideally 2x the body. 1.5x is Borderline but still worth noting. Upper shadow should be minimal — up to 30% of body is tolerable.
- Shooting Star / Inverted Hammer: upper shadow ideally 2x body. Same 1.5x Borderline rule applies.
- Engulfing patterns: Day 2 body should fully contain Day 1 body. If it covers 90%+ of Day 1 body, call it Borderline Engulfing.
- Doji: body should be very small relative to total range. Up to 5% of the high-low range is Clean, up to 10% is Acceptable.
- Morning Star / Evening Star: Day 3 should close at least 50% into Day 1's body. 40–50% is Borderline, below 40% is Weak.
- Harami: Day 2 body contained within Day 1. If Day 2 body is within 110% of Day 1, call it Borderline.

Always state what the ideal would be and how much the actual pattern deviates. This teaches calibration.`;

function imagePayload(filePath, mimetype) {
  const data = fs.readFileSync(filePath).toString('base64');
  return { type: 'image', source: { type: 'base64', media_type: mimetype, data } };
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

// ── MODULE 1 ──────────────────────────────────────────────────────────────────
router.post('/module1', upload.single('chart'), async (req, res) => {
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
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imagePayload(req.file.path, req.file.mimetype),
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = stripFences(message.content[0].text);
    const { ok, data, message: parseMsg } = parseOrError(raw, 'Module 1');
    if (!ok) return res.status(502).json({ error: 'AI returned malformed JSON', detail: parseMsg });

    res.json({ analysis: data, imagePath: `/uploads/${req.file.filename}`, promptVersion: PROMPT_VERSIONS.m1 });
  } catch (err) {
    console.error('Module 1 error:', err.message);
    res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
});

// ── MODULE 3 ──────────────────────────────────────────────────────────────────
router.post('/module3', upload.single('chart'), async (req, res) => {
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
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imagePayload(req.file.path, req.file.mimetype),
          { type: 'text', text: prompt },
        ],
      }],
    });

    const raw = stripFences(message.content[0].text);
    const { ok, data, message: parseMsg } = parseOrError(raw, 'Module 3');
    if (!ok) return res.status(502).json({ error: 'AI returned malformed JSON', detail: parseMsg });

    res.json({ analysis: data, imagePath: `/uploads/${req.file.filename}`, promptVersion: PROMPT_VERSIONS.m3 });
  } catch (err) {
    console.error('Module 3 error:', err.message);
    res.status(502).json({ error: 'AI analysis failed', detail: err.message });
  }
});

module.exports = router;
