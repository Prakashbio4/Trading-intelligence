'use strict';

// Session composer — builds the fixed 10-chart session:
// 3 clean, 3 ambiguous, 2 multi-concept, 2 no-setup. Pattern selection is
// weighted toward `focusPatterns` (nudge-driven gaps or Track 2 concept
// queue) but always fills out the full distribution.

const { PATTERN_META } = require('./generators');
const { generateChart } = require('./composer');

// "Primary" signals are things a trader would actually call a setup on —
// candlestick patterns and multi-candle chart patterns (H&S, triangles,
// etc). Volume/S-R/trend-structure patterns are context signals, not
// standalone setups, so they only fill the one wildcard slot.
const PRIMARY_SLUGS = Object.keys(PATTERN_META).filter(s => ['candlestick', 'chart_pattern'].includes(PATTERN_META[s].category));
const OTHER_SLUGS = Object.keys(PATTERN_META).filter(s => !['candlestick', 'chart_pattern'].includes(PATTERN_META[s].category));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickSlug(pool, focusPatterns, usedCounts) {
  const eligible = pool.filter(s => (usedCounts.get(s) || 0) < 2);
  const candidates = eligible.length ? eligible : pool;
  const focusEligible = focusPatterns?.filter(s => candidates.includes(s)) || [];
  const slug = (focusEligible.length && Math.random() < 0.65)
    ? focusEligible[Math.floor(Math.random() * focusEligible.length)]
    : candidates[Math.floor(Math.random() * candidates.length)];
  usedCounts.set(slug, (usedCounts.get(slug) || 0) + 1);
  return slug;
}

function weightedPick(weights) {
  const r = Math.random();
  let acc = 0;
  for (const [value, weight] of weights) {
    acc += weight;
    if (r < acc) return value;
  }
  return weights[weights.length - 1][0];
}

// Returns a spec (not yet generated) for one chart slot.
function buildSpec(chartType, slugPool, focusPatterns, usedCounts) {
  if (chartType === 'no_setup') {
    return {
      chartType,
      patternSlug: null,
      clarity: 'standard',
      volumeCharacter: weightedPick([['neutral', 0.8], ['confirming', 0.1], ['contradicting', 0.1]]),
      srProximity: weightedPick([['extended', 0.8], ['mid_range', 0.2]]),
    };
  }

  const patternSlug = pickSlug(slugPool, focusPatterns, usedCounts);

  if (chartType === 'clean') {
    return {
      chartType, patternSlug,
      clarity: 'textbook',
      volumeCharacter: weightedPick([['confirming', 0.7], ['neutral', 0.3]]),
      srProximity: weightedPick([['at_level', 0.6], ['mid_range', 0.4]]),
    };
  }

  if (chartType === 'ambiguous') {
    const flaw = weightedPick([
      ['volume_contradiction', 1 / 3], ['wrong_sr_location', 1 / 3], ['aberrant_candle', 1 / 3],
    ]);
    if (flaw === 'volume_contradiction') {
      return { chartType, patternSlug, clarity: 'textbook', volumeCharacter: 'contradicting', srProximity: 'at_level', flaw };
    }
    if (flaw === 'wrong_sr_location') {
      return { chartType, patternSlug, clarity: 'textbook', volumeCharacter: 'confirming', srProximity: 'extended', flaw };
    }
    return { chartType, patternSlug, clarity: 'degraded', volumeCharacter: 'confirming', srProximity: 'at_level', flaw };
  }

  // multi_concept — pattern only meaningful in context; nothing dimension is
  // decisive on its own, forcing the trader to weigh candlestick + volume +
  // S/R + trend together.
  return {
    chartType, patternSlug,
    clarity: 'standard',
    volumeCharacter: weightedPick([['confirming', 0.4], ['neutral', 0.4], ['contradicting', 0.2]]),
    srProximity: weightedPick([['mid_range', 0.6], ['at_level', 0.4]]),
  };
}

// focusPatterns: string[] of pattern slugs to weight toward (nudge gaps / Track 2 queue)
function composeSession({ focusPatterns = [] } = {}) {
  const slotTypes = shuffle(['clean', 'clean', 'clean', 'ambiguous', 'ambiguous', 'ambiguous', 'multi_concept', 'multi_concept', 'no_setup', 'no_setup']);

  // 7 of the 8 pattern-bearing slots use a primary setup (candlestick or
  // chart pattern); 1 wildcard slot draws from volume/S-R/trend context
  // patterns for variety.
  const patternSlotIndexes = slotTypes.map((t, i) => (t !== 'no_setup' ? i : null)).filter(i => i !== null);
  const wildcardIndex = patternSlotIndexes[Math.floor(Math.random() * patternSlotIndexes.length)];

  const usedCounts = new Map();
  const charts = slotTypes.map((chartType, i) => {
    const pool = i === wildcardIndex ? OTHER_SLUGS : PRIMARY_SLUGS;
    const spec = buildSpec(chartType, pool, focusPatterns, usedCounts);
    const chart = generateChart(spec);
    return { ...chart, chartIndex: i };
  });

  return charts;
}

module.exports = { composeSession };
