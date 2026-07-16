# Wick Redesign — Dashboard, Analyse, Journal, Insights, Learn, Signals & Dummy Trade Execution (PRD)

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

**Failure-cause notes — new:**
- When you close out an entry, there should be a place to note *why* it played out the way it did — specifically, whether a loss happened because the setup itself was wrong, or because something external hit it: a sudden macro move, a sector-wide shock, a volatility spike that had nothing to do with the quality of your read. This should stay editable after the fact — you often don't know at close time whether it was a genuine shock, and want to update the note once it's clear.
- The point isn't journaling color, it's data intelligence: this should feed forward so a pattern's performance in Insights doesn't get unfairly blamed for a loss that was actually caused by the environment rather than a flaw in the setup or your read.
- Worth flagging: there's already a more detailed design for almost exactly this sitting in the backlog (`docs/feature-backlog/journal-phase2.md`, "Macro & Sector Context" feature — marked design-finalized, not yet built) — free-text macro and sector notes captured at the outcome-review moment, with the AI extracting structured tags (`risk_off`, `sector_rotation`, `policy_shock`, etc.) and a sentiment read, feeding exactly this kind of "do your setups hold up in risk-off environments?" view. That design should be merged into this addition rather than rebuilt — it's the same idea, already thought through in more depth.

**A chat over your whole journal, not just one entry:**
- Beyond the per-session chat, this lets you ask questions across your entire history — e.g. *"how many of my Skip calls this month would've been winners?"* A version of this already exists on the Insights page today (asking questions across all your sessions); this brings the same capability directly into Journal itself.

**Smaller features, new:**
- Once you have 20+ entries, the list collapses to show just the latest 5 by default, so it doesn't become an endless scroll.
- Delete a single entry, or select several and delete them together.
- Go back and edit a logged entry after the fact — correct the entry date, price, or status (e.g. update it from what was planned to what you actually traded, or revise the real SL/target if it changed).

### What we already have to build this on

Most of the outcome-tracking backbone already exists: automatic price snapshots after Skip/Watch decisions, automatic scanning for stop-loss/target hits on Take trades (with manual confirm, never a silent auto-close), and a cross-session chat (currently living on Insights). What's actually new here: the 90-day stale flag, the plan-vs-reality drift detector, the failure-cause notes (with a fuller version of this already designed in the `journal-phase2.md` backlog doc), bringing the cross-session chat into Journal itself, and the list-management features (collapse, multi-delete, after-the-fact editing).

---

## Page 4 — Insights: the diagnostic layer beneath the scoreboard

**Purpose:** Insights has one job — tell you what's pulling your win rate and weighted P&L down. Dashboard tells you the score is bad; Insights tells you why. It's purely retrospective: it explains what happened, never what to do next.

### What Insights does NOT do

- Recommend trades or setups.
- Replace the per-session chat in Analyse.
- Give generic trading advice — every insight here is grounded in your own journal data.
- Look forward. Nothing on this page tells you what to trade. Everything on it tells you what to fix.

### Section 1 — Scoreboard anchor

Win Rate and Weighted Average P&L repeated at the top, identical to Dashboard, so you always know what the diagnostic below is explaining without switching tabs.

### Section 2 — Signal breakdown

Every journal entry carries a session title (e.g. *"Bullish Harami, 2x avg volume"*). Insights aggregates across entries into a per-signal performance table:

| Signal | Win % | Avg P&L | Trades |
|---|---|---|---|
| Bullish Harami (vol confirmed) | 61% | +0.8R | 18 |
| Bearish Engulfing | 34% | −1.2R | 12 |
| Morning Star | 70% | +1.1R | 6 |

Two flags surface automatically:
- **Biggest drag** — the signal with the worst weighted P&L contribution, highlighted as the one costing you the most money.
- **Underused winner** — a signal with a strong win rate and P&L but a low trade count, surfacing whether you're avoiding a setup that actually works for you.

Where the data allows, it also shows whether a setup performs differently volume-confirmed vs. not — this falls out naturally from the session title structure, with no extra tagging required.

**Once Journal's failure-cause notes exist (see Journal section above), "Biggest drag" should account for them.** A pattern that lost mostly to tagged macro/sector shocks reads very differently from one that's just genuinely unreliable — Insights should be able to show that split (e.g. *"6 of 8 losses on this signal were tagged as macro-shock, not a setup failure"*) rather than blaming every loss on the setup equally. Without this, the diagnostic can mislead exactly the trader it's meant to help.

### Section 3 — Behavioral drag

Depends on two data points captured at journal close:
- **Exit reason tag** (required, not optional): Stop hit / Target hit / Manual exit — conviction flip / Manual exit — fear or discomfort / Time-based exit.
- **Plan-vs-reality drift** (already part of the Journal design above): cases where you decided Skip/Watch but traded anyway, or where the actual entry, stop, or size deviated significantly from the analysis.

These aggregate into:
- **Manual exit rate on winners** — how often you cut a winner before target, and what that costs in R.
- **Plan override frequency** — how often your actual trade diverged from your analysis verdict, and whether overriding helped or hurt on average.
- **Risk management consistency** — whether position sizing stays within your stated rules or drifts session to session.

Shown as simple numbers and short trend lines — the pattern should be visible without a paragraph explaining it.

### Section 4 — Technical accuracy trends

Fed by the report-card tags from each Analyse session (observed well / missed / assumed / ignored / overlooked / confused). Aggregated over time into:
- Which skills are consistently strong (e.g. trend identification).
- Which skills are consistently weak (e.g. volume confirmation before calling a breakout).
- Which skills are improving vs. plateauing.

This is the accuracy-in-reading dimension, grounded in real mentor-session data rather than self-assessment — but it only becomes meaningful after roughly 10–15 Analyse sessions, so a placeholder message should show until that threshold is crossed.

### Section 5 — Recency flag

Compares your last 14 days against your all-time baseline. If win rate or weighted P&L has dropped past a meaningful threshold (suggested: 10 percentage points on win rate, or 0.3R on weighted P&L), a flag surfaces at the top of the page — passive, not pushed as a notification. This distinguishes a recent regression from a long-standing pattern, which changes how you should respond to it.

### Section 6 — Insights chat

A persistent chat anchored to your full journal history, at the bottom of the page. Distinct from the per-entry chat in Journal — this one spans the entire record: *"Which setups have I been most consistent on in the last 60 days?"*, *"How many of my manual exits on winning trades happened in the first hour of the session?"*, *"Is my performance better on trending days vs. sideways markets?"*

