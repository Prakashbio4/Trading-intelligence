'use strict';

// Exponential-backoff retry wrapper. No retry/backoff exists anywhere else
// in this codebase — the flat inter-request delays in fetchOhlc.js and
// backfillHistory.js are throttling, not retry-on-failure.
async function withRetry(fn, { retries = 3, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[retry] attempt ${attempt + 1} failed, retrying in ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
