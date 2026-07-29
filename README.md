# SIPY Wick

An AI-assisted trading journal built around one idea: **most trading journals are a diary; this one is a feedback loop.**

Instead of just logging trades, SIPY Wick checks every setup against a rules-based pattern library, records what you *thought* would happen, and later auto-verifies it against real market data — so you can measure whether your reads are actually accurate, not just whether a trade made money.

## The problem this solves

Retail trading journals have three blind spots:
1. They're self-reported, so outcomes get logged selectively or rationalized after the fact.
2. They only track trades you *took* — setups you spotted and skipped disappear, so there's no record of missed opportunity.
3. There's no objective check on whether your read of a chart matches what the chart actually did.

SIPY Wick is built to close all three: rule-based analysis at decision time, automatic outcome verification against real OHLC data, and explicit tracking of skipped/missed setups.

## What's built so far

This is a working full-stack app, not a prototype — auth, database, broker integration, scheduled jobs, and four frontend pages are all live.

| Area | What it does |
|---|---|
| **Analyze** | Submit a ticker + your read of the setup. The backend runs it through a 27-pattern candlestick detector (`technicalindicators`) plus support/resistance and stop-loss-distance rules, then an LLM (Claude) layer reviews it — combining rule-based detection with model judgment rather than relying on either alone. |
| **Journal** | Logs each decision (Take / Skip / Watch) with entry/exit dates, quantity, chart images (stored in Supabase Storage), and the OHLC candle window around the trade. Supports a follow-up chat per session to dig into a specific call. |
| **3-eye pattern check** | Every journal session stores three parallel reads: what *you* saw, what the *AI* detected, and what the *raw OHLC/TA-Lib pattern data* actually shows — the core mechanism for catching confirmation bias. |
| **Signals** | Scans your stock universe daily for the same 4-point checklist Analyse applies — recognized candle pattern, aligned prior trend, above-average volume, stop loss near S&R — and flags anything you haven't already journaled, with a mini candlestick chart. |
| **Insights** | Aggregates calibration stats across sessions (agreement rate between your read and the AI's, strongest pattern, biggest gap area, AI accuracy vs. actual outcomes) plus a chat interface over your own history. Unlocks once you have enough sessions (20+) for the stats to be meaningful. |
| **Stock Universe** | Tracks the set of tickers you follow; adding one immediately kicks off an OHLC backfill fetch. |
| **Outcome automation** | A scheduled job (`node-cron`, 4:15 PM IST weekdays) pulls daily OHLC from Groww after market close, then a second job (4:45 PM IST) auto-populates trade/setup outcomes from that data — no manual result entry. A startup check detects if a cron run was missed (e.g. container restart) and catches up automatically. |
| **Auth** | JWT-based session auth, with TOTP support for Groww broker login. |

## Architecture

```
frontend/   React 19 + Vite SPA — Analyse, Journal, Insights, Signals pages
backend/    Node + Express API — auth, analyze, journal, universe routes
            ├── lib/       Groww broker client, 27-pattern detector library, Supabase client
            ├── jobs/      OHLC fetch + outcome auto-population (cron-scheduled)
            └── db/        SQL migrations (Supabase/Postgres)
```

- **Frontend**: React + Vite, deployed on Vercel (`app.sipy.in`)
- **Backend**: Express on Railway
- **Database & storage**: Supabase (Postgres for data, Storage bucket for chart images)
- **Market data**: Groww broker API (TOTP auth, daily OHLC candles)
- **AI**: Anthropic Claude for setup analysis and insights chat

## Data model (5 migrations so far)

1. `002` — stock universe + OHLC records tables
2. `003` — candle-window fields + outcome auto-population support on journal sessions
3. `004` — TA-Lib pattern detections stored per session (enables the 3-eye check)
4. `005` — trade entry/exit dates + quantity on journal sessions

## Roadmap

See `docs/feature-backlog/` for designed-but-not-yet-built features, including:
- **Outcome tracking for Skip/Watch decisions** — currently only partially tracked; extending "what actually happened" capture to every decision type, not just taken trades
- **Macro context logging** — capturing the market environment at decision time alongside the trade
- **Chart pattern detection** — automatic detection of multi-swing chart patterns (Head & Shoulders, ABCD, Dow trend structure), beyond the existing candlestick-only detector
- **Technical rating + Analyzer page** — Chartmill-inspired technical health and setup-quality scores, plus a screener-style page that surfaces candidate setups for any ticker without requiring a chart upload

## Local development

**Backend** (`backend/`)
```
cp .env.example .env   # fill in ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY, JWT_SECRET, GROWW_* credentials
npm install
npm run dev            # http://localhost:3001
```

**Frontend** (`frontend/`)
```
cp .env.example .env   # VITE_API_URL, defaults to localhost:3001
npm install
npm run dev            # http://localhost:5173
```

Required env vars are documented in each package's `.env.example`. Nothing sensitive is committed — `.env` files are gitignored.

**Chart page (TradingView Advanced Charts)**

The Chart tab loads TradingView's Advanced Charts widget from a git submodule at `frontend/public/tradingview/`, pointed at their private `charting_library` repo. It's not vendored into this repo directly since the library isn't redistributable — only the submodule *reference* (a URL + commit SHA) is committed, not the code itself.

You need your own TradingView-granted access to `tradingview/charting_library` to fetch it:

```
git submodule add git@github.com:tradingview/charting_library.git frontend/public/tradingview
git submodule update --init
```

Anyone else cloning this repo (with their own access) runs:

```
git submodule update --init
```

Without the submodule initialized, the Chart tab shows a fallback message instead of failing silently.

**Deploying the Chart page (Vercel)**

Vercel's build container has no access to your local git credentials, so it can't clone the private `tradingview/charting_library` submodule on its own. `frontend/vercel.json` handles this via a custom `installCommand` that authenticates git with a token before running `git submodule update --init`. To enable it:

1. Generate a GitHub personal access token (fine-grained, read-only "Contents" permission, scoped to just `tradingview/charting_library`) on an account TradingView has approved for Advanced Charts access.
2. In the Vercel project's Settings → Environment Variables, add `TRADINGVIEW_GIT_TOKEN` (Production, and Preview if preview deployments should render charts too). Do **not** prefix it `VITE_` — it must stay build-time-only and never ship in the client bundle.
3. In Settings → General, confirm Root Directory is `frontend` and enable "Include source files outside of the Root Directory in the Build Step" — the submodule and `.gitmodules` live at the repo root, one level above `frontend/`.
4. Redeploy.
