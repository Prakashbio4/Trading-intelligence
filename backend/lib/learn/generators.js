'use strict';

// Pure pattern-shape generators. Each function takes
// { basePrice, avgVolume, clarity, volumeCharacter, dates } and returns
// { candles, bias } where bias is the pattern's expected directional read
// ('bullish' | 'bearish' | 'neutral'). `dates` must have exactly as many
// entries as the pattern's candleCount (see PATTERN_META below).
//
// clarity: 'textbook' | 'standard' | 'degraded' — controls how close the
// candle proportions sit to the ideal definition. `degraded` is what makes
// an "ambiguous" chart ambiguous.

const {
  randRange, gaussianNoise, CLARITY_FACTOR, makeCandle, shapeCandle,
  typicalRange, volumeForCharacter, lerp,
} = require('./candleUtils');

function factorOf(clarity) {
  return CLARITY_FACTOR[clarity] ?? CLARITY_FACTOR.standard;
}

function fillerVolume(avgVolume) {
  return avgVolume * randRange(0.8, 1.2);
}

// ── Single-candle patterns ──────────────────────────────────────────────────

function hammer({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.32, 0.10, f), wickDownRatio: lerp(0.30, 0.85, f), wickUpRatio: lerp(0.15, 0.03, f),
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bullish' };
}

function hangingMan({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.32, 0.10, f), wickDownRatio: lerp(0.30, 0.85, f), wickUpRatio: lerp(0.15, 0.03, f),
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bearish' };
}

function doji({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const bodyRatio = lerp(0.02, 0.14, 1 - f);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio, wickUpRatio: lerp(0.45, 0.25, f), wickDownRatio: lerp(0.45, 0.25, f),
    bullish: Math.random() > 0.5, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'neutral' };
}

function dragonflyDoji({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.02, 0.12, 1 - f), wickUpRatio: lerp(0.02, 0.12, 1 - f), wickDownRatio: lerp(0.35, 0.85, f),
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bullish' };
}

function gravestoneDoji({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.02, 0.12, 1 - f), wickDownRatio: lerp(0.02, 0.12, 1 - f), wickUpRatio: lerp(0.35, 0.85, f),
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bearish' };
}

function spinningTop({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.14, 0.30, 1 - f), wickUpRatio: lerp(0.30, 0.15, f), wickDownRatio: lerp(0.30, 0.15, f),
    bullish: Math.random() > 0.5, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'neutral' };
}

function shootingStar({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.32, 0.10, f), wickUpRatio: lerp(0.30, 0.85, f), wickDownRatio: lerp(0.15, 0.03, f),
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bearish' };
}

function invertedHammer({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.32, 0.10, f), wickUpRatio: lerp(0.30, 0.85, f), wickDownRatio: lerp(0.15, 0.03, f),
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bullish' };
}

function marubozuBullish({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice) * 1.3;
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.95, 0.75, 1 - f), wickUpRatio: lerp(0.02, 0.12, 1 - f), wickDownRatio: lerp(0.02, 0.12, 1 - f),
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bullish' };
}

function marubozuBearish({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice) * 1.3;
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: lerp(0.95, 0.75, 1 - f), wickUpRatio: lerp(0.02, 0.12, 1 - f), wickDownRatio: lerp(0.02, 0.12, 1 - f),
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c], bias: 'bearish' };
}

function volumeClimax({ basePrice, avgVolume, clarity, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice) * lerp(1.4, 2.4, f);
  const bullish = Math.random() > 0.5;
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.5, wickUpRatio: 0.25, wickDownRatio: 0.25,
    bullish, volume: avgVolume * lerp(2, 3.5, f), zone: 'pattern',
  });
  return { candles: [c], bias: bullish ? 'bullish' : 'bearish' };
}

function volumeDryUp({ basePrice, avgVolume, clarity, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice) * lerp(0.4, 0.8, 1 - f);
  const c = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.3, wickUpRatio: 0.3, wickDownRatio: 0.3,
    bullish: Math.random() > 0.5, volume: avgVolume * lerp(0.5, 0.2, f), zone: 'pattern',
  });
  return { candles: [c], bias: 'neutral' };
}

// ── Two-candle patterns ─────────────────────────────────────────────────────

