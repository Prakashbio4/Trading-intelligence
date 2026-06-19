# Journal Phase 2: Outcome Tracking + Macro Context

**Status:** Backlog — design finalized, not yet built  
**Priority:** High  
**Builds on:** Current journal (analysis sessions for Take/Skip/Watch decisions)

---

## Two features in one build

These ship together because they both attach to the same moment — the outcome review. When you come back to a past session to log what actually happened, that's also the natural moment to add what the environment was like when you made the decision.

---

## Feature 1: Outcome Tracking (all decisions — Take, Skip, Watch)

### Problem

The journal currently only captures the decision and the AI analysis. It has no record of what the stock actually did afterward. This means:

- **Taken trades**: you know your P&L, but not whether the setup played out as expected
- **Skip/Watch trades**: completely invisible — you never know if you were right to skip or if you missed a clean move

Two different skills need tracking:
- **Execution accuracy** — did you manage the trade well? (only measurable on Take)
- **Reading accuracy** — did you read the stock correctly? (measurable on all three decisions)

Right now only execution accuracy is partially trackable. Reading accuracy is blind.

### Design

**No separate flow.** An "Add outcome" button appears on every past session card in the journal — Take, Skip, and Watch alike.

#### For TAKE sessions
| Field | Type | Notes |
|-------|------|-------|
| Result | Enum | Hit target / Stopped out / Manually exited / Still open |
| Exit price | Number | Actual exit |
| Exit date | Date | |
| What actually happened | Free text | Plain English — did the pattern play out? what broke the thesis? |

#### For SKIP / WATCH sessions
| Field | Type | Notes |
|-------|------|-------|
| What did the stock do? | Enum | Moved in expected direction / Moved opposite / Stayed flat |
| Approximate move | Free text | e.g. "up 8% in 4 sessions" — no need to be precise |
| Was the Skip/Watch right? | Enum | Yes — right to skip / No — missed a valid move / Too early to tell |
| Notes | Free text | What would have changed your decision? What did you miss? |

**One shared structured field across all decisions:**
- **Setup played out as read? Yes / No / Partially** — this is the reading accuracy score, comparable across Take/Skip/Watch

### What Insights unlocks with this data

- **Reading accuracy rate** — across all sessions, how often did you call the direction correctly regardless of decision
- **False negative rate** — Skips/Watches where the stock moved in your expected direction (expensive hesitations)
- **Watch → never acted pattern** — if most of your Watch calls never become Take calls, Watch is a delayed Skip for you
- **AI vs you on Skip/Watch** — when AI said TAKE and you said Skip, who was right more often? (AI verdict is already stored for every session)
- **Your most expensive hesitations** — ranked by missed move size

### UX notes

- Outcome is always optional — never blocks anything
- Journal shows a subtle indicator on sessions with no outcome after 5+ days: *"5 unresolved sessions from last week"*
- Free text outcome field is interpreted by AI at Insights load time (same lazy-tagging approach as macro context)

---

## Feature 2: Macro & Sector Context

### Problem

Every logged session captures the stock's story — setup, pattern, indicators, decision — but not the environment it was taken in. A flag breakout in a Nifty uptrend with a hot sector behind it is a fundamentally different trade from the same setup in a risk-off, sector-headwind environment. Without context, Insights can only tell you which setups worked, not when and why they worked or failed.

### Design

**Two free-text fields added to the outcome review moment** (same screen as Feature 1 — one natural check-in covers both).

#### Field 1 — Macro context
> What was happening in the broader market when you made this decision?
> Write freely — index trend, global events, FII activity, policy news, anything that felt relevant.

#### Field 2 — Sector context
> What was the sector doing? Any sector-specific news, rotation, or sentiment?

