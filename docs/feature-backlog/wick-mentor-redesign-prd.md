# Wick Redesign — Dashboard, Analyse & Journal (PRD)

**Status:** Draft — for discussion, not yet scoped into build tasks.

---

## The one-line vision

Wick is a mentor, not a tip service. It doesn't tell you what to buy or sell — it looks over your shoulder while you read a chart and tells you where your thinking is solid and where it isn't. The goal is to make you a better chart-reader over hundreds of sessions, not to hand you a verdict.

**The bigger frame, for context (not scope):** charts are the starting medium, not the whole point. What Wick is really teaching is decision-making under uncertainty — reading evidence, forming a view, defending it, updating it. That's the same skill whether the medium is a candle today or options, portfolio allocation, or position sizing later. This is why the mentor is worth building carefully now — but it's a north star, not a reason to widen what Phase 1 or Phase 2 actually build. Both stay scoped to chart reading below.

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

5. **Wick asks "why," even when you're right.** Getting the answer correct isn't the finish line — a mentor cares more about *how* you got there than *what* you said. So instead of moving on after a correct answer, Wick sometimes asks the follow-up: *"Why do you think this is support? Which candles convinced you?"* If you say "price bounced here twice," it might ask, *"What did volume do on the second bounce?"* If you didn't check — it tells you to go look. That's the actual teaching moment, and it's the reason this isn't just a quiz.

6. **You lay out your actual trade plan** — entry, stop loss, target — and Wick checks whether it holds up (is your stop near a real support level, is the reward worth the risk).

7. **If Wick disagrees with your thesis, it doesn't just announce it — it makes you defend it first.** Instead of immediately revealing "the data says otherwise," it says *"convince me"* and lets you argue your case. Only if your defense doesn't hold up against the real facts does Wick reveal the number that contradicts you. This stays honest, not just adversarial for its own sake — Wick is only allowed to push back with something concrete from the fact data (or, later, from backtest evidence), never a rhetorical "are you sure?" with nothing behind it. If your case is actually solid, Wick concedes.

8. **You get a report card at the end** — not a checklist of right/wrong, but a coaching read on your reasoning: *"Trend identification: strong. Confirmation: weak — you didn't check volume before calling this a breakout. Risk planning: solid."* Instead of ✓/✗, the language is closer to how a coach talks: **observed well, missed, assumed, ignored, overlooked, confused** — words that describe thinking, not a test score.