It has no access to external market data or generic trading knowledge in this context — strictly your own journal, which keeps it diagnostic rather than advisory. The structured sections above answer known diagnostic questions; the chat answers the ones you think of yourself, which are often more specific and more useful than anything a fixed template anticipates. Both are needed.

### What this depends on (data requirements)

Three things need to be true at the journal-entry level for this page to work:
- **Session title always set** — part of the Journal design above.
- **Exit reason captured on close** — a required field, not optional. Without it, Section 3 degrades significantly, so it should be enforced as a required close field rather than a nice-to-have.
- **Analyse report-card tags written to the journal record** — the link between Analyse and Journal that needs to be confirmed as part of the data model, since Section 4 has nothing to aggregate without it.

### What we already have to build this on

Worth being direct about: none of the three fields above exist in the app's data model today — session title, the exit-reason tag, and report-card tags are all new fields the journal-entry schema needs to add. The aggregation logic itself (grouping by signal, computing win rate/avg P&L per group, the recency comparison) is straightforward once those fields exist. The cross-session chat pattern is already proven, though — Insights already has a version of it today, just narrower in scope (general pattern questions) than what's described here (drift, exit behavior, recency).

---

## Page 5 — Learn: a tailored application engine, not a content platform

### Learning philosophy

Learn is not a content platform — it's a tailored application engine. Three principles govern every design decision here:

1. **The plan is the product.** Learn starts with a diagnosis drawn from Insights and Journal data, and generates a personal learning plan — what to work on, in what order, and why. A trader who opens Learn should never have to decide what to study next. The system already knows.
2. **For concepts, point to the gold standard — never recreate it.** Existing resources on technical analysis are excellent — Varsity is thorough, Bulkowski is rigorous. There's no value in Wick rewriting explanations that already exist at high quality. When a trader needs to understand a concept, Wick tells them exactly what to read or watch — the specific chapter, the specific video, the specific timestamp. Curation is a pointer, not a content system.
3. **Learning is application, not consumption.** Reading a Varsity chapter or watching a video is input, not learning. Learning happens when the trader applies the concept on a chart, gets it wrong, understands why, and tries again. The drill is where learning happens. Every other element in this module exists only to set up the next drill.

Together, these define the sequence: **Insights-driven plan → minimum concept pointer → immediate application drill → coached on errors → plan updates.** The intelligence is in the plan and the coaching, not in the content.

### What's already built today

The core drill engine exists and is in use. Documented accurately here so new additions build on top of it, not alongside it.

**The drill session** — 10 synthetic charts, one at a time, in a fixed mix: 3 clean (textbook-clear setups), 3 ambiguous (a real pattern with a deliberate flaw — bad volume, wrong support/resistance, a slightly off candle), 2 multi-concept (nothing decisive alone — trend, volume, and levels have to be weighed together), 2 no-setup (correct call is to pass). Charts are entirely synthetic — generated candle-by-candle with a known ground truth baked in. Deliberate: it gives precise control over how clean or flawed each example is. It also means Learn today has no dependency on real market data, unlike where Analyse is headed.

**Per chart:** state whether a setup is present (Yes/No/Weak), pick the pattern if one is called, state confidence (Low/Medium/High), optionally write a reasoning note. No feedback between charts — scoring is silent, straight to the next chart, preventing anchoring on an early correct call.

**End-of-session results:** three scores — Detection (setup present or not), Classification (named the right pattern), Calibration (appropriately confident, or high-confidence-and-wrong) — plus one AI-written coaching paragraph looking across all 10 calls and the trader's notes together, and a chart-by-chart correct/missed review list.

**"Learn a topic"** (existing, on-demand): the trader declares what they read or watched about today, picks a pattern from a list, and starts a focused drill on just that pattern immediately — no plan, no preamble.

**Nudges:** a background job scans performance data and surfaces proactive suggestions on the Learn home screen (e.g. *"your detection rate on Bullish Harami is 45%, below the 60% bar — worth a focused drill"*). Start it or dismiss it.

**What all of this feeds:** every session writes pattern-level performance (detection rate, false-positive rate, calibration by pattern) back to Insights. A journal bridge checks whether patterns drilled well in Learn actually show up correctly in real Journal decisions — closing the loop between synthetic practice and live trading.

### The three entry points — Learn home screen

The home screen presents three distinct modes. The system's recommendation is always surfaced first, but the trader chooses which to enter and can override the recommendation at any point.

```
LEARN HOME
│
├── 1. YOUR PLAN        (system-generated from Insights + Learn data)
│         Remediation track + Advancement track
│         Trader follows, overrides, or defers
│
├── 2. DRILL NOW        (existing "Learn a topic" flow, unchanged)
│         Pick a pattern from the library → immediate drill
│         No plan, no preamble
│
└── 3. EXPLORE A TOPIC  (new)
          Type any topic → structured plan generated
          → gold standard pointers → then drill
```

#### Entry point 1 — Your Plan

A system-generated personal learning plan, updated continuously from two sources: Insights (which signals are dragging win rate and weighted P&L) and Learn (detection rate, calibration score, false-positive rate per pattern). The plan is always ready when the trader opens Learn — never generated, requested, or configured on demand. It's simply there.

**Two tracks:**
- **Remediation** — targets the patterns where the trader is weakest by detection rate or P&L drag. Triggers below a 60% detection rate on a pattern, or when that pattern appears in the Insights signal breakdown as a meaningful P&L drag. Uses clean and ambiguous chart types — build reliable recognition before adding noise.
- **Advancement** — targets patterns where the trader is already strong and pushes them into harder contexts. Triggers at a detection rate consistently above 80% on clean charts, routing into ambiguous and multi-concept sessions — build robustness, not just recognition. Most learning systems only remediate; this track is what makes the plan a growth engine, not just a gap-filler.

**How it's presented:** what the system recommends this session and why (one sentence grounded in the trader's own data, never generic advice), which track it falls under, what to read or watch first if a pointer exists, and the option to follow it, pick a different pattern from the plan, or switch to Drill Now. The trader is never forced to follow the plan — but it's always the default, the path of least resistance.

**How it updates:** after every drill session, performance writes back and the plan re-evaluates — a pattern crossing 80% moves from remediation to advancement; a pattern where calibration deteriorates can re-enter remediation even if detection is strong. A live document, not a fixed curriculum.

