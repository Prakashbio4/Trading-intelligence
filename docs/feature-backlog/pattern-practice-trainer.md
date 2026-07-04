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

### 5. Difficulty — adaptive, per user per pattern

Difficulty is not a dropdown the user sets — it's a **level (1–5, say) tracked per user per pattern**, and it decides:
- **Candlestick**: how close the shape sits to the detection threshold (level 1 = obvious textbook shape, level 5 = barely qualifies), tighter grading tolerance on the marked span, more decoy candles nearby that almost-but-don't qualify.
- **Structural**: smaller head/shoulder height differential, subtler neckline slope, more path noise, decoy near-miss structures appearing alongside the real one at higher levels.
- **Trend**: shorter/subtler legs, more counter-trend noise (pullbacks) inside a trend, more ambiguous trend-vs-range segments.

**Progression rule:** level increases only after a *correct* answer on that pattern; an incorrect answer holds the level steady (never decreases) so a user isn't punished twice for a miss — they just don't advance until they demonstrate they can spot the current level. Level is capped at the top tier once a user has clearly mastered a pattern.

This means difficulty state must persist per (user, pattern) from day one — see Data Model below — it isn't a per-session-only concept.

---

## Annotation model — decided: full drawing toolkit

The user marks up the chart directly, the way you would on a real charting tool — not a single click, a real annotation surface:
- **Point markers** — click a candle (or a specific high/low) to flag a single spot, e.g. "this is the left shoulder."
- **Rectangles** — drag a box across a date/price range to flag a span, e.g. "the whole engulfing pair is in here."
- **Trendlines** — click two points to draw a line, e.g. the neckline of a Head & Shoulders, or a Dow-trend leg.

Whatever the user draws on-screen, the frontend converts it to a **structured shape** — `{ type: 'point', date, price }`, `{ type: 'rect', startDate, endDate, priceLo, priceHi }`, `{ type: 'line', from: {date, price}, to: {date, price} }` — before it ever reaches the backend. The backend only ever grades structured shapes against the structured answer key; it never interprets pixels or images. This keeps grading fully deterministic and cheap (no LLM in the loop), consistent with the app's rules-first philosophy.

Grading per pattern tier:
- **Candlestick** — answer key is a candle-date span. A point marker or rectangle overlapping that span (fully, or by a tolerance that tightens as difficulty rises — see below) counts as correct.
- **Structural** — answer key is an ordered list of pivots (LS peak, Head peak, RS peak, neckline). The user can mark the whole span with one rectangle (coarse grading: did you bracket the right region) or place individual point markers / a trendline on the actual sub-components (fine grading: partial credit per correctly identified pivot/neckline, which gives much better feedback on *what* they got right vs. wrong).
- **Trend** — answer key is a classified sequence of swing legs. A drawn trendline is graded against the true leg's endpoints/slope within a tolerance band.

After grading, the response always reveals the true answer key overlaid on the chart (the actual pivots/span highlighted) regardless of correctness — the "aha, here's what a real one looks like" moment matters as much as the score.

This is a meaningfully bigger frontend build than a single click handler: a small drawing engine (tool palette, pixel↔date/price coordinate mapping, shape persistence before submit, undo/clear). Worth treating as its own build item rather than bundling it into the chart-rendering work.

---

## API surface (draft)

```
POST /api/learn/generate
  { patternTier: 'candlestick' | 'structural' | 'trend',
    patternName: 'Bullish Engulfing' | 'Head and Shoulders' | ...,
    durationDays: 60 | 90 }
  → { sessionId, candles, level /* looked up from user_pattern_progress, not client-supplied */ }
  // answerKey withheld until submit

POST /api/learn/submit
  { sessionId,
    shapes: [
      { type: 'point', date, price },
      { type: 'rect', startDate, endDate, priceLo, priceHi },
      { type: 'line', from: {date, price}, to: {date, price} }
    ] }
  → { correct, matched: [...], missed: [...], falsePositives: [...], answerKey, newLevel, explanation }
```

Difficulty is derived server-side from the caller's `user_pattern_progress` row, not passed in by the client — otherwise a user could just request "easy" every time and the leveling would mean nothing. Answer key is generated server-side and withheld from the initial payload so it can't be inspected before the user answers. `submit` both grades the attempt and updates the level per the escalation rule above.