**Why free text beats dropdowns:**
A dropdown says `Geopolitical: Yes`. Free text captures nuance no enum can:
- *"Iran war was expected to end but didn't — spiked oil, equities sold off"* (expectation reversal, not just geopolitical risk)
- *"US announced pharma import tariffs — hit sentiment even for domestic-only players"* (sector-specific policy shock with spillover)
- *"Pre-budget week — low volume, most traders sitting on hands"* (liquidity/event proximity)

### AI tagging (lazy, at Insights load time)

For each free-text note the AI extracts and caches:

| Field | Type | Examples |
|-------|------|---------|
| `macro_tags` | array | `geopolitical_risk`, `policy_shock`, `expectation_reversal`, `risk_off`, `event_proximity` |
| `macro_sentiment` | enum | `Tailwind / Headwind / Neutral / Mixed` |
| `sector_tags` | array | `tariff_impact`, `sector_rotation`, `hot_sector`, `sector_cooldown` |
| `sector_sentiment` | enum | `Tailwind / Headwind / Neutral / Mixed` |

Tags are cached after first processing — not re-run on every Insights load.

### What Insights unlocks with this data

- **Setup × Macro**: Do your flag breakouts hold in risk-off environments?
- **Sector momentum**: Win rate in hot sectors vs cold or rotating sectors
- **Event proximity**: How much do pre-event or surprise-event sessions hurt your accuracy?
- **Expectation reversal events**: Do you have a pattern of trading into catalyst disappointments?
- **FII activity correlation**: Do your wins cluster when FIIs are net buyers?

---

## Combined UX flow (how both features ship together)

The "Add outcome" button opens a single panel with three sections:

```
OUTCOME
  [ What happened? — Result / Exit fields for Take, direction fields for Skip/Watch ]
  [ Setup played out as read? Yes / No / Partially ]

MARKET CONTEXT AT DECISION TIME
  [ What was the broader market doing? — free text ]
  [ What was the sector doing? — free text ]

[ Save outcome ]
```

One check-in, covers both. Natural moment: you revisit a session a few days later when the stock has moved.

---

## Data model additions

```sql
-- On trade_sessions table (or a joined outcome table)

-- Outcome (Take)
outcome_result        VARCHAR     -- 'hit_target' | 'stopped_out' | 'manual_exit' | 'open'
outcome_exit_price    DECIMAL
outcome_exit_date     DATE
outcome_notes         TEXT

-- Outcome (Skip/Watch)
outcome_direction     VARCHAR     -- 'as_expected' | 'opposite' | 'flat'
outcome_move_desc     TEXT        -- free text: "up 8% in 4 sessions"
outcome_decision_correct VARCHAR  -- 'yes' | 'no' | 'too_early'
outcome_notes         TEXT        -- shared with Take

-- Shared reading accuracy field
setup_played_out      VARCHAR     -- 'yes' | 'no' | 'partially'

-- Macro context
macro_note            TEXT
sector_note           TEXT
macro_tags            JSONB       -- AI-extracted, cached
macro_sentiment       VARCHAR
sector_tags           JSONB
sector_sentiment      VARCHAR
context_tagged_at     TIMESTAMP
```

All fields nullable and additive — existing sessions unaffected.

---

## Build order

1. Add outcome panel UI to journal session cards (Take variant first, then Skip/Watch)
2. Add macro + sector free-text fields to the same panel
3. Wire up DB schema additions
4. Backend endpoint to save outcome + context
5. AI tagging function for macro/sector notes
6. Hook tagging into Insights page load
7. Add reading accuracy and correlation cards to Insights

---

## Open questions

- Should outcome be editable after saving? (Probably yes — "still open" needs to update later)
- Minimum session count before Insights shows correlation cards? Suggested: 10 outcomes logged
- Should the journal nudge show per-week or total unresolved count?
- ~~For Skip/Watch outcomes — do we ask what a hypothetical entry/target would have been, to calculate "missed RRR"?~~ **Decided: No.** If the RRR was good enough, it would have been a Take. Skip/Watch means the setup or RRR wasn't there — a hypothetical calculation adds noise, not signal.