#### Entry point 2 — Drill Now

The existing "Learn a topic" flow, unchanged. Pick a pattern, start a focused drill immediately — no system recommendation, no preamble, no content pointer. This exists because a trader who just read about Morning Star wants to drill Morning Star right now, not follow the plan — respecting that intent is correct. The plan handles the default; Drill Now handles the override. Performance from these sessions writes back to the same store as planned sessions — it counts toward detection rate, calibration, and the journal bridge regardless of entry point.

#### Entry point 3 — Explore a Topic (new)

The trader types any topic they want to learn — a pattern not yet in their history, a concept from a book or video, a technique they want to understand. The system generates a structured plan for it and points to the best existing resources, then routes into a drill. This doesn't replace the plan — it extends Learn beyond the 33-pattern library into territory the trader initiates themselves. Self-directed, but structured rather than freeform.

**Step 1 — Scope check.** Before generating anything, check whether the topic is in scope: technical analysis, chart reading, candlestick patterns, price action, volume analysis, trading psychology directly tied to chart-reading decisions. Outside that (fundamental analysis, options Greeks, portfolio allocation, macroeconomics) — Wick says so clearly and explains what it does cover. This keeps Learn from becoming a generic AI tutor.

**Step 2 — Structured plan generation.** The structure is always the same four steps; what changes is the content pointers and chart difficulty mix:

```
Topic: [Ascending Triangle]
─────────────────────────────────────────────
What it is: [one sentence — Wick writes this]
Why it matters: [tied to journal context where possible]

Step 1 — Understand the concept
  → Read:  Varsity Module 2, Chapter X
  → Watch: [specific video title, channel, timestamp]

Step 2 — Recognise it on a clean chart
  → Drill: 10 charts, clean examples only

Step 3 — Recognise it with noise
  → Drill: 10 charts, ambiguous mix

Step 4 — Apply it in context
  → Drill: multi-concept charts where this pattern
            is one signal among several
```

**Step 3 — Gold standard content pointers.** For every topic, point to the best existing resource rather than generating an explanation. Quality hierarchy: Zerodha Varsity first, Bulkowski's reference data for pattern statistics, CMT curriculum materials for what Varsity doesn't cover, curated videos at specific timestamps (never just a channel). For the existing 33-pattern library, the pointer comes from a pre-curated lookup table built manually — one resource per pattern, chosen once, reused every time. For topics outside the library, the system identifies the best available resource from the same hierarchy at query time. Either way, Wick never writes a generic explanation when a better one already exists.

**Step 4 — Drill routing.** Once the trader has consumed the pointed resource and returns, the drill starts at Step 2 (clean charts). Progress through Steps 3 and 4 is tracked — the trader can leave and return across sessions without losing their place.

**A build constraint worth stating explicitly:** synthetic chart generation for a brand-new topic requires manual setup — someone has to define the ground truth of what a correct example looks like before the system can generate and score it. For topics outside the existing 33-pattern library, the drill in Steps 2–4 uses **real historical chart examples (sourced from the existing Groww market data)** instead of synthetic charts. Less controlled than the synthetic approach, but viable — and the system flags this distinction to the trader rather than hiding it. New topics can graduate to full synthetic drill support over time as chart sets get built; Explore is how new patterns enter the library.

### The full learning loop

The same underlying loop runs across all three entry points — stated explicitly because the loop *is* the product. Each element is simple; the compounding effect across many sessions is what makes Learn valuable.

```
Insights identifies gap (signal drag or low detection rate)
         ↓
Plan generator prescribes: pattern + track (remediate or advance)
         ↓
Wick points to gold standard resource
  ("Read this chapter. Watch this video at this timestamp.")
         ↓
Trader consumes the resource independently
  (Wick is not involved here — this is on the trader)
         ↓
Trader returns and starts the drill
         ↓
Drill runs — chart type difficulty matched to the track
         ↓
Socratic coaching on errors
  (not a monologue paragraph — a conversation)
         ↓
Performance written back to Insights and plan
         ↓
Plan updates based on new data → loop repeats
```

### Making it interactive — drill mode variations

The standard 10-chart drill stays the primary mode. Four variations extend it without changing the underlying format — keeping sessions from feeling repetitive across many weeks, while training different angles of the same perceptual skill.

| Mode | What it trains | How it differs from standard drill | Phase |
|---|---|---|---|
| Standard drill | Recognition and classification | Baseline — 10 synthetic charts, fixed mix, silent scoring | Live today |
| Prediction before reveal | Setup-to-outcome connection | Chart shown up to a point, next 5 candles hidden. Trader calls the setup and predicts direction. Candles then revealed — real historical data, real outcome. | Phase 1 addition |
| Error correction | Catching your own mistakes | Chart shown with a wrong annotation already placed. Trader identifies what's wrong with the call, not what the correct call is. | Phase 1 addition |
| Confidence under pressure | Calibration under time constraint | Same drill format, 20 seconds per chart. Tests whether calibration holds under conditions closer to real trading. | Phase 2 |

### Coaching — conversation, not paragraph

Today's end-of-session coaching is a single AI-written paragraph — the one place in Learn still a monologue. The change: that paragraph becomes the opening move of a short conversation. After it surfaces, Wick asks one specific follow-up grounded in an error from that session — e.g. *"You were high-confidence on Chart 4 but missed the volume context entirely. What were you looking at when you made that call?"* The trader answers; Wick responds to their actual reasoning, not a generic template. Same Socratic principle governing Analyse — Wick only pushes back with something concrete, never a rhetorical "are you sure?" The exchange ends after one or two turns — a closing reflection, not a tutoring session.

### The gold standard pointer layer — how it gets built

The one upfront content effort required before Learn can fully deliver on its promise — a one-time manual curation task, not an ongoing content operation.

**What needs to be built:** for each of the 33 existing patterns, someone identifies the single best Varsity chapter/section, the single best video (specific title, channel, timestamp), and optionally one Bulkowski reference for the statistically-minded trader. The output is a lookup table — pattern name → 2–3 resource pointers — living as a static reference. When the plan or Explore flow prescribes a pattern, the pointers are retrieved directly. No AI generation, no search at runtime — just a fast lookup.

**What this is *not*:** not a content management system, not a RAG pipeline or vector search over documents, not an ongoing editorial operation, not Wick writing its own explanations. It's a spreadsheet, promoted to a database table — probably two to three focused days of curation across 33 patterns. The minimum viable content layer that makes "point to the gold standard" real.

