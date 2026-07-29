# Feature: Technical Rating Score + Analyzer Page (Chartmill-inspired)

**Status:** Backlog — early scoping, not yet designed
**Priority:** Medium
**Builds on:** Existing candlestick pattern detector, OHLC data pipeline (Groww + Supabase), Claude analysis layer

---

## Problem / inspiration

Came across this in Chartmill and think it's worth scoping for us:

1. **Technical health rating** — a single score summarizing a stock's overall technical condition (trend, momentum, relative strength, moving-average structure, volatility) so a user can gauge "is this stock technically strong right now" without reading a full chart.
2. **Setup quality score** — a separate score specifically for breakout-setup quality (tightness of base, volume dry-up before breakout, distance from key levels, etc.) — different question from "is this stock strong overall," more "is *this specific setup* clean."
3. **Analyzer page** — a page where a user pulls up any stock (not necessarily one they're about to journal a trade on) and gets an automated read: possible trade setups the algorithm identifies, plus a general technical writeup — closer to a screener/research tool than our current Analyse flow, which is chart-image-upload-driven and per-trade.

---

## How this differs from what we have today

| | Today (Analyse) | This feature (Analyzer) |
|---|---|---|
| Trigger | User uploads a chart image for a setup they're already considering | User just types a ticker to explore |
| Output | Claude's read of the uploaded chart + rule-based pattern/S&R checklist | Numeric rating(s) + auto-surfaced candidate setups, no image upload needed |
| Data source | Uploaded image (vision) | Our own OHLC data (Groww/Supabase) — chart never needs to leave our pipeline |
| Use case | "I found a setup, help me evaluate it" | "Show me what's technically interesting across my universe" |

This is a genuinely different mode from Analyse — closer to a stock screener with a research writeup than a per-trade evaluation tool. Likely complements Signals (which already scans the universe daily) rather than replacing it: Signals says "here's what matches the checklist," this would say "here's a graded score for any stock you ask about, plus a narrative."

---

## Solution shape (rough — needs a real design pass)

**Scoring layer** (rule-based, not LLM — scores should be deterministic/explainable):
- Technical health score: composite of trend (price vs 50/200 SMA, SMA slope), momentum (RSI, MACD), relative strength (vs Nifty/sector index — note: needs an index/sector data source we don't currently have), volatility contraction/expansion
- Setup quality score: base tightness (ATR or range compression over N days), volume pattern (dry-up into base, expansion on breakout attempts), proximity to breakout trigger level, risk/reward to nearest logical stop

**Narrative layer** (Claude, same pattern as existing `analyze.js`/`journal.js` usage):
- Feed the computed scores + OHLC summary + detected candlestick/chart patterns to Claude, get a written analysis and candidate setup callouts — reusing our existing "rules first, LLM narrates/judges on top" approach rather than asking Claude to invent numeric scores itself (keeps the ratings reproducible and auditable, consistent with how Analyse already combines `technicalindicators` + Claude judgment).

**New page**: `Analyzer` (or fold into Signals — open question below) — ticker input, no image upload, returns the two scores + narrative + candidate setups.

---

## Open questions (for design pass)

- Do we need a benchmark/sector index data source for relative-strength scoring? Groww's API surface for this needs checking — we currently only pull single-symbol OHLC.
- Is this a new page, or does it become what a ticker search on Signals expands into?
- Are the two scores (health, setup quality) always shown together, or is setup-quality conditional on a breakout-style pattern actually being detected first?
- Should Analyzer results be journal-able directly (skip straight from "algorithm found a setup" to a Journal session), tying this back into the existing 3-eye/outcome-tracking loop?
- Depends on chart pattern detection (`chart-pattern-detection.md`) for setup identification beyond candlesticks — sequencing between the two backlog items needs deciding.
