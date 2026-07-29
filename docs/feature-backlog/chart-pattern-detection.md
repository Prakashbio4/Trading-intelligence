# Feature: Chart Pattern Detection (Head & Shoulders, ABCD, Dow Structure)

**Status:** Backlog — scoped, not yet designed in detail
**Priority:** Medium
**Builds on:** Existing 27-pattern candlestick detector (`backend/lib/patterns.js`), TradingView Advanced Charts widget

---

## Problem

Our automatic pattern detection today (`technicalindicators` via `patterns.js`) only covers **single/multi-candle candlestick patterns** — Engulfing, Doji, Morning/Evening Star, etc. It has nothing for **multi-swing chart patterns**, which is a separate and arguably more decision-relevant category for setup identification:

- **Head and Shoulders** (and inverse) — reversal structure
- **ABCD pattern** — measured-move continuation/reversal, common in swing setups
- **Dow Theory trend structure** — higher-highs/higher-lows vs lower-highs/lower-lows, the basic primitive most discretionary trend calls are actually built on
- Related: Double Top/Bottom, Triangles, Flags/Pennants

TradingView's charting library (already embedded via our submodule) ships **manual** drawing tools for several of these (Head & Shoulders, ABCD, XABCD/harmonics, Elliott Wave) under its Patterns toolbar, but nothing auto-detects them — a user has to click the pivots themselves. There's no native TradingView feature that scans a chart and flags "this looks like a Head & Shoulders," and we don't currently load any Pine Script indicator that would.

---

## Why this matters for us specifically

Candlestick patterns describe what happened over 1-3 candles. Chart patterns describe structure over dozens of candles — which is closer to how the 3-eye check (`what you saw` vs `what AI detected` vs `what the raw data shows`) should ideally work at the setup level, not just the single-candle level. Adding this would let Analyse/Signals flag structural setups (e.g., "price broke H&S neckline with volume confirmation") alongside the existing candlestick checklist, not instead of it.

---

## Solution shape (needs real design pass before building)

Two candidate approaches, not mutually exclusive:

1. **Pivot-based geometric detection (our own code)** — identify swing highs/lows (e.g. via a fractal/zigzag algorithm on OHLC data), then pattern-match sequences of pivots against known shapes (H&S: shoulder-head-shoulder with roughly symmetric shoulders and a neckline; ABCD: proportional retracement/extension ratios between legs; Dow structure: monotonic sequence of higher-highs/higher-lows or the inverse). This mirrors what `patterns.js` does for candles but the detectors are geometric/ratio-based instead of fixed-shape, so it's meaningfully harder and needs backtesting against known chart examples before trusting it.
2. **Pine Script study on the TradingView widget** — either write a custom Pine Script indicator or adopt a vetted community one, and add it via `addDefaultStudies()` in `TradingViewChart.jsx`. Faster to ship, but keeps detection logic outside our own codebase/DB, so it can't feed the 3-eye check or Insights the way our own detector can.

Recommendation for scoping conversation: prototype (1) for Dow structure first (simplest — pure pivot sequence, no shape-matching), since it's also the input primitive Head & Shoulders and ABCD detection would both need anyway (they're built on top of identified swing pivots).

---

## Open questions (for design pass)

- Do detected chart patterns feed into the existing `technicalindicators`-style detection pipeline (stored per session, shown in the 3-eye check), or surface as a separate "structure" panel?
- What confirmation rules (volume, neckline break, retest) turn a *candidate* pattern into a *confirmed* one worth surfacing — false positives are the main risk with geometric pattern matching?
- Minimum lookback window needed per pattern type (H&S typically wants 20-50+ candles; ABCD can be much shorter)?
- Does Signals get a new checklist item for structural setups, or is this Analyse-only initially?
