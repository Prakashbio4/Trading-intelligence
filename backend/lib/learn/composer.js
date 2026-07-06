'use strict';

// Composition layer — assembles a full chart record from a config:
// 15 lead-in candles + pattern candles (or continued noise) + 5 outcome
// candles. Ground truth (pattern_present, pattern_slug, outcome, etc.) lives
// only in the object this returns; routes/learn.js is responsible for
// stripping it before the client has answered.

const { PATTERN_META } = require('./generators');
const { randRange, randomWalkSeries, tradingDates, makeCandle } = require('./candleUtils');

const LEAD_IN = 15;
const OUTCOME = 5;

const TREND_DRIFT = {
  uptrend:   () => randRange(0.15, 0.5),
  downtrend: () => randRange(-0.5, -0.15),
  sideways:  () => randRange(-0.08, 0.08),
};

function pickTrend(requiresTrend) {
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
  const totalCandles = LEAD_IN + patternCandleCount + OUTCOME;
  const dates = tradingDates(totalCandles);

  const leadInDates = dates.slice(0, LEAD_IN);
  const patternDates = dates.slice(LEAD_IN, LEAD_IN + patternCandleCount);
  const outcomeDates = dates.slice(LEAD_IN + patternCandleCount);

  const leadIn = randomWalkSeries({
    count: LEAD_IN, startPrice: basePrice, drift: TREND_DRIFT[trendContext](),
    vol: basePrice * 0.012, startVolume: avgVolume, dates: leadInDates, zone: 'lead_in',
  });
  const priceAtPattern = leadIn[leadIn.length - 1].close;

  let patternCandles, bias, generatedSrLevel;
  if (patternPresent) {
    const result = meta.fn({
      basePrice: priceAtPattern, avgVolume, clarity: config.clarity,
      volumeCharacter: config.volumeCharacter, dates: patternDates,
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
  const priceAfterPattern = patternCandles[patternCandles.length - 1].close;

  // Outcome direction: clean charts follow the pattern's bias strongly,
  // ambiguous charts are weak/mixed, multi-concept depends on context
  // alignment, no-setup charts are pure noise.
  const outcomeDrift = computeOutcomeDrift(chartType, bias, priceAfterPattern);
  const outcome = randomWalkSeries({
    count: OUTCOME, startPrice: priceAfterPattern, drift: outcomeDrift,
    vol: priceAfterPattern * 0.012, startVolume: avgVolume, dates: outcomeDates, zone: 'outcome',
  });
  const outcomeDirection = classifyOutcome(outcome, priceAfterPattern);

  const ohlcData = [...leadIn, ...patternCandles, ...outcome];
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
    visibleThrough: LEAD_IN + patternCandleCount, // index boundary — candles before this are shown pre-answer
  };
}

function computeOutcomeDrift(chartType, bias, price) {
  const magnitude = price * 0.01;
  const sign = bias === 'bearish' ? -1 : bias === 'bullish' ? 1 : 0;
  switch (chartType) {
    case 'clean':         return sign * magnitude * randRange(1.4, 2.2);
    case 'ambiguous':      return sign * magnitude * randRange(-0.3, 0.5); // weak/mixed follow-through
    case 'multi_concept':  return sign * magnitude * randRange(0.4, 1.4);
    default:                return magnitude * randRange(-0.5, 0.5); // no_setup — pure noise
  }
}

function classifyOutcome(outcomeCandles, priceBefore) {
  const priceAfter = outcomeCandles[outcomeCandles.length - 1].close;
  const changePct = (priceAfter - priceBefore) / priceBefore;
  if (changePct > 0.01) return 'bullish';
  if (changePct < -0.01) return 'bearish';
  return 'flat';
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

module.exports = { generateChart, LEAD_IN, OUTCOME };
