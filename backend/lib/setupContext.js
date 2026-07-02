'use strict';

// Evaluates whether a TA-Lib-detected candle pattern is backed by the same
// context a trader would require before taking it: an established prior
// trend the pattern is consistent with, above-average volume, and proximity
// to a support/resistance level. Mirrors the rules already encoded in the
// Analyse AI prompt (Dow theory trend, Step 2 prior-trend-vs-bias, Step 3
// volume ≥ 10-day average) so both features agree on what counts.

const TREND_LOOKBACK    = 60;  // trading days used to classify prior trend
const SR_LOOKBACK        = 90;  // trading days used to detect S&R levels
const SWING_K             = 2;   // bars required on each side to confirm a swing point
const SR_TOLERANCE_PCT   = 3;   // "near" a level = within this % of it
const SR_CLUSTER_PCT     = 1.5; // merge swing levels within this % of each other

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

// Dow theory: compare the last two confirmed swing highs and swing lows.
function classifyTrend(candles) {
  if (candles.length < SWING_K * 2 + 3) return { direction: 'Unclear', reason: 'Not enough history' };

  const { highs, lows } = findSwingPoints(candles);
  if (highs.length < 2 || lows.length < 2) return { direction: 'Unclear', reason: 'No clear swing points' };

  const [h2, h1] = highs.slice(-2);
  const [l2, l1] = lows.slice(-2);

  if (h1.price > h2.price && l1.price > l2.price) return { direction: 'Uptrend', reason: 'Higher highs and higher lows' };
  if (h1.price < h2.price && l1.price < l2.price) return { direction: 'Downtrend', reason: 'Lower highs and lower lows' };
  return { direction: 'Sideways', reason: 'Mixed swing structure' };
}

// A bullish reversal needs a prior downtrend, a bearish reversal needs a
// prior uptrend, continuation patterns need the trend they're continuing,
// indecision patterns just need *some* established trend to be meaningful.
function trendMatchesBias(bias, trendDirection) {
  if (bias === 'bullish_reversal')    return trendDirection === 'Downtrend';
  if (bias === 'bearish_reversal')    return trendDirection === 'Uptrend';
  if (bias === 'bullish_continuation') return trendDirection === 'Uptrend';
  if (bias === 'bearish_continuation') return trendDirection === 'Downtrend';
  return trendDirection === 'Uptrend' || trendDirection === 'Downtrend'; // indecision
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

function nearestSRDistancePct(price, candles) {
  const { highs, lows } = findSwingPoints(candles);
  const levels = clusterLevels([...highs, ...lows]);
  if (!levels.length) return null;
  return Math.min(...levels.map(level => Math.abs(price - level) / level * 100));
}

// patternCandle: { close, volume, vol_10day_avg } for the pattern's completion day
// priorCandles: ascending OHLC history strictly before the pattern started
// bias: one of the DETECTORS bias values from lib/patterns.js
function evaluateSetup({ patternCandle, priorCandles, bias }) {
  const trend = classifyTrend(priorCandles.slice(-TREND_LOOKBACK));
  const srDistancePct = nearestSRDistancePct(patternCandle.close, priorCandles.slice(-SR_LOOKBACK));
  const volumeConfirmed = patternCandle.vol_10day_avg
    ? patternCandle.volume >= patternCandle.vol_10day_avg
    : null;
  const volumeRatio = patternCandle.vol_10day_avg
    ? Math.round((patternCandle.volume / patternCandle.vol_10day_avg) * 100) / 100
    : null;
  const nearSR = srDistancePct != null ? srDistancePct <= SR_TOLERANCE_PCT : null;

  return {
    trend: trend.direction,
    trendReason: trend.reason,
    volumeConfirmed,
    volumeRatio,
    srDistancePct: srDistancePct != null ? Math.round(srDistancePct * 100) / 100 : null,
    nearSR,
    qualifies: volumeConfirmed === true && trendMatchesBias(bias, trend.direction) && nearSR === true,
  };
}

module.exports = {
  evaluateSetup,
  classifyTrend,
  findSwingPoints,
  TREND_LOOKBACK,
  SR_LOOKBACK,
};
