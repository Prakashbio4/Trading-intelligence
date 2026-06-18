# Feature: Macro & Sector Context Logging

**Status:** Backlog — design finalized, not yet built  
**Priority:** Medium  
**Depends on:** Trade outcome logging (must exist first)

---

## Problem

Every logged trade currently captures the *stock's* story — setup, pattern, indicators, decision. It has no record of the *environment* the trade was taken in. Over time this means the Insights page can only tell you which setups worked, not *when* and *why* they worked or failed.

A flag breakout in a Nifty uptrend with a hot sector behind it is a fundamentally different trade from the same setup in a risk-off market with sector headwinds. We need to capture that difference.

---

## Solution: Free-Text Context Notes + AI Interpretation

### Two optional free-text fields added to the trade log

**Field 1 — Macro context**
> What was happening in the broader market when you took / managed / exited this trade?
> Write freely — index trend, global events, FII activity, policy news, anything that felt relevant.

**Field 2 — Sector context**
> What was the sector doing? Any sector-specific news, rotation, or sentiment driving the move?

No dropdowns. No enforced structure at write time. The trader writes what they remember in plain English.

### Examples of what users will write

- *"Iran war was expected to end but it didn't, spiking oil costs and pushing equities down across the board"*
- *"USA announced new tariffs on pharma companies importing to them — hit sentiment hard across the sector even for domestic-only players"*
- *"Nifty was in a strong uptrend, FIIs buying consistently for 3 weeks, overall risk-on mood"*
- *"Pre-budget week — most traders sitting on hands, low volume, false breakouts everywhere"*

---

## Why Free Text Beats Dropdowns Here

A dropdown would say `Geopolitical: Yes`. Free text lets the AI later reason:

> *"7 of your 9 losses have macro notes describing external shock or expectation-reversal events. Your setups may not be accounting adequately for event risk."*

The *direction of surprise* matters (expected positive that didn't happen vs straightforward bad news). The *specific mechanism* matters (oil → equities vs direct sector policy). No enum captures that nuance.

---

## Intelligence: AI Interprets Notes at Query Time

The AI tags notes **lazily** — only when the Insights page loads, only for notes not yet tagged, results cached.

For each note the AI extracts:

| Field | Type | Examples |
|-------|------|---------|
| `macro_tags` | array | `geopolitical_risk`, `policy_shock`, `sector_news`, `risk_off`, `event_proximity`, `expectation_reversal` |
| `macro_sentiment` | enum | `Tailwind / Headwind / Neutral / Mixed` |
| `sector_tags` | array | `tariff_impact`, `sector_rotation`, `hot_sector`, `sector_cooldown` |
| `sector_sentiment` | enum | `Tailwind / Headwind / Neutral / Mixed` |

---

## Insights Correlations This Unlocks

Once enough tagged trades accumulate:

- **Setup × Macro**: Do flag breakouts work in risk-off environments?
- **Sector momentum**: Win rate in hot sectors vs cold sectors
- **Event proximity**: How much do pre-event / surprise-event trades hurt?
- **Expectation reversal**: Trades taken when an anticipated catalyst failed — separate loss profile?
- **FII activity**: Do your wins cluster when FIIs are buying?

The Insights page stops being a scorecard and becomes a pattern discovery tool.

---

## Data Model

```sql
-- New columns on trade_sessions (or a joined macro_context table)

macro_note          TEXT        -- raw free text, written by user
sector_note         TEXT        -- raw free text, written by user
macro_tags          JSONB       -- AI-extracted, cached
macro_sentiment     VARCHAR     -- Tailwind / Headwind / Neutral / Mixed
sector_tags         JSONB       -- AI-extracted, cached
sector_sentiment    VARCHAR     -- Tailwind / Headwind / Neutral / Mixed
context_tagged_at   TIMESTAMP   -- when AI last processed these notes
```

Kept additive — existing sessions without notes have nulls, Insights queries filter `WHERE macro_note IS NOT NULL` once enough data exists.

---

## UX Design Notes

### Write time (trade log form)
- Both fields are **optional** — never block trade logging
- Placed after the trade outcome section, labeled clearly as "optional context"
- Simple `<textarea>` — no dropdowns, no structure enforced

### Read time (Insights page)
- AI processes untagged notes on page load (batch, async)
- Show extracted tags as small chips under each trade in the journal view
- Insights correlation cards appear once ≥10 tagged trades exist (below that, not enough signal)

### Daily pre-fill option (future enhancement)
- A "Today's Market" card on the dashboard — fill macro context once, auto-stamp all trades logged that day
- Reduces friction for active traders taking multiple positions

---

## Build Order

1. Add `macro_note` + `sector_note` fields to trade log form and DB
2. Store raw text — no AI at this stage
3. Build AI tagging function (Anthropic call, structured output, writes to `macro_tags` / `sector_tags`)
4. Hook tagging into Insights page load (lazy, cached)
5. Add correlation cards to Insights using tagged data

---

## Open Questions

- Do we tag at save time (slight delay on log submit) or at Insights load time (lazy)? Lazy preferred to keep logging fast.
- Minimum trade count before showing correlations in Insights? Suggested: 10 tagged trades.
- Should the journal view show extracted tags inline so users can see what the AI read from their notes?