function bullishEngulfing({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range: range * 0.8,
    bodyRatio: 0.6, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const overshoot = lerp(0.02, 0.25, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close - range * overshoot, range: range * (1.1 + overshoot),
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bullish' };
}

function bearishEngulfing({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range: range * 0.8,
    bodyRatio: 0.6, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const overshoot = lerp(0.02, 0.25, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.open - range * overshoot, range: range * (1.1 + overshoot),
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bearish' };
}

function bullishHarami({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const containment = lerp(0.35, 0.75, 1 - f); // smaller candle = more textbook
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close + (c1.open - c1.close) * (1 - containment) / 2,
    range: range * containment,
    bodyRatio: 0.5, wickUpRatio: 0.15, wickDownRatio: 0.15,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bullish' };
}

function bearishHarami({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const containment = lerp(0.35, 0.75, 1 - f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.open + (c1.close - c1.open) * (1 - containment) / 2,
    range: range * containment,
    bodyRatio: 0.5, wickUpRatio: 0.15, wickDownRatio: 0.15,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bearish' };
}

function piercingLine({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const penetration = lerp(0.6, 0.35, 1 - f); // how far into prior body the close reaches
  const gapDown = range * lerp(0.1, 0.02, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close - gapDown, range: (c1.open - c1.close) * penetration + gapDown,
    bodyRatio: 0.9, wickUpRatio: 0.05, wickDownRatio: 0.05,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bullish' };
}

function darkCloudCover({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const penetration = lerp(0.6, 0.35, 1 - f);
  const gapUp = range * lerp(0.1, 0.02, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close - (c1.close - c1.open) * penetration,
    range: (c1.close - c1.open) * penetration + gapUp,
    bodyRatio: 0.9, wickUpRatio: 0.05, wickDownRatio: 0.05,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'bearish' };
}

function tweezerTop({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const highMatch = lerp(0.15, 0.02, f); // deviation between the two highs
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.55, wickUpRatio: 0.2, wickDownRatio: 0.1,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const c2Raw = shapeCandle({
    date: dates[1], refPrice: basePrice - range * 0.1, range,
    bodyRatio: 0.55, wickUpRatio: 0.2, wickDownRatio: 0.1,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  const shift = c1.high - c2Raw.high + range * randRange(-highMatch, highMatch);
  const c2 = makeCandle({ ...c2Raw, open: c2Raw.open + shift, high: c2Raw.high + shift, low: c2Raw.low + shift, close: c2Raw.close + shift, zone: 'pattern' });
  return { candles: [c1, c2], bias: 'bearish' };
}

function tweezerBottom({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const lowMatch = lerp(0.15, 0.02, f);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.55, wickDownRatio: 0.2, wickUpRatio: 0.1,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const c2Raw = shapeCandle({
    date: dates[1], refPrice: basePrice + range * 0.1, range,
    bodyRatio: 0.55, wickDownRatio: 0.2, wickUpRatio: 0.1,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  const shift = c1.low - c2Raw.low + range * randRange(-lowMatch, lowMatch);
  const c2 = makeCandle({ ...c2Raw, open: c2Raw.open + shift, high: c2Raw.high + shift, low: c2Raw.low + shift, close: c2Raw.close + shift, zone: 'pattern' });
  return { candles: [c1, c2], bias: 'bullish' };
}

function insideBar({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.6, wickUpRatio: 0.15, wickDownRatio: 0.15,
    bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const containment = lerp(0.35, 0.85, 1 - f); // smaller = more clearly "inside"
  const innerRange = (c1.high - c1.low) * containment;
  const innerRef = c1.low + ((c1.high - c1.low) - innerRange) / 2;
  const c2 = shapeCandle({
    date: dates[1], refPrice: innerRef, range: innerRange,
    bodyRatio: 0.5, wickUpRatio: 0.2, wickDownRatio: 0.2,
    bullish: Math.random() > 0.5, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: 'neutral' };
}

function outsideBar({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.55, wickUpRatio: 0.15, wickDownRatio: 0.15,
    bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const bullish = Math.random() > 0.5;
  const engulf = lerp(1.15, 1.6, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.low - range * (engulf - 1) / 2, range: range * engulf,
    bodyRatio: 0.7, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2], bias: bullish ? 'bullish' : 'bearish' };
}

// ── Three-candle patterns ────────────────────────────────────────────────────

function morningStar({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const gap = range * lerp(0.15, 0.02, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close - gap - range * 0.1, range: range * lerp(0.25, 0.5, 1 - f),
    bodyRatio: 0.35, wickUpRatio: 0.2, wickDownRatio: 0.2,
    bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume) * 0.7, zone: 'pattern',
  });
  const recovery = lerp(0.6, 0.35, 1 - f); // how far the 3rd candle closes back into candle 1's body
  const c3 = shapeCandle({
    date: dates[2], refPrice: c1.close - (c1.open - c1.close) * (1 - recovery), range: (c1.open - c1.close) * recovery + range * 0.15,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2, c3], bias: 'bullish' };
}

function eveningStar({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const gap = range * lerp(0.15, 0.02, f);
  const c2 = shapeCandle({
    date: dates[1], refPrice: c1.close + gap, range: range * lerp(0.25, 0.5, 1 - f),
    bodyRatio: 0.35, wickUpRatio: 0.2, wickDownRatio: 0.2,
    bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume) * 0.7, zone: 'pattern',
  });
  const recovery = lerp(0.6, 0.35, 1 - f);
  const c3 = shapeCandle({
    date: dates[2], refPrice: c1.close - (c1.close - c1.open) * recovery, range: (c1.close - c1.open) * recovery + range * 0.15,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2, c3], bias: 'bearish' };
}

function threeWhiteSoldiers({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const overlap = lerp(0.1, 0.4, 1 - f); // each open sits within prior body — smaller = more textbook
  let price = basePrice;
  const candles = [];
  for (let i = 0; i < 3; i++) {
    const c = shapeCandle({
      date: dates[i], refPrice: price - range * overlap, range: range * lerp(0.9, 1.1, Math.random()),
      bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
      bullish: true, volume: i === 2 ? volumeForCharacter(volumeCharacter, avgVolume) : fillerVolume(avgVolume),
      zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
  }
  return { candles, bias: 'bullish' };
}

function threeBlackCrows({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const overlap = lerp(0.1, 0.4, 1 - f);
  let price = basePrice;
  const candles = [];
  for (let i = 0; i < 3; i++) {
    const c = shapeCandle({
      date: dates[i], refPrice: price - range * (1 + overlap), range: range * lerp(0.9, 1.1, Math.random()),
      bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
      bullish: false, volume: i === 2 ? volumeForCharacter(volumeCharacter, avgVolume) : fillerVolume(avgVolume),
      zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
  }
  return { candles, bias: 'bearish' };
}

// Abandoned Baby is really two distinct patterns sharing a shape — a
// gap-down doji (bullish reversal) or a gap-up doji (bearish reversal).
// Split into two fixed-direction slugs so the pattern library and the
// classification below don't have to guess which one a chart shows.
function abandonedBabyShape({ basePrice, avgVolume, clarity, volumeCharacter, dates, bullish }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range,
    bodyRatio: 0.75, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: !bullish, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const gap1 = range * lerp(0.2, 0.03, f);
  const dojiCenter = bullish ? c1.close - gap1 - range * 0.05 : c1.close + gap1 + range * 0.05;
  const c2 = shapeCandle({
    date: dates[1], refPrice: dojiCenter, range: range * 0.2,
    bodyRatio: 0.05, wickUpRatio: 0.4, wickDownRatio: 0.4,
    bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume) * 0.6, zone: 'pattern',
  });
  const gap2 = range * lerp(0.2, 0.03, f);
  const c3Ref = bullish ? c2.high + gap2 : c2.low - gap2 - range * 0.75;
  const c3 = shapeCandle({
    date: dates[2], refPrice: c3Ref, range: range * 0.85,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [c1, c2, c3], bias: bullish ? 'bullish' : 'bearish' };
}

function abandonedBabyBullish(params) { return abandonedBabyShape({ ...params, bullish: true }); }
function abandonedBabyBearish(params) { return abandonedBabyShape({ ...params, bullish: false }); }

// ── Five-candle patterns ─────────────────────────────────────────────────────

function risingThree({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice, range: range * 1.3,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const candles = [c1];
  let price = c1.close;
  const containment = lerp(0.4, 0.75, 1 - f); // pullback candles staying inside c1's range
  for (let i = 1; i <= 3; i++) {
    const drift = -range * 0.12 * randRange(0.6, 1);
    const cRange = range * containment * 0.4;
    price += drift;
    const c = shapeCandle({
      date: dates[i], refPrice: price - cRange / 2, range: cRange,
      bodyRatio: 0.4, wickUpRatio: 0.2, wickDownRatio: 0.2,
      bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume) * 0.6, zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
  }
  const c5 = shapeCandle({
    date: dates[4], refPrice: c1.close, range: range * 1.2,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  candles.push(c5);
  return { candles, bias: 'bullish' };
}

function fallingThree({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const c1 = shapeCandle({
    date: dates[0], refPrice: basePrice - range * 1.3, range: range * 1.3,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const candles = [c1];
  let price = c1.close;
  const containment = lerp(0.4, 0.75, 1 - f);
  for (let i = 1; i <= 3; i++) {
    const drift = range * 0.12 * randRange(0.6, 1);
    const cRange = range * containment * 0.4;
    price += drift;
    const c = shapeCandle({
      date: dates[i], refPrice: price - cRange / 2, range: cRange,
      bodyRatio: 0.4, wickUpRatio: 0.2, wickDownRatio: 0.2,
      bullish: Math.random() > 0.5, volume: fillerVolume(avgVolume) * 0.6, zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
  }
  const c5 = shapeCandle({
    date: dates[4], refPrice: c1.close - range * 1.2, range: range * 1.2,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  candles.push(c5);
  return { candles, bias: 'bearish' };
}

// ── S/R and trend-structure patterns ────────────────────────────────────────
// These are context patterns rather than single-candle shapes: a reaction
// at a level, or a swing structure over several candles.

function supportLevel({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const approach = shapeCandle({
    date: dates[0], refPrice: basePrice, range: range * 0.9,
    bodyRatio: 0.6, wickDownRatio: lerp(0.25, 0.6, f), wickUpRatio: 0.1,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const bounce = shapeCandle({
    date: dates[1], refPrice: approach.low + range * 0.05, range: range * lerp(0.9, 0.5, 1 - f),
    bodyRatio: 0.7, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [approach, bounce], bias: 'bullish', srLevel: { price: approach.low, type: 'support' } };
}

function resistanceLevel({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const approach = shapeCandle({
    date: dates[0], refPrice: basePrice, range: range * 0.9,
    bodyRatio: 0.6, wickUpRatio: lerp(0.25, 0.6, f), wickDownRatio: 0.1,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  });
  const reject = shapeCandle({
    date: dates[1], refPrice: approach.high - range * lerp(0.9, 0.5, 1 - f) - range * 0.05, range: range * lerp(0.9, 0.5, 1 - f),
    bodyRatio: 0.7, wickUpRatio: 0.1, wickDownRatio: 0.1,
    bullish: false, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  return { candles: [approach, reject], bias: 'bearish', srLevel: { price: approach.high, type: 'resistance' } };
}

function trendlineSupport({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const candles = [];
  let price = basePrice - range * 2;
  for (let i = 0; i < 2; i++) {
    const c = shapeCandle({
      date: dates[i], refPrice: price, range: range * 0.8,
      bodyRatio: 0.55, wickDownRatio: 0.15, wickUpRatio: 0.1,
      bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
    });
    candles.push(c);
    price = c.close + range * 0.9;
  }
  const touch = shapeCandle({
    date: dates[2], refPrice: candles[candles.length - 1].close - range * lerp(0.3, 0.1, f), range: range * lerp(1.1, 0.6, 1 - f),
    bodyRatio: 0.6, wickDownRatio: lerp(0.3, 0.6, f), wickUpRatio: 0.1,
    bullish: true, volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });
  candles.push(touch);
  return { candles, bias: 'bullish', srLevel: { price: touch.low, type: 'support' } };
}

function higherHighLow({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const step = range * lerp(0.9, 0.35, 1 - f); // bigger step = clearer HH/HL structure
  const candles = [];
  let price = basePrice;
  for (let i = 0; i < 4; i++) {
    const bullish = i % 2 === 0;
    const c = shapeCandle({
      date: dates[i], refPrice: price, range: range * 0.7,
      bodyRatio: 0.6, wickUpRatio: 0.12, wickDownRatio: 0.12,
      bullish, volume: i === 3 ? volumeForCharacter(volumeCharacter, avgVolume) : fillerVolume(avgVolume),
      zone: 'pattern',
    });
    candles.push(c);
    price = c.close + step * (bullish ? 1 : -0.3);
  }
  return { candles, bias: 'bullish' };
}

// ── Chart patterns (multi-candle swing structures) ──────────────────────────
// Reversal patterns have a fixed directional bias. Continuation patterns
// (triangle, flag/pennant, wedge, rectangle) don't — they only make sense
// inside an existing trend, so the composer passes `trendContext` and the
// breakout direction follows whichever trend the chart was placed in.

function headShoulders({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const shoulderH = range * lerp(2.2, 1.3, f);
  const headH = shoulderH * lerp(1.4, 1.1, f);
  const asymmetry = lerp(0.05, 0.3, 1 - f);

  const candles = [];
  const rally = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.7, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const pullback = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.7, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  rally(shoulderH, 0);
  pullback(shoulderH, 1);
  rally(headH, 2);
  pullback(headH, 3);
  const rightShoulderH = shoulderH * (1 + randRange(-asymmetry, asymmetry));
  rally(rightShoulderH, 4);
  pullback(rightShoulderH * 0.85, 5);

  const breakdownDepth = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[6], refPrice: neckline - breakdownDepth, range: breakdownDepth,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: false,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bearish', srLevel: { price: neckline, type: 'support' } };
}

function inverseHeadShoulders({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const shoulderD = range * lerp(2.2, 1.3, f);
  const headD = shoulderD * lerp(1.4, 1.1, f);
  const asymmetry = lerp(0.05, 0.3, 1 - f);

  const candles = [];
  const dip = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.7, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const recover = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.7, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  dip(shoulderD, 0);
  recover(shoulderD, 1);
  dip(headD, 2);
  recover(headD, 3);
  const rightShoulderD = shoulderD * (1 + randRange(-asymmetry, asymmetry));
  dip(rightShoulderD, 4);
  recover(rightShoulderD * 0.85, 5);

  const breakoutHeight = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[6], refPrice: neckline, range: breakoutHeight,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: true,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bullish', srLevel: { price: neckline, type: 'resistance' } };
}

function doubleTop({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const peakH = range * lerp(2.4, 1.4, f);
  const asymmetry = lerp(0.05, 0.3, 1 - f);

  const candles = [];
  const rally = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.7, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const pullback = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.7, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  rally(peakH, 0);
  pullback(peakH, 1);
  rally(peakH * (1 + randRange(-asymmetry, asymmetry)), 2);
  pullback(peakH * 0.9, 3);

  const breakdownDepth = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[4], refPrice: neckline - breakdownDepth, range: breakdownDepth,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: false,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bearish', srLevel: { price: neckline, type: 'support' } };
}

function doubleBottom({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const troughD = range * lerp(2.4, 1.4, f);
  const asymmetry = lerp(0.05, 0.3, 1 - f);

  const candles = [];
  const dip = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.7, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const recover = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.7, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  dip(troughD, 0);
  recover(troughD, 1);
  dip(troughD * (1 + randRange(-asymmetry, asymmetry)), 2);
  recover(troughD * 0.9, 3);

  const breakoutHeight = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[4], refPrice: neckline, range: breakoutHeight,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: true,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bullish', srLevel: { price: neckline, type: 'resistance' } };
}

function tripleTop({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const peakH = range * lerp(2.2, 1.3, f);
  const asymmetry = lerp(0.06, 0.28, 1 - f);

  const candles = [];
  const rally = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.65, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const pullback = (height, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline, range: height, bodyRatio: 0.65, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  rally(peakH, 0);
  pullback(peakH, 1);
  rally(peakH * (1 + randRange(-asymmetry, asymmetry)), 2);
  pullback(peakH * 0.85, 3);
  rally(peakH * (1 + randRange(-asymmetry, asymmetry)), 4);
  pullback(peakH * 0.85, 5);

  const breakdownDepth = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[6], refPrice: neckline - breakdownDepth, range: breakdownDepth,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: false,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bearish', srLevel: { price: neckline, type: 'support' } };
}

function tripleBottom({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const neckline = basePrice;
  const troughD = range * lerp(2.2, 1.3, f);
  const asymmetry = lerp(0.06, 0.28, 1 - f);

  const candles = [];
  const dip = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.65, wickUpRatio: 0.08, wickDownRatio: 0.12,
    bullish: false, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));
  const recover = (depth, i) => candles.push(shapeCandle({
    date: dates[i], refPrice: neckline - depth, range: depth, bodyRatio: 0.65, wickUpRatio: 0.12, wickDownRatio: 0.08,
    bullish: true, volume: fillerVolume(avgVolume), zone: 'pattern',
  }));

  dip(troughD, 0);
  recover(troughD, 1);
  dip(troughD * (1 + randRange(-asymmetry, asymmetry)), 2);
  recover(troughD * 0.85, 3);
  dip(troughD * (1 + randRange(-asymmetry, asymmetry)), 4);
  recover(troughD * 0.85, 5);

  const breakoutHeight = range * lerp(1.6, 0.7, f);
  candles.push(shapeCandle({
    date: dates[6], refPrice: neckline, range: breakoutHeight,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: true,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bullish', srLevel: { price: neckline, type: 'resistance' } };
}

function saucerBottom({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const roundness = lerp(0.5, 0.85, f); // gradual/smooth curve when textbook
  const totalDepth = range * lerp(2.0, 1.1, f);

  const candles = [];
  let price = basePrice;
  const legDepths = [0.35, 0.25, 0.1, 0.1, 0.25].map(p => totalDepth * p * roundness);
  const directions = [false, false, false, true, true]; // down, down, flat bottom, up, up
  for (let i = 0; i < 5; i++) {
    const c = shapeCandle({
      date: dates[i], refPrice: directions[i] ? price : price - legDepths[i], range: Math.max(legDepths[i], range * 0.2),
      bodyRatio: 0.5, wickUpRatio: 0.2, wickDownRatio: 0.2, bullish: directions[i],
      volume: fillerVolume(avgVolume) * (i === 2 ? 0.6 : 1), zone: 'pattern', // volume dries up at the base
    });
    candles.push(c);
    price = c.close;
  }
  const breakoutHeight = range * lerp(1.5, 0.7, f);
  candles.push(shapeCandle({
    date: dates[5], refPrice: price, range: breakoutHeight,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: true,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: 'bullish' };
}

function spikeTop({ basePrice, avgVolume, clarity, volumeCharacter, dates }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const spikeHeight = range * lerp(2.6, 1.5, f);

  const c0 = shapeCandle({
    date: dates[0], refPrice: basePrice, range: spikeHeight * 0.5,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: true,
    volume: fillerVolume(avgVolume) * 1.3, zone: 'pattern',
  });
  const c1 = shapeCandle({
    date: dates[1], refPrice: c0.close, range: spikeHeight * 0.5,
    bodyRatio: 0.85, wickUpRatio: 0.1, wickDownRatio: 0.05, bullish: true,
    volume: fillerVolume(avgVolume) * 1.6, zone: 'pattern',
  });
  const c2 = shapeCandle({
    date: dates[2], refPrice: c1.close - spikeHeight * 0.6, range: spikeHeight * 0.6,
    bodyRatio: 0.85, wickUpRatio: 0.05, wickDownRatio: 0.1, bullish: false,
    volume: fillerVolume(avgVolume) * 1.5, zone: 'pattern',
  });
  const c3 = shapeCandle({
    date: dates[3], refPrice: c2.close - spikeHeight * 0.5, range: spikeHeight * 0.5,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish: false,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  });

  return { candles: [c0, c1, c2, c3], bias: 'bearish' };
}

function triangle({ basePrice, avgVolume, clarity, volumeCharacter, dates, trendContext }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const bullish = trendContext !== 'downtrend';
  const contraction = lerp(0.85, 0.5, f); // tighter contraction when textbook

  const candles = [];
  let price = basePrice;
  let swingRange = range * 1.4;
  for (let i = 0; i < 5; i++) {
    const up = i % 2 === 0;
    const c = shapeCandle({
      date: dates[i], refPrice: up ? price : price - swingRange, range: swingRange,
      bodyRatio: 0.5, wickUpRatio: 0.15, wickDownRatio: 0.15, bullish: up,
      volume: fillerVolume(avgVolume) * lerp(1, 0.5, i / 5), zone: 'pattern', // volume dries up as it tightens
    });
    candles.push(c);
    price = c.close;
    swingRange *= contraction;
  }
  const breakoutRange = range * lerp(1.6, 0.8, f);
  candles.push(shapeCandle({
    date: dates[5], refPrice: bullish ? price : price - breakoutRange, range: breakoutRange,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: bullish ? 'bullish' : 'bearish' };
}

function flagPennant({ basePrice, avgVolume, clarity, volumeCharacter, dates, trendContext }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const bullish = trendContext !== 'downtrend';
  const poleHeight = range * lerp(2.4, 1.4, f);

  const pole = shapeCandle({
    date: dates[0], refPrice: bullish ? basePrice : basePrice - poleHeight, range: poleHeight,
    bodyRatio: 0.85, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish,
    volume: fillerVolume(avgVolume) * 1.6, zone: 'pattern',
  });
  const candles = [pole];
  let price = pole.close;
  const consolidationRange = range * lerp(0.4, 0.8, 1 - f); // tighter = more textbook flag
  for (let i = 1; i <= 3; i++) {
    const c = shapeCandle({
      date: dates[i], refPrice: bullish ? price - consolidationRange : price, range: consolidationRange,
      bodyRatio: 0.45, wickUpRatio: 0.2, wickDownRatio: 0.2, bullish: !bullish, // drifts against the pole
      volume: fillerVolume(avgVolume) * 0.5, zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
  }
  const breakoutRange = range * lerp(1.5, 0.8, f);
  candles.push(shapeCandle({
    date: dates[4], refPrice: bullish ? price : price - breakoutRange, range: breakoutRange,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: bullish ? 'bullish' : 'bearish' };
}

function wedge({ basePrice, avgVolume, clarity, volumeCharacter, dates, trendContext }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const bullish = trendContext !== 'downtrend';
  const contraction = lerp(0.8, 0.55, f);
  const drift = range * (bullish ? -1 : 1) * 0.3; // wedge slopes counter to the eventual breakout

  const candles = [];
  let price = basePrice;
  let swingRange = range * 1.5;
  for (let i = 0; i < 5; i++) {
    const up = i % 2 === 0;
    const anchor = price + drift * (i / 5);
    const c = shapeCandle({
      date: dates[i], refPrice: up ? anchor : anchor - swingRange, range: swingRange,
      bodyRatio: 0.5, wickUpRatio: 0.15, wickDownRatio: 0.15, bullish: up,
      volume: fillerVolume(avgVolume) * lerp(1, 0.5, i / 5), zone: 'pattern',
    });
    candles.push(c);
    price = c.close;
    swingRange *= contraction;
  }
  const breakoutRange = range * lerp(1.6, 0.8, f);
  candles.push(shapeCandle({
    date: dates[5], refPrice: bullish ? price : price - breakoutRange, range: breakoutRange,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: bullish ? 'bullish' : 'bearish' };
}

function rectangle({ basePrice, avgVolume, clarity, volumeCharacter, dates, trendContext }) {
  const f = factorOf(clarity);
  const range = typicalRange(basePrice);
  const bullish = trendContext !== 'downtrend';
  const channelHeight = range * lerp(1.6, 2.4, 1 - f); // tighter/cleaner channel when textbook
  const floor = basePrice - channelHeight * 0.85;
  const ceiling = basePrice - channelHeight * 0.15;

  const candles = [];
  for (let i = 0; i < 5; i++) {
    const up = i % 2 === 0;
    const c = shapeCandle({
      date: dates[i], refPrice: up ? ceiling - channelHeight * 0.7 : floor, range: channelHeight * 0.7,
      bodyRatio: 0.5, wickUpRatio: 0.15, wickDownRatio: 0.15, bullish: up,
      volume: fillerVolume(avgVolume), zone: 'pattern',
    });
    candles.push(c);
  }
  const breakoutRange = range * lerp(1.6, 0.8, f);
  candles.push(shapeCandle({
    date: dates[5], refPrice: bullish ? ceiling : floor - breakoutRange, range: breakoutRange,
    bodyRatio: 0.8, wickUpRatio: 0.08, wickDownRatio: 0.08, bullish,
    volume: volumeForCharacter(volumeCharacter, avgVolume), zone: 'pattern',
  }));

  return { candles, bias: bullish ? 'bullish' : 'bearish' };
}

// ── Registry ─────────────────────────────────────────────────────────────────

const PATTERN_META = {
  hammer:               { candleCount: 1, fn: hammer,             requiresTrend: 'downtrend', category: 'candlestick' },
  hanging_man:          { candleCount: 1, fn: hangingMan,         requiresTrend: 'uptrend',   category: 'candlestick' },
  doji:                 { candleCount: 1, fn: doji,               requiresTrend: null,         category: 'candlestick' },
  dragonfly_doji:       { candleCount: 1, fn: dragonflyDoji,       requiresTrend: 'downtrend', category: 'candlestick' },
  gravestone_doji:      { candleCount: 1, fn: gravestoneDoji,      requiresTrend: 'uptrend',   category: 'candlestick' },
  spinning_top:         { candleCount: 1, fn: spinningTop,         requiresTrend: null,         category: 'candlestick' },
  bullish_engulfing:    { candleCount: 2, fn: bullishEngulfing,    requiresTrend: 'downtrend', category: 'candlestick' },
  bearish_engulfing:    { candleCount: 2, fn: bearishEngulfing,    requiresTrend: 'uptrend',   category: 'candlestick' },
  morning_star:         { candleCount: 3, fn: morningStar,         requiresTrend: 'downtrend', category: 'candlestick' },
  evening_star:         { candleCount: 3, fn: eveningStar,         requiresTrend: 'uptrend',   category: 'candlestick' },
  shooting_star:        { candleCount: 1, fn: shootingStar,        requiresTrend: 'uptrend',   category: 'candlestick' },
  inverted_hammer:      { candleCount: 1, fn: invertedHammer,      requiresTrend: 'downtrend', category: 'candlestick' },
  bullish_harami:       { candleCount: 2, fn: bullishHarami,       requiresTrend: 'downtrend', category: 'candlestick' },
  bearish_harami:       { candleCount: 2, fn: bearishHarami,       requiresTrend: 'uptrend',   category: 'candlestick' },
  piercing_line:        { candleCount: 2, fn: piercingLine,        requiresTrend: 'downtrend', category: 'candlestick' },
  dark_cloud_cover:     { candleCount: 2, fn: darkCloudCover,       requiresTrend: 'uptrend',   category: 'candlestick' },
  three_white_soldiers: { candleCount: 3, fn: threeWhiteSoldiers,  requiresTrend: 'downtrend', category: 'candlestick' },
  three_black_crows:    { candleCount: 3, fn: threeBlackCrows,     requiresTrend: 'uptrend',   category: 'candlestick' },
  marubozu_bullish:     { candleCount: 1, fn: marubozuBullish,     requiresTrend: null,         category: 'candlestick' },
  marubozu_bearish:     { candleCount: 1, fn: marubozuBearish,     requiresTrend: null,         category: 'candlestick' },
  tweezer_top:          { candleCount: 2, fn: tweezerTop,          requiresTrend: 'uptrend',   category: 'candlestick' },
  tweezer_bottom:       { candleCount: 2, fn: tweezerBottom,       requiresTrend: 'downtrend', category: 'candlestick' },
  inside_bar:           { candleCount: 2, fn: insideBar,           requiresTrend: null,         category: 'candlestick' },
  outside_bar:          { candleCount: 2, fn: outsideBar,          requiresTrend: null,         category: 'candlestick' },
  abandoned_baby_bullish: { candleCount: 3, fn: abandonedBabyBullish, requiresTrend: null,       category: 'candlestick' },
  abandoned_baby_bearish: { candleCount: 3, fn: abandonedBabyBearish, requiresTrend: null,       category: 'candlestick' },
  rising_three:         { candleCount: 5, fn: risingThree,         requiresTrend: 'uptrend',   category: 'candlestick' },
  falling_three:        { candleCount: 5, fn: fallingThree,        requiresTrend: 'downtrend', category: 'candlestick' },
  volume_climax:        { candleCount: 1, fn: volumeClimax,        requiresTrend: null,         category: 'volume' },
  volume_dry_up:        { candleCount: 1, fn: volumeDryUp,         requiresTrend: null,         category: 'volume' },
  support_level:        { candleCount: 2, fn: supportLevel,        requiresTrend: 'downtrend', category: 'sr' },
  resistance_level:     { candleCount: 2, fn: resistanceLevel,     requiresTrend: 'uptrend',   category: 'sr' },
  trendline_support:    { candleCount: 3, fn: trendlineSupport,    requiresTrend: 'uptrend',   category: 'trend' },
  higher_high_low:      { candleCount: 4, fn: higherHighLow,       requiresTrend: 'uptrend',   category: 'trend' },

  // Chart patterns — multi-candle swing structures, reversal or continuation.
  head_shoulders:         { candleCount: 7, fn: headShoulders,         requiresTrend: 'uptrend',   category: 'chart_pattern' },
  inverse_head_shoulders: { candleCount: 7, fn: inverseHeadShoulders,  requiresTrend: 'downtrend', category: 'chart_pattern' },
  double_top:             { candleCount: 5, fn: doubleTop,             requiresTrend: 'uptrend',   category: 'chart_pattern' },
  double_bottom:          { candleCount: 5, fn: doubleBottom,          requiresTrend: 'downtrend', category: 'chart_pattern' },
  triple_top:             { candleCount: 7, fn: tripleTop,             requiresTrend: 'uptrend',   category: 'chart_pattern' },
  triple_bottom:          { candleCount: 7, fn: tripleBottom,          requiresTrend: 'downtrend', category: 'chart_pattern' },
  saucer_bottom:          { candleCount: 6, fn: saucerBottom,          requiresTrend: 'downtrend', category: 'chart_pattern' },
  spike_top:              { candleCount: 4, fn: spikeTop,              requiresTrend: 'uptrend',   category: 'chart_pattern' },
  triangle:               { candleCount: 6, fn: triangle,              requiresTrend: 'trending',  category: 'chart_pattern' },
  flag_pennant:           { candleCount: 5, fn: flagPennant,           requiresTrend: 'trending',  category: 'chart_pattern' },
  wedge:                  { candleCount: 6, fn: wedge,                 requiresTrend: 'trending',  category: 'chart_pattern' },
  rectangle:              { candleCount: 6, fn: rectangle,             requiresTrend: 'trending',  category: 'chart_pattern' },
};

module.exports = { PATTERN_META };
