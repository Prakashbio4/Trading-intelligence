'use strict';

// Per-chart and per-session scoring — pure functions, no AI, no DB.

// Ambiguous charts have a real (but flawed) pattern — the professional-grade
// call is "weak" or "no trade", not full "yes" conviction. Clean and
// multi-concept charts genuinely have the pattern, so "yes" is correct there.
function scoreChart(chart, { userDetection, userPatternSlug, userConfidence }) {
  const detectionCorrect = chart.chartType === 'ambiguous'
    ? (userDetection === 'weak' || userDetection === 'no')
    : chart.patternPresent
      ? (userDetection === 'yes' || userDetection === 'weak')
      : userDetection === 'no';

  const classificationCorrect = chart.patternPresent
    ? (userPatternSlug === chart.patternSlug)
    : null;

  const confidenceAppropriate = !(userConfidence === 'HIGH' && !detectionCorrect);

  return { detectionCorrect, classificationCorrect, confidenceAppropriate };
}

function scoreSession(charts) {
  const total = charts.length;
  const detectionCorrectCount = charts.filter(c => c.detection_correct).length;
  const presentCharts = charts.filter(c => c.pattern_present);
  const classificationCorrectCount = presentCharts.filter(c => c.classification_correct).length;

  const falsePositiveCount = charts.filter(c => !c.pattern_present && c.user_detection === 'yes').length;
  const highConfCalls = charts.filter(c => c.user_confidence === 'HIGH');
  const highConfidenceWrongCount = highConfCalls.filter(c => !c.detection_correct).length;

  return {
    detectionScore: round1((detectionCorrectCount / total) * 100),
    classificationScore: presentCharts.length ? round1((classificationCorrectCount / presentCharts.length) * 100) : null,
    calibrationScore: highConfCalls.length
      ? round1((1 - highConfidenceWrongCount / highConfCalls.length) * 100)
      : null,
    falsePositiveCount,
    highConfidenceWrongCount,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = { scoreChart, scoreSession };
