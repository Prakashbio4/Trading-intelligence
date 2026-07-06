'use strict';

// Composition layer — assembles a full chart record from a config:
// 15 lead-in candles + pattern candles (or continued noise). There is no
// simulated "outcome" continuation — every candle here is already
// synthetic, so stitching 5 more fabricated candles on the end and
// presenting them as "what happened" would be answering a fake question
// with a fake answer. `outcome_direction` is still recorded as ground
// truth (a probabilistic label, not a rendered candle) purely as coaching
// context for the end-of-session AI evaluation and Insights.
// Ground truth (pattern_present, pattern_slug, outcome, etc.) lives only in
// the object this returns; routes/learn.js strips it before the client has
// answered.

const { PATTERN_META } = require('./generators');
const { randRange, randomWalkSeries, tradingDates } = require('./candleUtils');

const LEAD_IN = 15;

const TREND_DRIFT = {
  uptrend:   () => randRange(0.15, 0.5),
  downtrend: () => randRange(-0.5, -0.15),
  sideways:  () => randRange(-0.08, 0.08),
};

function pickTrend(requiresTrend) {
  // Continuation chart patterns (triangle, flag/pennant, wedge, rectangle)
  // only make sense inside an existing trend, but can continue either
  // direction — so pick uptrend or downtrend, never sideways.
  if (requiresTrend === 'trending') return Math.random() > 0.5 ? 'uptrend' : 'downtrend';
  if (requiresTrend) return requiresTrend;
  return ['uptrend', 'downtrend', 'sideways'][Math.floor(Math.random() * 3)];
}

// config: { chartType, patternSlug, clarity, volumeCharacter, srProximity, trendContext, flaw }
function generateChart(config) {
  const { chartType, patternSlug } = config;
  const patternPresent = chartType !== 'no_setup' && !!patternSlug;
  const meta = patternPresent ? PATTERN_META[patternSlug] : null;
  const trendContext = config.trendContext || pickTrend(meta?.requiresTrend);

  const basePrice = randRange(80, 600);
  const avgVolume = randRange(200000, 1500000);
  const patternCandleCount = meta ? meta.candleCount : (chartType === 'no_setup' ? Math.floor(randRange(1, 3)) : 2);
  const totalCandles = LEAD_IN + patternCandleCount;
  const dates = tradingDates(totalCandles);

  const leadInDates = dates.slice(0, LEAD_IN);
  const patternDates = dates.slice(LEAD_IN);

  const leadIn = randomWalkSeries({
    count: LEAD_IN, startPrice: basePrice, drift: TREND_DRIFT[trendContext](),
    vol: basePrice * 0.012, startVolume: avgVolume, dates: leadInDates, zone: 'lead_in',
  });
  const priceAtPattern = leadIn[leadIn.length - 1].close;

  let patternCandles, bias, generatedSrLevel;
  if (patternPresent) {
    const result = meta.fn({
      basePrice: priceAtPattern, avgVolume, clarity: config.clarity,
      volumeCharacter: config.volumeCharacter, dates: patternDates, trendContext,
    });
    patternCandles = result.candles;
    bias = result.bias;
    generatedSrLevel = result.srLevel || null;
  } else {
    // No-setup: continue the random walk with no directional intent, no pattern stitched in.
    patternCandles = randomWalkSeries({
      count: patternCandleCount, startPrice: priceAtPattern, drift: TREND_DRIFT.sideways(),
      vol: priceAtPattern * 0.012, startVolume: avgVolume, dates: patternDates, zone: 'pattern',
    });
    bias = 'neutral';
  }

  // Ground-truth label only (no candles) — clean charts reliably follow the
  // pattern's bias, ambiguous charts are a coin flip, no-setup is pure noise.
  const outcomeDirection = sampleOutcomeDirection(chartType, bias);

  const ohlcData = [...leadIn, ...patternCandles];
  const srLevels = buildSrLevels(config.srProximity, priceAtPattern, generatedSrLevel);

  return {
    chartType,
    patternSlug: patternPresent ? patternSlug : null,
    patternPresent,
    clarityLevel: config.clarity,
    trendContext,
    volumeCharacter: config.volumeCharacter,
    srProximity: config.srProximity,
    outcomeDirection,
    ohlcData,
    srLevels,
    volumeData: ohlcData.map(c => ({ date: c.date, volume: c.volume })),
    expectedBias: bias,
  };
}

function sampleOutcomeDirection(chartType, bias) {
  const r = Math.random();
  const other = bias === 'bullish' ? 'bearish' : 'bullish';
  if (bias === 'neutral') {
    return chartType === 'no_setup' ? ['bullish', 'bearish', 'flat'][Math.floor(r * 3)] : (r < 0.5 ? 'bullish' : 'bearish');
  }
  switch (chartType) {
    case 'clean':         return r < 0.8 ? bias : (r < 0.9 ? 'flat' : other);
    case 'ambiguous':      return r < 0.4 ? bias : (r < 0.7 ? 'flat' : other);
    case 'multi_concept':  return r < 0.65 ? bias : (r < 0.85 ? 'flat' : other);
    default:                return ['bullish', 'bearish', 'flat'][Math.floor(r * 3)]; // no_setup
  }
}

function buildSrLevels(proximity, price, generatedLevel) {
  if (generatedLevel) {
    if (proximity === 'extended') {
      // Ambiguous "wrong location" flaw — push the level far from where price actually reacted.
      return [{ price: generatedLevel.price * (generatedLevel.type === 'support' ? 0.85 : 1.15), type: generatedLevel.type }];
    }
    return [{ price: generatedLevel.price, type: generatedLevel.type }];
  }
  if (proximity === 'at_level') {
    const type = Math.random() > 0.5 ? 'support' : 'resistance';
    const offset = type === 'support' ? -1 : 1;
    return [{ price: price * (1 + offset * randRange(0.005, 0.015)), type }];
  }
  if (proximity === 'mid_range') {
    const type = Math.random() > 0.5 ? 'support' : 'resistance';
    const offset = type === 'support' ? -1 : 1;
    return [{ price: price * (1 + offset * randRange(0.04, 0.08)), type }];
  }
  // extended, no generated level to anchor to — level is far away and not relevant
  const type = Math.random() > 0.5 ? 'support' : 'resistance';
  const offset = type === 'support' ? -1 : 1;
  return [{ price: price * (1 + offset * randRange(0.12, 0.2)), type }];
}

module.exports = { generateChart, LEAD_IN };
