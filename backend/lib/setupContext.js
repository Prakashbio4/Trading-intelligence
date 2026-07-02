'use strict';

// Evaluates whether a TA-Lib-detected candle pattern is a real setup, by the
// same 4-point checklist a trader applies: a recognized candle pattern (the
// caller already has this from lib/patterns.js), the 1-3 candles right
// before it contradicting/agreeing with its direction, above-average
// volume, and a stop loss near a support/resistance level. Primary trend,
// RSI, Bollinger Bands and MACD are deliberately out of scope — those stay
// a manual check in Analyse.

const PRIOR_CONTEXT_CANDLES = 3;   // candles checked immediately before the pattern
const VOLUME_LOOKBACK       = 5;   // candles (including the pattern's own day) averaged for volume
const SR_LOOKBACK           = 120; // trading days used to detect S&R levels
const SWING_K                = 2;   // bars required on each side to confirm a swing point
const SR_TOLERANCE_PCT      = 3;   // "near" a level = within this % of it
const SR_CLUSTER_PCT        = 1.5; // merge swing levels within this % of each other

function candleColor(c) {
  if (c.close > c.open) return 'bullish';
  if (c.close < c.open) return 'bearish';
  return 'neutral';
}

// Majority color of a small run of candles — null if there's no clear majority.
function priorColorMajority(candles) {
  let bull = 0, bear = 0;
  for (const c of candles) {
    const color = candleColor(c);
    if (color === 'bullish') bull++;
    else if (color === 'bearish') bear++;
  }
  if (bull > bear) return 'bullish';
  if (bear > bull) return 'bearish';
  return null;
}

// Reversal patterns need the candles right before them to contradict the
// pattern's direction (bullish reversal after a bearish run, and vice
// versa); continuation patterns need them to agree; indecision patterns
// just need some clear prior direction to be indecisive about.
function priorContextMatchesBias(bias, priorMajority) {
  if (bias === 'bullish_reversal')     return priorMajority === 'bearish';
  if (bias === 'bearish_reversal')     return priorMajority === 'bullish';
  if (bias === 'bullish_continuation') return priorMajority === 'bullish';
  if (bias === 'bearish_continuation') return priorMajority === 'bearish';
  return priorMajority != null;
}

// Local extrema: candle i is a swing high/low if it's the highest/lowest
// point within SWING_K candles on either side.
function findSwingPoints(candles) {
  const highs = [];
  const lows = [];
  for (let i = SWING_K; i < candles.length - SWING_K; i++) {
    const window = candles.slice(i - SWING_K, i + SWING_K + 1);
    const h = candles[i].high;
    const l = candles[i].low;
    if (window.every(c => c.high <= h)) highs.push({ date: candles[i].date, price: h });
    if (window.every(c => c.low >= l)) lows.push({ date: candles[i].date, price: l });
  }
  return { highs, lows };
}

// Merge nearby swing levels (highs and lows together) into zones.
function clusterLevels(points) {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p.price - last.avg) / last.avg * 100 <= SR_CLUSTER_PCT) {
      last.prices.push(p.price);
      last.avg = last.prices.reduce((a, b) => a + b, 0) / last.prices.length;
    } else {
      clusters.push({ avg: p.price, prices: [p.price] });
    }
  }
  return clusters.map(c => c.avg);
}

// Nearest confirmed swing level below price (support) and above price (resistance).
function nearestLevels(price, candles) {
  const { highs, lows } = findSwingPoints(candles);
  const levels = clusterLevels([...highs, ...lows]);
  const below = levels.filter(l => l < price);
  const above = levels.filter(l => l > price);
  return {
    support:    below.length ? Math.max(...below) : null,
    resistance: above.length ? Math.min(...above) : null,
  };
}

// bullish patterns look for a long from support, bearish patterns look for a
// short from resistance — indecision patterns have no directional trade.
function directionForBias(bias) {
  if (bias === 'bullish_reversal' || bias === 'bullish_continuation') return 'long';
  if (bias === 'bearish_reversal' || bias === 'bearish_continuation') return 'short';
  return null;
}

// Synthetic entry/SL/target for a setup nobody actually traded: entry at the
// pattern's completion close, SL at the nearest S&R level in the risk
// direction (same level the checklist already confirmed proximity to),
// target set for a 1.5 RRR — the same threshold Analyse requires for TAKE.
function computeTradeLevels({ entry, support, resistance, direction }) {
  if (direction === 'long' && support != null) {
    const risk = entry - support;
    if (risk <= 0) return null;
    return { entry, sl: support, target: Math.round((entry + risk * 1.5) * 100) / 100 };
  }
  if (direction === 'short' && resistance != null) {
    const risk = resistance - entry;
    if (risk <= 0) return null;
    return { entry, sl: resistance, target: Math.round((entry - risk * 1.5) * 100) / 100 };
  }
  return null;
}

// patternCandle: { close, volume } for the pattern's completion day
// volumeCandles: ascending OHLC candles ending at & including the completion day
// priorCandles: ascending OHLC history strictly before the pattern started
// bias: one of the DETECTORS bias values from lib/patterns.js
function evaluateSetup({ patternCandle, volumeCandles, priorCandles, bias }) {
  const priorMajority = priorColorMajority(priorCandles.slice(-PRIOR_CONTEXT_CANDLES));
  const trendContextOk = priorContextMatchesBias(bias, priorMajority);

  const volWindow = volumeCandles.slice(-VOLUME_LOOKBACK);
  const volAvg = volWindow.length ? volWindow.reduce((sum, c) => sum + c.volume, 0) / volWindow.length : null;
  const volumeConfirmed = volAvg ? patternCandle.volume >= volAvg : null;
  const volumeRatio = volAvg ? Math.round((patternCandle.volume / volAvg) * 100) / 100 : null;

  const { support, resistance } = nearestLevels(patternCandle.close, priorCandles.slice(-SR_LOOKBACK));
  const nearestLevel = [support, resistance]
    .filter(l => l != null)
    .sort((a, b) => Math.abs(patternCandle.close - a) - Math.abs(patternCandle.close - b))[0] ?? null;
  const srDistancePct = nearestLevel != null
    ? Math.abs(patternCandle.close - nearestLevel) / nearestLevel * 100
    : null;
  const nearSR = srDistancePct != null ? srDistancePct <= SR_TOLERANCE_PCT : null;

  return {
    priorTrend: priorMajority, // 'bullish' | 'bearish' | null — majority color of the candles right before the pattern
    trendContextOk,
    volumeConfirmed,
    volumeRatio,
    support,
    resistance,
    srDistancePct: srDistancePct != null ? Math.round(srDistancePct * 100) / 100 : null,
    nearSR,
    qualifies: volumeConfirmed === true && trendContextOk && nearSR === true,
  };
}

module.exports = {
  evaluateSetup,
  findSwingPoints,
  directionForBias,
  computeTradeLevels,
  SR_LOOKBACK,
};