**For topics outside the 33-pattern library:** the system identifies the best available resource from the same quality hierarchy at query time rather than pre-curated. Frequently explored topics get promoted into the lookup table over time — Explore is the discovery mechanism for expanding the curated library.

### What this section depends on

| Data requirement | Source | Status | Needed for |
|---|---|---|---|
| Pattern-level detection rate per trader | Learn drill sessions | Live today | Plan generation, nudges |
| Calibration score per pattern | Learn drill sessions | Live today | Plan generation |
| Signal P&L drag per pattern | Insights (from Journal) | Designed — see Insights section above | Remediation track prioritisation |
| Journal bridge — plan vs. real decisions | Journal + Learn | Live today | Loop closure |
| Gold standard pointer lookup table | Manual curation | Not yet built | Entry points 1 and 3 |
| Real historical charts (Groww) | Existing market data subscription | Live — used in Analyse | Prediction-before-reveal drill, Explore topics outside the 33-pattern library |

### What Learn does NOT do

- Generate its own explanations of trading concepts — it points to existing ones.
- Teach fundamentals, options, or anything outside technical analysis and chart reading.
- Replace Analyse — Learn trains perceptual skill on synthetic and historical charts; Analyse is where that skill gets applied on a real stock with real consequences tracked in Journal.
- Make trading decisions or simulate portfolio outcomes.
- Surface the plan without the trader opening Learn — no push notifications, no home-screen alerts outside the module itself.

### What success looks like

- A trader who opens Learn never has to decide what to study — the plan is already there, grounded in their own data.
- When the plan prescribes a concept, the trader is pointed to the one best resource for it — not a list of options, not a Wick-written explanation.
- Every session ends with the trader having applied something, not just read about it.
- The coaching conversation surfaces one specific error and forces the trader to explain their reasoning — not a generic paragraph.
- Patterns drilled well in Learn start showing up correctly in Journal decisions — the journal bridge confirms the loop is working.
- A trader who explores a new topic gets a structured plan for it, not a blank page and a search bar.
- Learn feels like a personal coach who knows exactly what you're weak at — not a course catalogue.

### Learn phasing

**Live today:** standard 10-chart drill (fixed mix), the three scores, end-of-session coaching paragraph + chart-by-chart review, Learn a topic (on-demand), nudges based on detection-rate thresholds, performance data written to Insights, journal bridge.

**Phase 1 additions:** Your Plan (remediation + advancement tracks), Explore a Topic (structured plan generation, gold standard pointers, drill routing), coaching as conversation (replacing the paragraph with a Socratic follow-up exchange), prediction-before-reveal drill mode (real historical data), error-correction drill mode, and the gold standard pointer lookup table (manual curation of 33 patterns).

**Phase 2:** confidence-under-pressure (timed) drill mode; expanded curation — topics beyond the 33-pattern library promoted from Explore into the lookup table; plan personalisation deepens as session volume grows, with advancement thresholds adjusting to individual trader variance rather than fixed percentages.

---

## Page 6 — Signals: your edge, scanned today

### Why Signals exists, and why it's different

Every major trading platform — TradingView, Streak, Chartink, Sensibull — runs the same model: pre-built screener strategies (RSI below 30, golden cross, volume breakout) scan the market and return a list of stocks. The platform's job ends at the list. The trader still has to decide whether they can read the setup, whether they have an edge on it, and whether their skill level supports trading it live. The platform has no opinion on any of that.

Wick's rule for Signals: **don't replicate what others have already mastered.** A new trader's actual problem isn't a shortage of screeners — it's not knowing which strategies to even look for, and the ones they do know may not be ones they can reliably execute yet. Showing a new trader 40 stocks matching a complex screener doesn't help; it overwhelms them and erodes confidence when they inevitably misread half the setups. Signals is built around a different premise: **surface opportunities the trader can actually act on, based on what they know and what they've demonstrated they can read** — then, separately, show them what to learn next to expand that edge over time.

### The two jobs Signals does

```
SIGNALS PAGE
│
├── JOB 1 — YOUR EDGE, SCANNED TODAY
│         Stocks showing your patterns, filtered by your skill,
│         ranked by your historical edge.
│         Primary surface. Daily utility.
│
└── JOB 2 — EXPAND YOUR HORIZON
          Strategies you do not trade yet but could learn next.
          Adjacent to your current edge. Statistically filtered.
          Links directly into Learn.
          Growth layer. Not time-pressured.
```

These are sequenced, not competing. Job 1 is what a trader needs before a session — prominent, at the top. Job 2 is what a trader engages with when thinking about their development, not their next trade — a clearly separated section below.

### Job 1 — Your edge, scanned today

**What it produces:** a ranked list of stocks currently showing *the trader's own* patterns — not the market's best opportunities in aggregate, but the specific setups this trader has traded before, filtered by whether they can actually read them, ranked by how strong their historical edge is on each one. The output isn't "hot stocks today" — it's "your setups in the market today."

**Three layers, run in sequence, each narrowing the result further:**

