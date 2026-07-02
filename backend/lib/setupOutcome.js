'use strict';

const { getPriceAfterDays } = require('./priceLookup');

const OUTCOME_OFFSETS = [3, 5, 10]; // trading days after the pattern's completion date

// Checks the synthetic trade forward at t+3/t+5/t+10 (same offsets and price
// lookup as journal_sessions outcome tracking) and reports whichever of
// target/SL was hit first. Data that hasn't happened yet comes back 'pending'.
async function evaluateOutcome({ symbol, completionDate, levels }) {
  if (!levels) return { outcome: 'no_data', checks: {} };

  const checks = {};
  for (const offset of OUTCOME_OFFSETS) {
    const price = await getPriceAfterDays(symbol, completionDate, offset);
    checks[`t${offset}`] = price == null ? null : {
      price,
      hitTarget: levels.sl < levels.target ? price >= levels.target : price <= levels.target,
      hitSL:     levels.sl < levels.target ? price <= levels.sl     : price >= levels.sl,
    };
  }

  for (const offset of OUTCOME_OFFSETS) {
    const c = checks[`t${offset}`];
    if (!c) continue;
    if (c.hitSL) return { outcome: 'sl_hit', hitAt: offset, checks };
    if (c.hitTarget) return { outcome: 'target_hit', hitAt: offset, checks };
  }
  return { outcome: 'pending', checks };
}

module.exports = { evaluateOutcome, OUTCOME_OFFSETS };
