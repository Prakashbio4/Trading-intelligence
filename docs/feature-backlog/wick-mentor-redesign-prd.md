# Wick Redesign — Dashboard & Analyse (PRD)

**Status:** Draft — for discussion, not yet scoped into build tasks.

---

## The one-line vision

Wick is a mentor, not a tip service. It doesn't tell you what to buy or sell — it looks over your shoulder while you read a chart and tells you where your thinking is solid and where it isn't. The goal is to make you a better chart-reader over hundreds of sessions, not to hand you a verdict.

---

## The problem with how these two pages work today

**Dashboard (currently called Insights)** shows a grid of stats — agreement rate, strongest pattern, biggest gap area, AI accuracy — but no single number answers the one question that actually matters: *am I making money consistently?* It's busy without being clear.

**Analyse** asks you to upload a screenshot of a chart and fill in a long form (trend, pattern, volume, indicators, support/resistance, one field at a time), then an AI looks at the same screenshot and gives you its own opinion. The problem: the AI's opinion isn't grounded in anything more solid than your own guess — it's reading a picture and reciting textbook rules, the same way you are. It ends up feeling like two guesses being compared, not a mentor correcting a student.

---

## Page 1 — Dashboard: one clear scoreboard

**Purpose:** answer "am I actually improving as a trader?" in one glance.

**What's on it:**
- **Win Rate** — how often your trades work out.
- **Weighted Average Profit/Loss** — when you win, how much do you win by; when you lose, how much do you lose by. This is the number that tells you whether your wins are actually bigger than your losses, which matters more than win rate alone.

That's it. Everything else that used to live on this page (calibration charts, pattern breakdowns, chat) either moves elsewhere or waits — the point of this redesign is a single, honest scoreboard, not a dashboard you have to interpret.

**Why this matters:** consistency is what separates a real trader from someone who got lucky once. This page should make that obvious without digging.

---

## Page 2 — Analyse: a live mentoring conversation, not a form

### The new flow, step by step

1. **Type in a stock name** (e.g. Titan). A live chart loads with real price data — no more uploading a screenshot.

2. **Describe your strategy in one line**, in your own words — e.g. *"I trade based on RSI and MACD"* or *"I look for breakouts after consolidation."*

3. **Wick adapts to what you said.** Instead of one long fixed form asking about everything, it asks questions tailored to your stated approach. Said RSI/MACD? It asks about those. Said breakouts? It asks about support, resistance, and volume instead.

4. **Every question is grounded in real numbers pulled from the actual chart data** — the real RSI value, the real MACD reading, the real candlestick pattern on the last several candles — not an AI's guess from looking at a picture. If your answer doesn't match what the data actually shows, Wick pushes back with the real number, the way a mentor says *"are you sure? look again"* — instead of silently marking you wrong.

5. **You lay out your actual trade plan** — entry, stop loss, target — and Wick checks whether it holds up (is your stop near a real support level, is the reward worth the risk).

6. **You get a report card at the end** — not just right/wrong, but *why*: what you read correctly, and where your thinking broke down. For example: *"You correctly read the trend, but you called this a breakout even though volume didn't confirm it."*

7. **Over time (later phase, not in this version):** your sessions build a personal profile — Wick starts noticing patterns like *"you tend to enter one day early"* or *"you're strong at spotting setups but weaker at timing entries."* This becomes the long-term coaching layer.

### What this version deliberately does NOT do

- It does not tell you to buy or sell.
- It does not (yet) tell you the historical win rate of your strategy — that's a separate "strategy testing" feature, already discussed and designed, but planned as a later phase that sits on top of this one once the mentoring conversation itself is solid.
- It does not use live intraday/tick data — daily chart data only, for now.

---

## Why it's designed this way, in plain terms

There are really two different jobs being done here, and keeping them separate is what makes the mentor trustworthy:

- **One job just reads the market and reports facts** — what's the RSI, is there a recognizable candlestick pattern, where's support and resistance. This is pure computation off real price history. No opinions, no guessing.
- **The other job has the actual conversation with you** — asking questions, challenging your reasoning, building the report card. It's only allowed to disagree with you by pointing at the facts from the first job, never by just asserting an opinion.

That separation is the whole difference between "Wick coaches you" and "Wick is just another AI stock-tip app with extra steps."

---

## What we already have to build this on

- A live market data subscription (Groww) is already wired into the app, so real price/volume history for any NSE stock is available — this isn't a new integration, it's already there.
- Code that automatically detects common candlestick patterns and support/resistance zones from real price history already exists and is used elsewhere in the app (Signals, Learn) — no new guessing logic needed for those.
- What's actually new: the back-and-forth mentoring conversation itself, a live chart embedded directly in Analyse, and pulling RSI/MACD/moving-average numbers live (the computation exists as a building block, just not wired up for this yet).

---

## Known limitations, stated upfront rather than discovered later

- Our market data only goes back to 2020, and only covers stocks that are currently listed — if a company got delisted, we have no history for it. Worth remembering any time we lean on historical data.
- The mentor can only fact-check what's actually checkable — RSI, volume, support/resistance, candlestick patterns. For more subjective reads (*"does this feel like accumulation?"*), it can coach and probe, but it can't grade you against a hard number. We should never dress up a subjective opinion as if it were a checked fact.

---

## What success looks like

- You open Analyse, describe your strategy once, and the questions genuinely feel tailored to how you think — not a generic checklist repeated for everyone.
- Whenever Wick disagrees with your read, it always shows you the real number behind the disagreement — never just an opinion.
- Dashboard tells you in one glance whether your trading is actually working, without needing to interpret six different stats.

---

## Phasing

- **Phase 1 (this document):** Dashboard scoreboard (win rate + weighted avg P&L) and the new Analyse flow (live chart, one-line strategy intake, adaptive fact-grounded questioning, trade-plan check, end-of-session report card).
- **Phase 2 (already discussed, separate from this document):** a strategy backtesting engine (test a rule against years of real history, honestly reporting sample size and costs) and a long-term personal trading-pattern profile built from many mentor sessions over time.