- **Layer 1 — Pattern match.** Scan NSE for stocks currently showing patterns from the trader's own Journal history — drawn from session titles (e.g. *"Bullish Harami 2x avg volume"*). If a pattern has never appeared in the trader's Journal, it never appears in the scan. Not a generic market screener — it only looks for what this trader has chosen to trade.
- **Layer 2 — Skill gate.** Cross-reference the trader's Learn detection rate per pattern. Below 60% detection, that pattern is suppressed from the output — regardless of how clean the setup looks on the chart. A trader who can't reliably identify a Bearish Engulfing in a controlled drill will misread it live. Not negotiable as a principle, even if the 60% threshold itself gets revisited later (same bar Learn's nudge system already uses).
- **Layer 3 — Edge ranking.** Among patterns that pass Layers 1 and 2, rank by the trader's historical edge — win rate and weighted P&L per pattern, from the Insights signal breakdown. A stock showing the trader's highest-win-rate pattern ranks above one showing a pattern with weak or negative history. Volume confirmation, where present in the session title, is a secondary ranking factor.

**Example output:**

| Stock | Pattern detected | Your win rate | Avg P&L | Skill gate |
|---|---|---|---|---|
| TITAN | Bullish Harami (vol confirmed) | 61% | +0.8R | Clear (74%) |
| INFY | Morning Star | 70% | +1.1R | Clear (81%) |
| HDFC | Bearish Engulfing | 34% | −1.2R | Suppressed (52%) |
| RELIANCE | Bullish Engulfing | 55% | +0.6R | Clear (68%) |

The suppressed row (HDFC) shows greyed out with a stated reason — *"Your detection rate on this pattern is below the threshold — drill it in Learn before trading it live."* Not hidden, just visually distinguished, with the reason stated plainly.

**What happens after a signal surfaces:** Signals surfaces the candidate — it does not say what to do with it. The next step is opening the stock in Analyse: a full mentoring session, defending the read, laying out a trade plan, letting Wick check it against real chart data. Analyse is where the decision gets made; Signals is where the candidate gets found. This separation is deliberate — Signals feeding directly into a trade call would make Wick an advisory service. Feeding into Analyse instead keeps it a mentor: the trader still does the work, Signals just points them at the right charts.

**The cold-start problem — new traders with no history.** Job 1 depends on two things a brand-new trader doesn't have yet: Journal history (Layer 1) and Learn detection rates (Layer 2).
- **No Journal history:** Layer 1 can't run. Shown instead: *"Start logging your sessions in Journal to unlock personalised signals. Until then, explore strategies you might want to learn in the section below."* Job 2 is fully available from day one.
- **Journal exists, no Learn data yet:** Layer 1 runs, Layer 2 is skipped, Layer 3 runs off Insights if available or falls back to chronological order. Shown: *"Your results will sharpen as you complete Learn sessions — the skill gate activates once detection rate data exists."*
- **Both exist:** the full three-layer filter runs as designed.

Degraded but honest — Signals stays useful from the very first Journal entry while being transparent about what isn't personalized yet.

### Job 2 — Expand your horizon

**What it is:** a small, curated view of strategies the trader doesn't currently trade but could learn next — chosen by adjacency to their existing edge, filtered by statistical reliability, linked directly into Learn. Not a catalogue of every strategy — a considered set of specific next steps. The question it answers: *given what you already know and what you're already good at, what should you learn next?*

**Three filters, all required:**
- **Adjacency** — structurally similar to what the trader already trades, not a random addition. E.g. strong on Bullish Harami → Bullish Engulfing is adjacent (same bullish-reversal logic, cleaner structure, larger body); strong on Morning Star → Evening Star is adjacent (same three-candle logic, opposite direction). Adjacent patterns share enough structural DNA that existing perceptual skill transfers — it feels like growth, not a reset.
- **Reliability** — every suggestion is filtered through Bulkowski's historical reliability data (how often the pattern actually leads to the expected outcome across a large sample). Weak historical reliability means no suggestion, regardless of adjacency. Popularity on other platforms is explicitly not a criterion.
- **Skill ceiling** — no complex multi-concept strategies suggested until the trader has demonstrated consistent single-pattern detection above 75% across at least three patterns. The suggestion set scales with demonstrated skill.

**What each suggestion shows:** what the pattern is (one sentence), why it's adjacent to a pattern the trader already trades, its Bulkowski reliability number (not Wick's opinion), and a direct action — *"Start learning this"* — which routes straight into Learn's Explore a Topic with the structured plan pre-generated. The set is intentionally small: two to three patterns at any time, a considered next step, not a menu to browse.

**How Job 2 feeds back into Job 1:** when a trader works a Learn plan for a Job-2-suggested pattern and their detection rate crosses 60%, that pattern becomes eligible for Job 1's skill gate — Signals starts scanning for it live. The full growth loop: Signals identifies an adjacent pattern worth learning → Learn builds the skill → Signals starts surfacing live setups for it → Journal logs the trades → Insights measures the edge → Signals ranks it accordingly. The trader's personal signal universe expands as their skill does.

### Page layout and interaction

A single scrollable page, no tabs — Job 1 always above the fold, Job 2 below:

```
┌─────────────────────────────────────────┐
│  SIGNALS                    [today]      │
├─────────────────────────────────────────┤
│  YOUR SETUPS TODAY                       │
│                                          │
│  INFY     Morning Star      70% · +1.1R  │
│  TITAN    Bullish Harami    61% · +0.8R  │
│  RELIANCE Bull. Engulfing   55% · +0.6R  │
│                                          │
│  ── suppressed ──────────────────────── │
│  HDFC     Bearish Engulfing  [Learn first]│
│                                          │
├─────────────────────────────────────────┤
│  EXPAND YOUR HORIZON                     │
│                                          │
│  Bullish Engulfing                       │
│  Adjacent to your Harami edge            │
│  Bulkowski reliability: 63%              │
│  [Start learning this →]                 │
│                                          │
│  Evening Star                            │
│  Adjacent to your Morning Star edge      │
│  Bulkowski reliability: 72%              │
│  [Start learning this →]                 │
└─────────────────────────────────────────┘
```

Tapping a Job 1 result opens the stock directly in Analyse, pre-loaded with the stock name and the detected pattern noted as context — Signals doesn't pre-fill any analysis, it only opens the right stock and lets the full Analyse flow run. Tapping "Start learning this" in Job 2 routes straight into Learn's Explore a Topic with the pattern pre-populated and the four-step plan generated immediately — no extra input needed.

**Scan freshness:** runs once per day at market open; the page shows the date of the most recent scan. No live intraday refresh in this version — daily chart patterns are the target, and daily data is sufficient for that. Intraday scanning is a later consideration.

### What Signals does NOT do

- Surface pre-built generic screener strategies from a library of popular setups.
- Tell the trader to buy or sell — ever. It surfaces a candidate; Analyse does the work.
- Show setups the trader hasn't demonstrated they can read, without clearly flagging them as suppressed and explaining why.
- Use popularity or trending volume as a ranking criterion — edge quality and the skill gate are the only filters.
- Surface expansion strategies without the Bulkowski reliability filter — adjacency alone is never enough.
- Replace Analyse. A signal is the start of a process, not the end of one.

### What Signals depends on

| Data requirement | Source | Status | Needed for |
|---|---|---|---|
| Session titles (pattern library per trader) | Journal | Live today | Layer 1 pattern match |
| Win rate and weighted P&L per pattern | Insights signal breakdown | Designed — see Insights section above | Layer 3 edge ranking |
| Detection rate per pattern per trader | Learn drill sessions | Live today | Layer 2 skill gate |
| NSE daily chart data | Groww market data subscription | Live — used in Analyse and Learn | Pattern detection scan |
| Candlestick pattern detection logic | Existing codebase | Live today | Identifying patterns in scan results |
| Bulkowski reliability data per pattern | Static reference — manual entry | Not yet built | Job 2 reliability filter |
| Pattern adjacency map | Static reference — manual entry | Not yet built | Job 2 adjacency filter |

