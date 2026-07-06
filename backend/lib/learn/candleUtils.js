'use strict';

// Shared math/formatting primitives for synthetic chart generation.
// Every pattern generator and the composer build candles through these
// helpers so clarity/volume/trend parameters stay consistent everywhere.

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// Approximately-normal noise via sum of uniforms (Irwin-Hall, n=3), centered at 0.
function gaussianNoise(scale = 1) {
  return ((Math.random() + Math.random() + Math.random()) - 1.5) / 1.5 * scale;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Sequential trading-day dates (skips weekends), oldest → newest, ending "today".
function tradingDates(count) {
  const dates = [];
  const d = new Date();
  while (dates.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) dates.unshift(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

function makeCandle({ date, open, high, low, close, volume, zone }) {
  return {
    date,
    open: round2(open),
    high: round2(Math.max(high, open, close)),
    low: round2(Math.min(low, open, close)),
    close: round2(close),
    volume: Math.round(volume),
    zone,
  };
}

// Clarity controls how ideal the candle proportions are:
//   textbook  — proportions match the textbook definition closely
//   standard  — realistic variance, still clearly readable
//   degraded  — borderline proportions, the "one element wrong" ambiguous case
const CLARITY_FACTOR = { textbook: 1, standard: 0.7, degraded: 0.4 };

// A basic random-walk price series used for lead-in candles and outcome
// continuation. `drift` per-candle in price units, `vol` controls range size.
function randomWalkSeries({ count, startPrice, drift = 0, vol, startVolume, dates, zone }) {
  const candles = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const move = drift + gaussianNoise(vol);
    const close = Math.max(open + move, 0.5);
    const wickUp = Math.abs(gaussianNoise(vol * 0.6));
    const wickDown = Math.abs(gaussianNoise(vol * 0.6));
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(Math.min(open, close) - wickDown, 0.1);
    const volume = Math.max(startVolume * randRange(0.6, 1.4), 100);
    candles.push(makeCandle({ date: dates[i], open, high, low, close, volume, zone }));
    price = close;
  }
  return candles;
}

// Applies a volume "character" to a single completing candle relative to
// the trailing average: confirming (spike), contradicting (below average),
// neutral (in line with average).
function volumeForCharacter(character, avgVolume) {
  switch (character) {
    case 'confirming':    return avgVolume * randRange(1.6, 2.4);
    case 'contradicting': return avgVolume * randRange(0.35, 0.6);
    default:               return avgVolume * randRange(0.85, 1.15);
  }
}

// Builds a single candle from body/wick ratios relative to a price range,
// anchored at `refPrice` (the bottom of the body). Shared by every
// single- and multi-candle pattern shape below.
function shapeCandle({ date, refPrice, range, bodyRatio, wickUpRatio, wickDownRatio, bullish, volume, zone }) {
  const body = Math.max(range * bodyRatio, 0.05);
  const wickUp = range * wickUpRatio;
  const wickDown = range * wickDownRatio;
  const open = bullish ? refPrice : refPrice + body;
  const close = bullish ? refPrice + body : refPrice;
  const high = Math.max(open, close) + wickUp;
  const low = Math.max(Math.min(open, close) - wickDown, 0.1);
  return makeCandle({ date, open, high, low, close, volume, zone });
}

function typicalRange(basePrice) {
  return basePrice * randRange(0.015, 0.035);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

module.exports = {
  randRange, randInt, choice, gaussianNoise, round2,
  tradingDates, makeCandle, CLARITY_FACTOR, randomWalkSeries, volumeForCharacter,
  shapeCandle, typicalRange, lerp,
};
