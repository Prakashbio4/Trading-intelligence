'use strict';

const supabase = require('../lib/supabase');
const { getPriceAfterDays, getCloseOnDate, getCandlesSince } = require('../lib/priceLookup');

const TAKE_OFFSETS       = [3, 5, 10];  // trend snapshots vs planned_entry
const SKIP_WATCH_OFFSETS = [3, 10, 15]; // no SL forcing an early exit, so a longer read-accuracy window

function calcOutcome(entry, target, sl, price) {
  if (!price || !entry) return {};
  const pct = ((price - entry) / entry) * 100;
  return {
    price,
    pct_vs_entry: Math.round(pct * 100) / 100,
    hit_target:   target != null ? price >= target : null,
    hit_sl:       sl     != null ? price <= sl     : null,
  };
}

// Shared snapshot populator for both decision types — differs only in which
// offsets to check and what counts as the reference "entry" price. Merges
// into the existing outcome_auto rather than replacing it, so a later run
// filling in one offset doesn't wipe out an earlier run's other offsets.
async function populateSnapshots(sessions, offsets, getEntry, getTarget, getSl) {
  let updated = 0;
  for (const s of sessions) {
    const entry = getEntry(s);
    if (entry == null) continue;

    const patch = {};
    const outcomeAuto = { ...(s.outcome_auto ?? {}) };

    for (const offset of offsets) {
      const key = `price_t${offset}`;
      if (s[key] != null) continue;
      const price = await getPriceAfterDays(s.ticker, s.date, offset);
      if (price == null) continue;
      patch[key] = price;
      outcomeAuto[`t${offset}`] = calcOutcome(entry, getTarget?.(s), getSl?.(s), price);
    }

    if (Object.keys(patch).length === 0) continue;
    patch.outcome_auto = outcomeAuto;

    const { error } = await supabase.from('journal_sessions').update(patch).eq('id', s.id);
    if (error) console.error(`[outcomes] Failed to update ${s.id}:`, error.message);
    else updated++;
  }
  return updated;
}

async function populateTakeSnapshots() {
  const { data: sessions, error } = await supabase
    .from('journal_sessions')
    .select('id, ticker, date, planned_entry, planned_target, planned_sl, price_t3, price_t5, price_t10, outcome_auto')
    .eq('decision', 'Take')
    .not('planned_entry', 'is', null)
    .or('price_t3.is.null,price_t5.is.null,price_t10.is.null')
    .order('date', { ascending: false })
    .limit(200);

  if (error) { console.error('[outcomes] Failed to load Take sessions:', error.message); return 0; }
  if (!sessions?.length) return 0;

  return populateSnapshots(
    sessions, TAKE_OFFSETS,
    s => s.planned_entry, s => s.planned_target, s => s.planned_sl,
  );
}

// Skip/Watch: no planned_entry, so the reference price is the close on the
// day the analysis was done — fetched once and cached on reference_close.
// There's no target/SL (nothing was risked), so hit_target/hit_sl stay null;
// this purely measures whether the stock moved, and by how much.
async function populateSkipWatchSnapshots() {
  const { data: sessions, error } = await supabase
    .from('journal_sessions')
    .select('id, ticker, date, reference_close, price_t3, price_t10, price_t15, outcome_auto')
    .in('decision', ['Skip', 'Watch'])
    .or('reference_close.is.null,price_t3.is.null,price_t10.is.null,price_t15.is.null')
    .order('date', { ascending: false })
    .limit(200);

  if (error) { console.error('[outcomes] Failed to load Skip/Watch sessions:', error.message); return 0; }
  if (!sessions?.length) return 0;

  for (const s of sessions) {
    if (s.reference_close != null) continue;
    const close = await getCloseOnDate(s.ticker, s.date);
    if (close == null) continue; // that day's OHLC isn't fetched yet — retry next run

    s.reference_close = close;
    const { error: refErr } = await supabase
      .from('journal_sessions')
      .update({ reference_close: close })
      .eq('id', s.id);
    if (refErr) console.error(`[outcomes] Failed to set reference_close for ${s.id}:`, refErr.message);
  }

  return populateSnapshots(
    sessions.filter(s => s.reference_close != null),
    SKIP_WATCH_OFFSETS,
    s => s.reference_close,
  );
}

// Take: scan every day's high/low since the trade began for a planned_target
// or planned_sl crossing. Never auto-fills actual_entry/actual_exit — just
// flags the crossing so the UI can prompt for manual confirmation. Runs with
// no cutoff, since a trade can resolve well past T+10.
async function scanTakeHitDetection() {
  const { data: sessions, error } = await supabase
    .from('journal_sessions')
    .select('id, ticker, date, trade_entry_date, planned_target, planned_sl, auto_exit_dismissed_at')
    .eq('decision', 'Take')
    .is('actual_exit', null)
    .is('auto_detected_exit', null)
    .or('planned_target.not.is.null,planned_sl.not.is.null');

  if (error) { console.error('[outcomes] Failed to load open Take trades:', error.message); return 0; }
  if (!sessions?.length) return 0;

  let flagged = 0;
  for (const s of sessions) {
    const fromDate = s.trade_entry_date || s.date;
    let candles = await getCandlesSince(s.ticker, fromDate);
    // A previously dismissed crossing (confirmed false positive — e.g. price
    // touched the level but no real order filled) shouldn't be re-flagged;
    // only look at candles after that date for a genuinely new crossing.
    if (s.auto_exit_dismissed_at) {
      candles = candles.filter(c => c.date > s.auto_exit_dismissed_at);
    }
    if (!candles.length) continue;

    let hit = null;
    for (const c of candles) {
      if (s.planned_target != null && c.high >= s.planned_target) {
        hit = { type: 'hit_target', date: c.date, price: s.planned_target };
        break;
      }
      if (s.planned_sl != null && c.low <= s.planned_sl) {
        hit = { type: 'hit_sl', date: c.date, price: s.planned_sl };
        break;
      }
    }
    if (!hit) continue;

    const { error: upErr } = await supabase
      .from('journal_sessions')
      .update({ auto_detected_exit: hit })
      .eq('id', s.id);
    if (upErr) console.error(`[outcomes] Failed to flag ${s.id}:`, upErr.message);
    else {
      flagged++;
      console.log(`[outcomes] ${s.ticker}: ${hit.type} on ${hit.date} — flagged for confirmation`);
    }
  }
  return flagged;
}

async function runPopulateOutcomes() {
  console.log('[outcomes] Starting outcome population...');

  const takeSnapshots      = await populateTakeSnapshots();
  const skipWatchSnapshots = await populateSkipWatchSnapshots();
  const hitsFlagged        = await scanTakeHitDetection();

  console.log(`[outcomes] Done. ${takeSnapshots} Take snapshots, ${skipWatchSnapshots} Skip/Watch snapshots, ${hitsFlagged} hits flagged.`);
}

module.exports = { runPopulateOutcomes };