**Two static references to build upfront, both one-time efforts, not ongoing operations:**
- **Bulkowski reliability data** — a lookup table mapping each of the 33 existing patterns to its historical directional reliability from Bulkowski's published research. The numbers already exist and don't change. Estimated: about a day.
- **Pattern adjacency map** — a manually defined map of which patterns are structurally adjacent to which others, with the reasoning stated explicitly. Doesn't need to cover every possible adjacency upfront — the 10–15 most common natural progressions is enough to start. Estimated: about half a day.

### What we already have to build this on

Worth being direct here, because this page looks the most different from what exists today of anything in this document: today's Signals is a generic daily scan across the whole tracked stock universe against a fixed 4-point checklist, flagging anything not yet journaled — the same checklist for every trader, no personalization, no skill gate, no edge ranking, no expansion suggestions. Almost everything described above is new *behavior*. What's already real and reusable: the daily scanning job itself, the underlying Groww data feed, the candlestick pattern detection logic (already used in Analyse and Learn), and — once built — Learn's detection rates and Insights' signal breakdown are exactly the two data sources Layers 2 and 3 need. The two static reference tables (Bulkowski reliability, adjacency map) don't exist in any form yet.

### How Signals connects to the rest of Wick

Signals is the output layer of the whole system — every other module feeds into it: Journal provides the pattern library and exit data, Learn provides the skill gate, Insights provides the edge ranking, and Analyse is what the trader does after Signals — the candidate becomes a session. No generic screener knows the trader's skill level; no journaling app scans the market. Wick does both, and the connection between them is what makes Signals genuinely personalized rather than personalized in name only. The trader's signal universe grows as they grow — that's the compounding effect of the whole system working together.

### What success looks like

- A trader opens Signals before a session and sees 3–5 stocks showing setups they can actually read — not a list of 40 generic screener hits.
- A suppressed result is understood, not frustrating — the trader knows exactly why and what to do about it.
- Tapping a signal result goes straight into an already-oriented Analyse session — the trader knows what pattern they're looking at, and the session focuses on whether the read holds up.
- A trader who completes a Learn plan for a horizon suggestion sees that pattern start appearing in Job 1 results within weeks.
- After six months of use, a trader's signal universe is measurably larger than when they started — and every pattern in it is one they can reliably read.
- No trader ever receives a trade recommendation from Signals. Every output is a starting point for their own analysis, never a conclusion.

### Signals phasing

**Phase 1:** Job 1's full three-layer filter (pattern match, skill gate, edge ranking) with the cold-start degraded mode; Job 2's expansion suggestions (adjacency map + Bulkowski reliability filter) linked into Learn's Explore a Topic; suppressed results shown with reason and a Learn link; daily scan cadence at market open; tap-to-Analyse integration; Bulkowski data entered for all 33 patterns; adjacency map defined for the top 15 natural progressions.

