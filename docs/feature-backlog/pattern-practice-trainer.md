# Feature: Pattern Practice Trainer

**Status:** Designed, not yet built

## Problem

SIPY Wick's whole premise is closing the gap between what a trader *thinks* they see on a chart and what's actually there. Right now that check only happens on real trades, after the fact. There's no low-stakes way to practice *spotting* a pattern before it costs you money — candlestick patterns, chart structures (Head & Shoulders, double tops), or basic Dow-theory trend reads (higher-highs/higher-lows vs. lower-highs/lower-lows).

Real charts rarely cooperate with a lesson plan — you can't reliably find 3 clean Bullish Engulfing setups or a textbook Head & Shoulders on demand. A practice mode needs charts generated to order.

## Solution

A new **Practice** page: pick a pattern (or "identify the trend"), pick a chart duration, and the system generates a synthetic OHLC chart with the pattern embedded somewhere inside it. The user marks where they think it is; the system validates against ground truth it created at generation time and gives feedback.

Three pattern tiers, because they need different generation and validation mechanics:

| Tier | Examples | Span | Existing building block |
|---|---|---|---|
| **Candlestick** | Bullish/Bearish Engulfing, Hammer, Doji, Morning Star, etc. | 1–3 candles | `backend/lib/patterns.js` — 27 detectors already wrapping `technicalindicators` |
| **Structural** | Head & Shoulders, Double Top/Bottom, Ascending/Descending Triangle | 15–40+ candles | None yet — no library detects these |
| **Trend (Dow theory)** | Uptrend (HH/HL), downtrend (LH/LL), range | Whole window or a leg of it | None yet |

---

## Architecture

### 1. Base series generator
A daily random walk (percentage-based steps, configurable volatility) produces the "boring" 60 or 90 candles the pattern gets embedded into. This is the one genuinely new primitive — nothing in the codebase generates synthetic OHLC today (confirmed: `backend/lib/groww.js` only fetches real historical candles, nothing synthetic exists).

### 2. Candlestick-tier embedding — generate & verify against production code
1. Pick N non-overlapping day-ranges in the window.
2. Synthesize candidate OHLC for the pattern's candles, anchored to the surrounding price level.
3. Run the **same detector** `patterns.js` already uses in production (e.g. `ti.bullishengulfingpattern`) against the candidate slice. If it doesn't fire, perturb and retry.
4. After splicing all instances back in, run the full `detectPatterns()` over the whole 60/90-day series as a sanity check — reject the sample if splicing accidentally created an unintended second pattern nearby (adjacent bodies can spawn a stray harami or doji).

This guarantees the answer key is identical to what the app's own detector would flag on a real chart — no hand-authored shape that might not match production logic.

### 3. Structural & trend tier — shared pivot/zigzag engine
No existing library validates these, so the validator *is* the pattern definition. New shared module, `backend/lib/zigzag.js`:
- Extracts swing highs/lows from a candle series above a configurable % threshold (a standard zigzag indicator).
- **Structural patterns** are authored as a pivot template — e.g. Head & Shoulders = trough → peak(LS) → trough → peak(Head, higher than LS) → trough → peak(RS, ≈ LS height) → break below the neckline (line joining the two troughs). Generation randomizes timing/amplitude/noise between pivots within the template's tolerances; validation re-runs the zigzag extractor on the finished series and checks the resulting pivots satisfy the same proportional rules.
- **Trend legs** reuse the identical zigzag output — no new template needed, just classify consecutive pivots as HH/HL (up), LH/LL (down), or neither (range).

Because this validator is rule-based and reusable, it's also a plausible future real-chart feature (flagging structural patterns in Signals/Analyse) — not just a training-mode throwaway.

### 4. Duration & instance count
- Duration is a user-selectable input: 60 or 90 days (90 gains a "chart is too short" gate for structural patterns that need more room).
- Candlestick patterns: 3–5 instances per window, minimum spacing enforced so instances stay visually distinct.
- Structural patterns: 1 instance per 60-day window, up to 2 in a 90-day window — a Head & Shoulders alone can eat 20–30 days, so more than that starts looking artificial.
- Trend-leg exercises: not "find it within" — the whole window (or 2–4 marked legs) is the exercise.