---

## Frontend

- New page `frontend/src/pages/Practice.jsx` (or `Learn.jsx`).
- **Extract** the inline `CandleChart` SVG component — currently duplicated between `Signals.jsx` and `Journal.jsx` — into a shared `frontend/src/components/CandleChart.jsx` that supports highlight overlays. This refactor is a prerequisite but not sufficient on its own — see the drawing toolkit below.
- **New drawing toolkit component** — a tool palette (point / rectangle / trendline), pixel↔date/price coordinate mapping over the chart, shape persistence in local state, undo/clear, and a "submit" action that serializes drawn shapes into the structured payload the API expects. This is the single biggest net-new frontend piece in this feature.
- Pattern picker for the candlestick tier is generated for free from `DETECTORS` metadata in `patterns.js` (name/bias already there); structural and trend pickers need a small new static list.
- Two modes per pattern: **Quiz** (mark it, get scored) and **Flashcard** (chart shown pre-annotated with an explanation) — flashcard is useful as a "teach me first" step before quizzing, especially the first time a user meets a pattern (level 1 has no history to escalate from).

---

## Data model

Persistence is required from v1 — the leveling behavior doesn't work without it.

```sql
CREATE TABLE user_pattern_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  pattern_tier VARCHAR,       -- candlestick / structural / trend
  pattern_name VARCHAR,
  level INT DEFAULT 1,
  attempts INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  last_result BOOLEAN,
  last_attempted_at TIMESTAMP,
  UNIQUE (user_id, pattern_tier, pattern_name)
);

CREATE TABLE practice_attempts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  pattern_tier VARCHAR,
  pattern_name VARCHAR,
  level INT,
  duration_days INT,
  answer_key JSONB,
  user_shapes JSONB,          -- the structured annotation payload from submit
  correct BOOLEAN,
  created_at TIMESTAMP DEFAULT now()
);
```

`user_pattern_progress` drives the next generation's difficulty; `practice_attempts` is the audit trail and feeds any future "weakest pattern to spot" stat in Insights, mirroring the app's existing calibration theme.

---

## Build order

1. Extract shared `CandleChart` component with highlight overlay support.
2. Build the drawing toolkit (point/rectangle/trendline + coordinate mapping + shape serialization) — needed before any tier can be quizzed, since annotation, not clicking, is the interaction model.
3. Add `user_pattern_progress` + `practice_attempts` tables and the level-lookup/escalation logic.
4. Ship the candlestick tier — generate, verify via `patterns.js`, quiz + flashcard modes, difficulty knobs wired to level. Cheapest pattern-generation slice since detection already exists.
5. Build `backend/lib/zigzag.js` (swing high/low extraction).
6. Ship the structural tier, starting with Head & Shoulders and Double Top/Bottom (most textbook-common), with per-pivot partial-credit grading.
7. Ship the Dow-trend leg-labeling exercise on the same zigzag utility.
8. Optional: surface a "Practice" stats card in Insights from `practice_attempts`.

## Non-goals (v1)

- No practicing on real historical charts — synthetic only, so ground truth is guaranteed.
- No LLM interpretation of annotations — shapes are structured client-side and graded with deterministic rules, zero marginal cost per attempt, consistent with the app's "rules first" philosophy.
- No pattern tiers beyond the three above (e.g. no Elliott Wave, no Fibonacci-based patterns) until these three are working end to end.
- No cross-pattern "open scan" mode (chart with several different unlabeled patterns to find and name) — a natural extension of "mark what you see," but out of scope until single-pattern targeted practice works end to end.

## Open questions

- Coarse (one rectangle over the whole pattern) vs. fine (individual point markers per pivot/neckline) grading for the structural tier — probably support both and weight fine-grained marking with better partial credit, but needs a decision on how much that's surfaced in the UI vs. just accepted silently.
- Should a decoy near-miss shape, if marked by the user, count as a false positive against them, or just go ungraded since it's genuinely ambiguous even to an expert?
- Quiz vs. flashcard as the default landing experience the first time a user meets a pattern (level 1, no history yet)?
- Minimum practice attempts before a "Practice" tab appears in Insights (mirroring the existing 20-session gate on Insights itself)?
- Level cap and reset: does level ever reset (e.g. after N days of not practicing that pattern), or is progress permanent once earned?
