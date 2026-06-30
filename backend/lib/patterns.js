'use strict';

const ti = require('technicalindicators');

// Each entry: { name, bias, candleCount, detector }
// detector(input) returns true if the pattern completes on the LAST candle in input
// Each exported name is a plain function: ti.eveningstar(input) → boolean
const DETECTORS = [
  // 3-candle
  { name: 'Evening Star',           bias: 'bearish_reversal', candleCount: 3, detector: ti.eveningstar },
  { name: 'Evening Doji Star',      bias: 'bearish_reversal', candleCount: 3, detector: ti.eveningdojistar },
  { name: 'Morning Star',           bias: 'bullish_reversal', candleCount: 3, detector: ti.morningstar },
  { name: 'Morning Doji Star',      bias: 'bullish_reversal', candleCount: 3, detector: ti.morningdojistar },
  { name: 'Three White Soldiers',   bias: 'bullish_reversal', candleCount: 3, detector: ti.threewhitesoldiers },
  { name: 'Three Black Crows',      bias: 'bearish_reversal', candleCount: 3, detector: ti.threeblackcrows },
  // 2-candle
  { name: 'Bullish Engulfing',      bias: 'bullish_reversal', candleCount: 2, detector: ti.bullishengulfingpattern },
  { name: 'Bearish Engulfing',      bias: 'bearish_reversal', candleCount: 2, detector: ti.bearishengulfingpattern },
  { name: 'Piercing Line',          bias: 'bullish_reversal', candleCount: 2, detector: ti.piercingline },
  { name: 'Dark Cloud Cover',       bias: 'bearish_reversal', candleCount: 2, detector: ti.darkcloudcover },
  { name: 'Bullish Harami',         bias: 'bullish_reversal', candleCount: 2, detector: ti.bullishharami },
  { name: 'Bearish Harami',         bias: 'bearish_reversal', candleCount: 2, detector: ti.bearishharami },
  { name: 'Bullish Harami Cross',   bias: 'bullish_reversal', candleCount: 2, detector: ti.bullishharamicross },
  { name: 'Bearish Harami Cross',   bias: 'bearish_reversal', candleCount: 2, detector: ti.bearishharamicross },
  { name: 'Tweezer Bottom',         bias: 'bullish_reversal', candleCount: 2, detector: ti.tweezerbottom },
  { name: 'Tweezer Top',            bias: 'bearish_reversal', candleCount: 2, detector: ti.tweezertop },
  // 1-candle
  { name: 'Hammer',                 bias: 'bullish_reversal', candleCount: 1, detector: ti.hammerpattern },
  { name: 'Hanging Man',            bias: 'bearish_reversal', candleCount: 1, detector: ti.hangingmanunconfirmed },
  { name: 'Shooting Star',          bias: 'bearish_reversal', candleCount: 1, detector: ti.shootingstarunconfirmed },
  { name: 'Inverted Hammer',        bias: 'bullish_reversal', candleCount: 1, detector: ti.bullishinvertedhammerstick },
  { name: 'Bullish Marubozu',       bias: 'bullish_continuation', candleCount: 1, detector: ti.bullishmarubozu },
  { name: 'Bearish Marubozu',       bias: 'bearish_continuation', candleCount: 1, detector: ti.bearishmarubozu },
  { name: 'Doji',                   bias: 'indecision',       candleCount: 1, detector: ti.doji },
  { name: 'Dragonfly Doji',         bias: 'bullish_reversal', candleCount: 1, detector: ti.dragonflydoji },
  { name: 'Gravestone Doji',        bias: 'bearish_reversal', candleCount: 1, detector: ti.gravestonedoji },
  { name: 'Spinning Top (Bullish)', bias: 'indecision',       candleCount: 1, detector: ti.bullishspinningtop },
  { name: 'Spinning Top (Bearish)', bias: 'indecision',       candleCount: 1, detector: ti.bearishspinningtop },
];

// Build the input object technicalindicators expects from an array of OHLC candles
function toInput(candles) {
  return {
    open:   candles.map(c => c.open),
    high:   candles.map(c => c.high),
    low:    candles.map(c => c.low),
    close:  candles.map(c => c.close),
    volume: candles.map(c => c.volume),
  };
}

// Scan a sorted array of OHLC candles (oldest → newest, length ≥ 3).
// For each candle position i (as the completion bar), check all detectors.
// Returns array of pattern detections: { name, bias, candleCount, completionDate, startDate }
function detectPatterns(candles) {
  const results = [];

  for (let i = 0; i < candles.length; i++) {
    for (const { name, bias, candleCount, detector } of DETECTORS) {
      if (i < candleCount - 1) continue; // not enough candles before this index
      const slice = candles.slice(i - candleCount + 1, i + 1);
      try {
        // Suppress console.warn from library for undersized slices
        const warn = console.warn;
        console.warn = () => {};
        const matched = detector(toInput(slice));
        console.warn = warn;
        if (matched) {
          results.push({
            name,
            bias,
            candleCount,
            completionDate: candles[i].date,
            startDate: candles[i - candleCount + 1].date,
          });
        }
      } catch (_) {
        // some detectors throw on insufficient data — safe to ignore
      }
    }
  }

  return results;
}

module.exports = { detectPatterns };