9. **Over time, Wick adapts how hard it probes you, based on your own history.** This starts modestly (noticing within a single session that you're breezing through trend questions but struggling on volume) and grows over many sessions into a real profile — *"you tend to enter one day early," "you're strong at spotting setups but weaker at timing entries."* Once Wick knows your track record, it spends less time re-testing what you're already good at and digs harder exactly where you're weak, instead of asking the same fixed depth of question to everyone. This is the long-term coaching layer, and arguably the hardest thing here for a competitor to copy — but it only becomes real after real usage, not on day one (see caveat below).

### What this version deliberately does NOT do

- It does not tell you to buy or sell.
- It does not (yet) tell you the historical win rate of your strategy — that's a separate "strategy testing" feature, already discussed and designed, but planned as a later phase that sits on top of this one once the mentoring conversation itself is solid.
- It does not use live intraday/tick data — daily chart data only, for now.

---

## Page 3 — Journal: your trading history, kept honest

**Purpose:** every session you run becomes a permanent record — not just what you decided, but what actually happened — so patterns become visible over months instead of being forgotten. This is the ground-truth memory the Dashboard's win rate and the mentor's long-term profile both depend on.

**What each entry holds:**
- The full conversation from that session, logged automatically with the date, plus a short summary tag (which strategy this was) so entries are scannable at a glance rather than opaque.

**Outcome tracking — mostly already working today, being extended:**
- For **Skip/Watch** decisions, the system already checks back at set intervals to see what the price actually did afterward — did you correctly pass on a loser, or miss a winner.
- For **Take** trades, the system already scans real daily price history since entry, watching for the stop loss or target to actually be hit, and flags that crossing for you to confirm (it never silently auto-closes a trade — you confirm it actually happened, and you can dismiss a false alarm if price merely brushed the level).
- **New in these notes:** a trade that's gone 90 days without hitting either level gets flagged as **stale**, so it surfaces for a manual review instead of sitting open indefinitely — today it just keeps scanning with no cutoff or flag.

**Catching drift between plan and reality — new:**
- Journal should notice on its own when what you decided doesn't match what you actually did: you analyzed and the verdict was Skip/Watch, but a trade was entered anyway — or you decided Take, but the real entry price, stop loss, target, or position size ended up far from what the analysis said. Today this comparison isn't made automatically; it would need to run whenever the "what actually happened" fields get filled in, checked against the original decision and levels.

**A chat over your whole journal, not just one entry:**
- Beyond the per-session chat, this lets you ask questions across your entire history — e.g. *"how many of my Skip calls this month would've been winners?"* A version of this already exists on the Insights page today (asking questions across all your sessions); this brings the same capability directly into Journal itself.

**Smaller features, new:**
- Once you have 20+ entries, the list collapses to show just the latest 5 by default, so it doesn't become an endless scroll.
- Delete a single entry, or select several and delete them together.
- Go back and edit a logged entry after the fact — correct the entry date, price, or status (e.g. update it from what was planned to what you actually traded, or revise the real SL/target if it changed).

### What we already have to build this on

Most of the outcome-tracking backbone already exists: automatic price snapshots after Skip/Watch decisions, automatic scanning for stop-loss/target hits on Take trades (with manual confirm, never a silent auto-close), and a cross-session chat (currently living on Insights). What's actually new here: the 90-day stale flag, the plan-vs-reality drift detector, bringing the cross-session chat into Journal itself, and the list-management features (collapse, multi-delete, after-the-fact editing).

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
- The long-term "personal fingerprint" (point 9 above) is only as good as the honesty of the tagging behind every session. Consistent, fact-grounded critique tags across 200 sessions become a genuinely sharp profile; loosely-graded, inconsistent tags become confident-sounding noise, and there's no cheap way to tell the difference until a lot of sessions have already piled up. This is a reason to hold the fact-grounding and tagging quality to a high bar from the very first session, even though the payoff (the fingerprint) only shows up much later.

---

## What success looks like

- You open Analyse, describe your strategy once, and the questions genuinely feel tailored to how you think — not a generic checklist repeated for everyone.
- Whenever Wick disagrees with your read, it always shows you the real number behind the disagreement — never just an opinion, and never before letting you make your case first.
- A correct answer isn't the end of the conversation — you come away from a session having had to explain *why*, not just having been told you were right.
- Dashboard tells you in one glance whether your trading is actually working, without needing to interpret six different stats.

---

## Phasing

- **Phase 1 (detailed above):** Dashboard scoreboard (win rate + weighted avg P&L), the new Analyse flow (live chart, one-line strategy intake, adaptive fact-grounded questioning that probes reasoning rather than just checking answers, a fact-anchored challenge/defense loop, trade-plan check, and a coaching-style end-of-session report card), and the Journal refinements (stale-trade flag, plan-vs-reality drift detection, journal-wide chat, and the list-management features).
- **Phase 2 (detailed below):** a strategy backtesting engine, plus — further out still — a long-term personal trading-pattern profile built from many mentor sessions over time.

---

## Phase 2 — Strategic Backtesting

### The problem this solves

Today, if you tell Wick "I trade based on RSI and MACD," the mentor (Phase 1) can ask you about it and check that your *reading* of the numbers is correct. But it can't tell you whether that combination, at those specific thresholds, has actually led to good trades in the past. Backtesting answers a different question: *"would this exact rule have worked, historically, on this specific stock?"* It's evidence the mentor can cite — not a replacement for the mentor.

### How it will work, step by step

1. **You define your strategy as precise rules** — nothing a computer has to interpret loosely. For example: *"Buy when the 20-day average crosses above the 50-day average, RSI is below 60, and volume is above the 20-day average. Sell when price closes below the 20-day average, or hits a 2% stop loss, or a 5% target."*
2. **The system pulls years of real daily price history** for that specific stock (e.g. Titan) from our existing market data subscription — the same one already powering the live charts.
3. **It replays that history one day at a time**, exactly as a trader would have lived through it — at each point it only knows what's happened up to that day, never what comes next. When your rule's conditions are met, it "buys" at the next day's opening price, the same way a real order would actually fill. This is what keeps the test honest instead of accidentally letting the strategy peek into the future.
4. **It behaves like a real trading account** — a starting cash balance, position sizes based on how much risk you're willing to take per trade, and real trading costs (brokerage, taxes, slippage) deducted on every trade. No frictionless fantasy numbers.
5. **Every trade gets logged** — entry, exit, profit or loss, how long it was held, and why it closed.
6. **At the end, it produces real statistics** — win rate, average win vs. average loss, total return, and importantly, how bad the worst losing stretch was, not just the headline number. A strategy that made money by taking huge risks should look different from one that made the same money safely.

### Why it's designed this way, in plain terms

Most home-built backtests cheat without realizing it: they let a strategy "see the future" by accident, they ignore real trading costs, or they only test on stocks that are still around today, which quietly flatters the results (a stock that went bankrupt and got delisted never shows up to drag the numbers down). This version is built to avoid those traps from day one, even when that means the numbers look less impressive than a naive version would show. An honest 45% win rate is worth more than a flattering 70% that's secretly cheating.

### What this version deliberately does not do (yet)

- It won't test options or futures strategies — regular stock buy/sell only, to start.
- It won't automatically try hundreds of variations of your rule to find the "best" numbers. That kind of auto-tuning is a genuinely risky feature to add casually — a strategy can be tuned until it looks perfect on old data purely by chance, then fail immediately in real trading. We'd add this later, with real safeguards, not as a first version.
- It won't yet break results down separately for bull markets vs. bear markets vs. sideways markets, the way professional funds do. That's a valuable refinement, but it comes after the core engine's numbers are trusted, not before.

### Known limitations, stated upfront rather than discovered later

- Our market data only goes back to 2020 and only covers stocks currently listed — so a rare setup might only have a handful of past examples to learn from. We'll always show that count next to the result (e.g. "14 instances") rather than hiding a small sample behind a clean-looking percentage.
- Stock splits, bonus shares, and dividends need to be handled correctly, or a plain stock split could look like a 50% overnight crash in the raw data. This has to be solved before any backtest number can be trusted — it's a data-correctness problem, not a nice-to-have.
- A backtest on one stock, by itself, only tells you about that one stock's past — it doesn't prove the strategy is generally sound. Testing across many stocks and market conditions is a further refinement, not part of this first version.

### How this connects back to the mentor

This isn't a separate tool bolted onto the side — it's a new source of evidence the mentor can eventually draw on. Once your strategy is stated clearly enough to test, Wick can move from *"your reasoning checks out"* to *"and historically, a setup like this has worked about 40% of the time over the last 14 instances on this stock"* — turning the backtester into supporting evidence for coaching, rather than a separate report you have to go interpret on your own.

### Further out still: the personal trading-pattern profile

Beyond both of these, there's a longer-term idea worth keeping on the roadmap: once enough mentor sessions have piled up, Wick could start noticing patterns in *how you personally* trade — not just whether a strategy works, but things like "you tend to enter a day early" or "you do well in trending markets but struggle in sideways ones." That needs a large volume of sessions to say anything reliable, so it's intentionally placed after both Phase 1 and the backtesting engine, not alongside them.
