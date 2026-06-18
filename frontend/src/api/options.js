export const TREND_OPTIONS = ['Uptrend', 'Downtrend', 'Sideways', 'Unclear'];

export const TREND_DURATION = ['Few days', '2–3 weeks', '1–2 months', '3+ months'];

export const STOCK_PHASE = [
  'Early uptrend', 'Mid uptrend', 'Extended', 'Topping',
  'Accumulation', 'Distribution', 'Breakout', 'Breakdown',
];

export const CHART_STRUCTURE = [
  'No pattern', 'Flag', 'Pennant', 'Double top', 'Double bottom',
  'Triple top', 'Triple bottom', 'Accumulation range',
  'Breakout confirmed', 'Breakdown confirmed',
];

export const OPPOSING_STRUCTURE = [
  'None', 'Resistance overhead', 'Support below',
  'Double top blocking', 'Double bottom blocking',
];

export const CANDLE_PATTERNS = [
  'No pattern identified',
  'Bullish Marubozu', 'Bearish Marubozu',
  'Hammer', 'Hanging Man', 'Inverted Hammer', 'Shooting Star',
  'Dragonfly Doji', 'Gravestone Doji', 'Doji', 'Spinning Top',
  'Bullish Engulfing', 'Bearish Engulfing',
  'Piercing Line', 'Dark Cloud Cover',
  'Morning Star', 'Evening Star',
  'Morning Doji Star', 'Evening Doji Star',
  'Bullish Harami', 'Bearish Harami',
];

export const PATTERN_DIRECTION = ['N/A', 'Bullish', 'Bearish', 'Neutral'];

export const PATTERN_QUALITY = ['Textbook clean', 'Acceptable', 'Borderline', 'Weak'];

export const PRIOR_TREND_MATCH = ['Yes', 'No', 'Partial'];

export const SEQUENCE_TYPES = [
  'Exhaustion', 'Reversal building', 'Continuation',
  'Indecision cluster', 'No clear sequence',
];

export const VOLUME_VS_AVG = [
  'Clearly above', 'Slightly above', 'About average', 'Below average', 'Cannot tell',
];

export const VOLUME_CHARACTER = [
  'Expanding on trend days', 'Contracting on pullbacks', 'Mixed', 'Cannot read',
];

export const MACD_OPTIONS = [
  'Crossing up now', 'Already crossed up', 'Crossing down', 'Already crossed down',
  'Flat', 'Diverging bullish', 'Diverging bearish', 'Cannot read',
];

export const RSI_OPTIONS = [
  'Rising from oversold (<40)', 'Rising mid-range (40–60)',
  'Approaching overbought (>65)', 'Falling', 'Flat', 'Cannot read',
];

export const BOLLINGER_OPTIONS = [
  'Squeezing (narrow)', 'Beginning to expand', 'Wide', 'Normal', 'Cannot read',
];

export const SR_CONFIDENCE = [
  'Clear level', 'Moderate', 'Guessing', 'Cannot identify',
];

export const DECISION_OPTIONS = ['Take', 'Skip', 'Watch'];
