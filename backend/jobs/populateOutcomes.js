'use strict';

const supabase = require('../lib/supabase');
const { getPriceAfterDays } = require('../lib/priceLookup');

const OFFSETS = [3, 5, 10]; // trading days after session date

function calcOutcome(entry, target, sl, price) {
  if (!price || !entry) return {};
  const pct = ((price - entry) / entry) * 100;
  return {
    price,
    pct_vs_entry:  Math.round(pct * 100) / 100,
    hit_target:    target != null ? price >= target : null,
    hit_sl:        sl     != null ? price <= sl     : null,
  };
}

async function runPopulateOutcomes() {
  console.log('[outcomes] Starting outcome population...');

  // Find sessions missing at least one price snapshot, with a planned entry
  const { data: sessions, error } = await supabase
    .from('journal_sessions')
    .select('id, ticker, date, planned_entry, planned_target, planned_sl, price_t3, price_t5, price_t10')
    .not('planned_entry', 'is', null)
    .or('price_t3.is.null,price_t5.is.null,price_t10.is.null')
    .order('date', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[outcomes] Failed to load sessions:', error.message);
    return;
  }

  if (!sessions?.length) {
    console.log('[outcomes] Nothing to update.');
    return;
  }

  let updated = 0;
  for (const s of sessions) {
    const patch = {};
    const outcomeAuto = {};

    for (const offset of OFFSETS) {
      const key = `price_t${offset}`;
      if (s[key] != null) continue; // already populated

      const price = await getPriceAfterDays(s.ticker, s.date, offset);
      if (price == null) continue;

      patch[key] = price;
      outcomeAuto[`t${offset}`] = calcOutcome(s.planned_entry, s.planned_target, s.planned_sl, price);
    }

    if (Object.keys(patch).length === 0) continue;
    patch.outcome_auto = { ...outcomeAuto };

    const { error: upErr } = await supabase
      .from('journal_sessions')
      .update(patch)
      .eq('id', s.id);

    if (upErr) {
      console.error(`[outcomes] Failed to update ${s.id}:`, upErr.message);
    } else {
      updated++;
    }
  }

  console.log(`[outcomes] Done. ${updated} sessions updated.`);
}

module.exports = { runPopulateOutcomes };