### 5. Difficulty
- **Easy** — clean, close-to-textbook proportions, low path noise.
- **Hard** — more jitter in proportions/timing, noisier candle bodies.
- **Mixed (stretch)** — insert a near-miss decoy (e.g. two peaks that almost but don't qualify as a double top) alongside a real instance, since telling a real pattern from an almost-pattern is the actual skill.

---

## Interaction model (open question — see below)

For candlestick patterns, "identify" naturally maps to **clicking the candle(s)** that complete the pattern, checked against the answer key's date range with a small tolerance.

For structural patterns and trend legs, a single click can't capture "these 12 days form the left shoulder." Two options:
- **Click-and-drag a date range** — simplest to build, one interaction model reused across all three tiers.
- **Click the key turning points** (shoulder peaks, neckline, trend pivot points) — more precise feedback, but a different interaction per pattern tier and more UI work.

Recommendation: ship click-and-drag range selection first since it's one component for all three tiers; revisit pivot-level precision as a v2 refinement once the base loop works.

---

## API surface (draft)

```
POST /api/learn/generate
  { patternTier: 'candlestick' | 'structural' | 'trend',
    patternName: 'Bullish Engulfing' | 'Head and Shoulders' | ...,
    durationDays: 60 | 90,
    difficulty: 'easy' | 'hard' }
  → { sessionId, candles, /* answerKey withheld until submit */ }

POST /api/learn/submit
  { sessionId, userMarks: [{ startDate, endDate }, ...] }
  → { correct, matched: [...], missed: [...], falsePositives: [...], answerKey, explanation }
```

Answer key is generated server-side and withheld from the initial payload so it can't be inspected client-side before the user answers.

---

## Frontend

- New page `frontend/src/pages/Practice.jsx` (or `Learn.jsx`).
- **Extract** the inline `CandleChart` SVG component — currently duplicated between `Signals.jsx` and `Journal.jsx` — into a shared `frontend/src/components/CandleChart.jsx` that supports highlight overlays and click/drag selection. This refactor unlocks the practice page and de-duplicates existing code.
- Pattern picker for the candlestick tier is generated for free from `DETECTORS` metadata in `patterns.js` (name/bias already there); structural and trend pickers need a small new static list.
- Two modes per pattern: **Quiz** (mark it, get scored) and **Flashcard** (chart shown pre-annotated with an explanation) — flashcard is useful as a "teach me first" step before quizzing.

---

## Data model

v1 can be **stateless** — generate and validate synchronously, no persistence required.

If/when we want practice history or an Insights-style "weakest pattern to spot" stat (consistent with the app's existing calibration theme), add:

```sql
CREATE TABLE practice_attempts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  pattern_tier VARCHAR,       -- candlestick / structural / trend
  pattern_name VARCHAR,
  difficulty VARCHAR,
  duration_days INT,
  answer_key JSONB,
  user_marks JSONB,
  correct BOOLEAN,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Build order

1. Extract shared `CandleChart` component with highlight/selection support (needed by everything else).
2. Ship the candlestick tier only — generate, verify via `patterns.js`, quiz + flashcard modes. Cheapest slice since detection already exists.
3. Build `backend/lib/zigzag.js` (swing high/low extraction).
4. Ship the structural tier, starting with Head & Shoulders and Double Top/Bottom (most textbook-common).
5. Ship the Dow-trend leg-labeling exercise on the same zigzag utility.
6. Optional: persist `practice_attempts`, surface a "Practice" stats card in Insights.

## Non-goals (v1)

- No practicing on real historical charts — synthetic only, so ground truth is guaranteed.
- No LLM grading — pure rule-based validation, zero marginal cost per attempt, consistent with the app's "rules first" philosophy.
- No pattern tiers beyond the three above (e.g. no Elliott Wave, no Fibonacci-based patterns) until these three are working end to end.

## Open questions

- Click-and-drag range vs. click-the-pivots for structural/trend identification — leaning drag-range for v1 (see above), needs a decision before frontend work starts.
- Should difficulty include the "decoy near-miss" mode at launch, or is that a v2 addition once the base loop is validated?
- Quiz vs. flashcard as the default landing experience for a pattern a user has never practiced before?
- Minimum practice attempts before a "Practice" tab appears in Insights (mirroring the existing 20-session gate on Insights itself)?
