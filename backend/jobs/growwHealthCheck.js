'use strict';

const { fetchDailyOhlc } = require('../lib/groww');
const { sendAlert } = require('../lib/alerts');

// Independent of prewarm/backfill/nightly-fetch — those only exercise Groww
// when they happen to be touching a symbol, so a break between runs (or one
// masked by those jobs' own retries) can sit undetected for a while. This is
// a small, dedicated, frequent check against one known-good symbol whose
// only job is "is the Groww integration alive right now."
const HEALTH_CHECK_SYMBOL = 'RELIANCE';
const LOOKBACK_DAYS = 7; // wide enough to always contain at least one trading day, any day of the week

let _lastCheckFailed = false;

async function runGrowwHealthCheck() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - LOOKBACK_DAYS);
  const toDate = to.toISOString().split('T')[0];
  const fromDate = from.toISOString().split('T')[0];

  try {
    const candles = await fetchDailyOhlc(HEALTH_CHECK_SYMBOL, fromDate, toDate);
    if (!candles.length) throw new Error('no candles returned');

    if (_lastCheckFailed) {
      console.log('[growwHealthCheck] recovered');
      await sendAlert(
        'Groww API health check recovered',
        `Synthetic check against ${HEALTH_CHECK_SYMBOL} is succeeding again after a prior failure.`,
        'groww-health-recovered'
      );
    }
    _lastCheckFailed = false;
  } catch (err) {
    console.error(`[growwHealthCheck] failed — ${err.message}`);
    _lastCheckFailed = true;
    await sendAlert(
      'Groww API health check failed',
      `Synthetic check against ${HEALTH_CHECK_SYMBOL} failed: ${err.message}`,
      'groww-health-failed'
    ).catch(alertErr => console.error('[growwHealthCheck] failed to send alert:', alertErr.message));
  }
}

module.exports = { runGrowwHealthCheck };