**Phase 2:** intraday scan refresh, once Analyse moves to live chart data; volume condition promoted to an explicit scan parameter (not just detected but used as a primary filter, once a trader's own session-title history shows volume-confirmed setups outperform); adjacency map expanded as pattern libraries grow beyond the initial 33; cross-pattern correlation — surfacing cases where two of a trader's patterns appear on the same stock simultaneously, which may historically (in their own Journal) carry higher conviction.

---

## Page 7 — Dummy Trade Execution: the missing middle ground

### What a dummy trade is — and what it is not

A dummy trade in Wick is **not** a paper trade. Paper trading on most platforms means a fake account, fake prices, fake execution, and a fake portfolio that bears no relationship to what would actually have happened in the real market — it builds confidence that doesn't transfer to live trading, because the conditions were never real.

A dummy trade in Wick is different in every material respect:
- It executes at real NSE market prices — the actual opening price on the next trading day after the trade is placed.
- It tracks against real daily price movement, from the same Groww market data subscription already in the app.
- It produces a real rupee P&L — what the trader would have made or lost had real capital been deployed.
- It uses the exact same outcome detection logic that already tracks live trades in Journal — no separate system, no separate rules.

The only thing that isn't real is capital at risk. A dummy trade answers a precise question: *if I had placed this trade exactly as I planned it, on real prices, what would have happened?* That question has a real answer, and Wick computes it.

**What makes it honest:** entry fills at next-day open — never at the analysis-time price, never at the day's low, never at any price the trader could cherry-pick in hindsight. Stop loss and target are locked at the levels defined in the Analyse trade plan and cannot be moved after creation. The system only ever uses price data that would have been available after the trade was placed — no lookahead. There's no broker call and no external order sent anywhere — everything runs inside Wick on the existing Groww OHLC feed.

### Where dummy trades fit in the Wick flow

This fills a real gap between Analyse and Journal. Today, a trader who completes an Analyse session and gets a validated trade plan has exactly two options: trade it live, or do nothing with it. There's no middle ground for someone who wants to test their read without deploying capital — on a new pattern, during a drawdown, or simply because they're not confident enough yet to go live.

```
Signals surfaces a candidate stock
         ↓
Analyse — full mentor session runs
  → trade plan defined: entry level, SL, target, position size
  → Wick validates the plan against real chart data
         ↓
End of Analyse session — trader chooses:
         ↓                          ↓                    ↓
 [Place dummy trade]        [Log as live trade]        [Skip]
         ↓                          ↓
 Dummy trade created         Live trade created
 in Journal                  in Journal
 Tagged: DUMMY               Tagged: LIVE
         ↓                          ↓
 Both tracked identically against real daily price data
 Both use same outcome detection: SL hit / target hit / stale
 Both produce real rupee P&L
 Segmented in Insights — never conflated
```

The choice is made once, at the end of Analyse. There's no separate dummy trade interface, no separate portfolio screen, no separate entry point — **a dummy trade is a Journal entry with a different tag.** The entire product surface already built for live trades handles it, with the tag as the only distinction.

### Who this is for

- **A new trader building confidence on a pattern** — drilled it in Learn, seeing it in Signals, not ready to trade it live. They run Analyse, get the mentor's validation, place a dummy trade. Over 4–6 weeks they accumulate real outcome data on their real reads at real prices. When the dummy win rate is consistent and they understand why the losses happened, going live is an informed decision — confidence from actual outcome data, not a fake portfolio.
- **An experienced trader testing a new setup** — already trades their core patterns live, wants to add an adjacent pattern from Signals' horizon suggestions. Rather than deploying capital immediately on an unfamiliar setup, they run dummy trades on it for a defined period. The transition to live is evidence-based, not impulsive.
- **A trader in drawdown** — live P&L has deteriorated, stepping back to diagnose what went wrong. Dummy trades keep them in the market rhythm — running Analyse, placing trades, tracking outcomes — without the financial and psychological cost of losing more real money while rebuilding read quality.

**What dummy trades are *not* for:**
- Indefinite avoidance of live trading. A nudge after 20+ consecutive dummy trades on a well-performing pattern should prompt: *"Your dummy win rate on this setup is 65% across 20 trades — have you considered going live?"*
- Inflating metrics. Dummy trades are always segmented from live trades and never touch the headline win rate or weighted P&L on Dashboard.
- Replacing Analyse. A dummy trade cannot be placed without a completed Analyse session — the mentor validation step isn't optional. Dummy trades without analysis are guesses, not learning.

### Execution mechanics — how a dummy trade runs

**Step 1 — Trade plan from Analyse.** At the end of any Analyse session that reaches a Take verdict, the trade plan already exists: stock, entry level, stop loss, target, position size, direction. These fields already exist as part of Analyse's trade plan step — dummy trade creation just pulls them directly, no extra input required.

**Step 2 — Entry price determination.** When the trader selects "Place dummy trade," the system records placement time and date, and sets the entry price to the *next trading day's opening price* from the Groww OHLC feed. Example: a trader completes an Analyse session on TITAN Tuesday evening and places a dummy trade — the entry price is TITAN's Wednesday open, the same fill a real market order placed Tuesday close would have gotten. The trader can't enter at the analysis-time price, can't pick a favourable intraday price, and can't backdate the entry. This is the critical honesty mechanism.

**Step 3 — Trade monitoring.** The same background job that already tracks live trades in Journal monitors dummy trades too. Each day, after the OHLC feed updates: did the daily low breach stop loss (SL hit)? Did the daily high reach target (target hit)? Has it been open 90 days with no resolution (stale flag)? If both SL and target are breached the same day (the day's range spans both), the system assumes **SL hit first** — the conservative, worst-case-honest assumption, same as a real order would face.

**Step 4 — Exit and outcome logging.** When an outcome is detected, the dummy trade closes automatically and the Journal entry updates with exit price, exit date, outcome (Win/Loss/Stale), P&L in rupees, P&L in R (multiple of risk taken), and exit reason (Stop hit / Target hit / Stale / Manual close). The trader gets a notification and confirms the outcome (or flags a false alarm if price merely brushed the level) — the same confirmation flow already used for live trades.

**Step 5 — Manual close.** A trader can close a dummy trade manually at any point, selecting an exit reason from the same set used for live trades (conviction flip, fear/discomfort, time-based exit). Manual closes on dummy trades feed Insights' behavioral drag section exactly like live trades do — cutting trades early is the same behavioral pattern whether or not real money was on the line, so it's tracked identically.

### How dummy trades appear in Journal

A dummy trade creates a Journal entry structurally identical to a live one — same fields, same outcome tracking, same exit reason tag, same post-trade review. The only visual distinction is a clear **DUMMY** label on the entry card, shown consistently wherever the entry appears.

**Filtering:** the Journal list gets a filter — all entries, live only, or dummy only. Default view shows everything; dummy entries are visually distinct but never hidden by default. The trader's full record, real and dummy, is their history.

**Editing:** dummy trades follow the same edit/delete rules as live trades — correct the date, price, or status after the fact, delete individual entries. What *cannot* change after creation: stop loss, target, and direction (locked at creation), and entry price (set by the system, never manually overridden).

### How dummy trades appear in Insights

**The foundational rule: dummy trades never affect the headline scoreboard.** Win Rate and Weighted Average P&L on Dashboard reflect live trades only. A trader with 50 dummy trades and 10 live trades has a win rate based on 10 trades, not 60 — the dummy record is valuable data, but it is never presented as live performance.

**A dedicated dummy-performance panel**, separate from the main signal breakdown, shows dummy vs. live side by side per pattern:

| Pattern | Dummy trades | Dummy win % | Dummy avg P&L | Live trades | Live win % | Live avg P&L |
|---|---|---|---|---|---|---|
| Bullish Harami | 14 | 64% | +0.9R | 8 | 62% | +0.8R |
| Morning Star | 6 | 50% | +0.3R | 0 | — | — |
| Bearish Engulfing | 8 | 37% | −0.9R | 2 | 50% | +0.4R |

This side-by-side view is deliberately the most informative format available, because it surfaces two distinct diagnostics:
- **Transfer gap** — patterns where dummy performance is strong but live performance is weak. This is the single most important signal: the trader can read the setup in a low-stakes context, but something breaks under live conditions — behavioral drag, sizing pressure, or emotional exits are the usual culprits.
- **Live-ready signal** — patterns where dummy win rate is consistently above the trader's baseline across 10+ trades — the evidence basis for a "consider going live on this" nudge.

**The live-ready nudge:** when dummy win rate on a pattern crosses a meaningful threshold (suggested: 60%+ across 15+ trades, no deterioration in the last 5), Insights surfaces: *"Your dummy Bullish Harami win rate is 67% across 18 trades. Your read on this setup is consistent. Have you considered placing your next Harami trade live?"* A suggestion, not a directive — dismissible, and it won't repeat for that pattern until the dummy record meaningfully updates.

### How dummy trades connect to Learn and Signals

**Learn:** the journal bridge — which already checks whether patterns drilled well in Learn show up correctly in real Journal decisions — extends to include dummy trades, producing a three-stage trajectory:

```
Learn drill: Bullish Harami detection rate → 74%
         ↓
Dummy trades: Bullish Harami win rate → 64% (18 trades)
         ↓
Live trades: Bullish Harami win rate → 61% (8 trades)
```

This is the most complete picture of skill development Wick can produce. Strong in drills but weak in dummy trades means the perceptual skill is there but contextual reading breaks down on real charts. Strong in dummy trades but weak live means the read is fine and execution psychology is the actual problem. Where the numbers diverge between stages is exactly where coaching should focus.

**Signals:** the skill gate today uses Learn detection rate as its only filter for Job 1. Dummy trade outcomes are a richer signal — they reflect read quality on real charts, not synthetic ones. In this phase, the skill gate stays Learn-detection-only; in Phase 2, dummy trade win rate becomes a secondary input — a pattern with strong Learn detection but poor dummy outcomes could be downweighted in Signals, with the reason surfaced to the trader. The most honest version of a skill gate is one that uses all available evidence, not just drill performance.

### What dummy trade execution does NOT do

- Call any broker API or send an order anywhere outside Wick — everything runs on the existing Groww OHLC feed.
- Simulate intraday price movement. Only daily OHLC is used, so an intraday stop-out within a single day's range is detected at day close, not intraday — a known, stated limitation.
- Allow entry price manipulation. Fill is always next-day open, never a different price the trader selects.
- Allow SL or target to be moved after entry. The plan is locked at creation — adjusting levels afterward would defeat the point of honest outcome tracking.
- Count dummy P&L toward the Dashboard scoreboard. Live and dummy performance are always segmented.
- Allow a dummy trade without a completed Analyse session. Mentor validation is a prerequisite, not optional.
- Enable short selling in this phase — long trades only, consistent with the daily-chart focus of Journal and Analyse. Short dummy trades are a Phase 2 consideration.

### What this depends on

Designed to require **no new infrastructure** — every dependency is already live or already designed elsewhere in this document.

| Requirement | Source | Status | Notes |
|---|---|---|---|
| Daily OHLC price data (NSE) | Groww market data subscription | Live today | Already used in Analyse, Signals, Learn |
| Trade plan fields from Analyse | Analyse session output | Live today | Entry, SL, target, position size already captured |
| Outcome detection scan (daily) | Journal background job | Live today | Already runs for live trades — dummy trades join the same scan |
| Journal entry structure | Journal | Live today | Dummy tag added; every other field identical to a live entry |
| Exit reason tag | Journal close flow | Designed — see Journal section above | Required field for both live and dummy trades |
| Signal breakdown per pattern | Insights | Designed — see Insights section above | Dummy panel sits alongside the existing breakdown |
| Learn journal bridge | Learn module | Live today | Extended to include dummy trade outcomes in the trajectory view |
| Skill gate input (Phase 2) | Signals + dummy trade outcomes | Phase 2 | Dummy win rate as a secondary skill-gate input |

### Known limitations, stated upfront

- **Intraday stop-outs aren't detected.** If a stock gaps through the stop loss intraday and recovers by close, the dummy trade won't be stopped out — a real trade with a broker stop order would have been. This overstates dummy performance in volatile conditions, and it's noted on every dummy trade entry, not buried.
- **Gaps at open aren't handled specially.** If a stock opens well above or below the planned entry, the dummy trade fills at the actual open regardless of distance from plan — the honest behavior, since a real market order would have filled there too.
- **Dividends and corporate actions aren't adjusted** in this phase. A split or bonus issue during an open dummy trade will distort the P&L — the same data-quality issue already flagged in the Signals and backtesting sections.
- **Long trades only** — short dummy trades need additional direction-reversal logic and are deferred.
- **No partial exits** — a dummy trade closes in full at SL, target, or manual exit.

### What success looks like

- A trader not ready to go live on a new pattern can build a real track record on it — real prices, real outcomes, real rupee P&L — before deploying capital.
- The transfer gap between dummy and live performance becomes a visible diagnostic in Insights — the most honest picture available of where execution psychology is breaking down.
- The live-ready nudge gives an evidence-based signal for when to transition a pattern from dummy to live — evidence, not just confidence.
- A trader in drawdown stays in the learning loop without the financial and psychological cost of live losses during a bad stretch.
- No trader ever confuses their dummy win rate with their live trading performance — the segmentation is clear, consistent, and never softened.
- The entire feature runs on infrastructure already in the system — no new data feeds, no broker integrations, no external APIs.

### Dummy trade phasing

**Phase 1:** one-tap dummy trade creation from a validated Analyse trade plan; entry at next-day open from Groww OHLC; SL/target locked at creation; same outcome detection scan as live trades (SL hit, target hit, 90-day stale flag); Journal entry with DUMMY tag; Journal filter (all/live/dummy); manual close with exit reason; dummy performance panel in Insights, segmented from the live scoreboard; the transfer-gap diagnostic; the live-ready nudge; Learn's journal bridge extended to dummy outcomes; long trades only; the intraday stop-out limitation stated clearly on every entry.

**Phase 2:** short dummy trades; dummy win rate as a secondary input to the Signals skill gate; partial-exit simulation; corporate-action adjustment for open dummy trades; upgrading stop detection to intraday resolution, if intraday data is acquired for other features.

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

- **Phase 1 (detailed above):** Dashboard scoreboard (win rate + weighted avg P&L), the new Analyse flow (live chart, one-line strategy intake, adaptive fact-grounded questioning that probes reasoning rather than just checking answers, a fact-anchored challenge/defense loop, trade-plan check, and a coaching-style end-of-session report card), the Journal refinements (stale-trade flag, plan-vs-reality drift detection, failure-cause notes, journal-wide chat, and the list-management features), Insights as the diagnostic layer beneath the scoreboard (signal breakdown, behavioral drag, technical accuracy trends, recency flag, and the journal-wide chat), the Learn additions (Your Plan, Explore a Topic, coaching as conversation, the prediction-before-reveal and error-correction drill modes, and the gold standard pointer lookup table), Signals rebuilt around personal edge (the three-layer filter — pattern match, skill gate, edge ranking — plus the horizon-expansion suggestions feeding into Learn), and Dummy Trade Execution as the middle ground between Analyse and a live trade (real-price, real-P&L paper trading segmented from the live scoreboard, with the transfer-gap diagnostic in Insights and the live-ready nudge) — see each page's section above, and Learn's, Signals', and Dummy Trade's own phasing breakdowns, for the full detail.
- **Phase 2 (detailed below):** a strategy backtesting engine, the confidence-under-pressure drill mode and expanded topic curation in Learn, intraday scanning and volume-based ranking in Signals, short/partial-exit dummy trades and dummy-informed skill gating, plus — further out still — a long-term personal trading-pattern profile built from many mentor sessions over time.

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
