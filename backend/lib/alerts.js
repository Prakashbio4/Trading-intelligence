'use strict';

const nodemailer = require('nodemailer');

// Central alerting for production failures that would otherwise only ever
// surface in Railway logs nobody is watching — that gap (not any single bug)
// is what let a run of Groww 401s go unnoticed for hours. Every alert-worthy
// condition in this codebase (circuit breaker trips, nightly job failure
// spikes, the synthetic health check) funnels through here, so there's
// exactly one place that owns "how do we actually reach a human."
const ALERT_TO = process.env.ALERT_EMAIL_TO || 'jp@sipy.in';
const ALERT_FROM = process.env.ALERT_EMAIL_FROM || process.env.SMTP_USER;

// The same underlying failure can fire on every one of thousands of symbols
// in a loop (the exact shape of the incident this was built for) — without
// dedupe that's thousands of emails for one root cause. Collapse repeats of
// the same alert to at most one per cooldown window.
const DEDUPE_COOLDOWN_MS = 30 * 60 * 1000;
const _lastSentAt = new Map(); // dedupeKey -> timestamp ms

let _transport;
function getTransport() {
  if (_transport !== undefined) return _transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    _transport = null;
    return _transport;
  }
  _transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transport;
}

// dedupeKey defaults to subject — pass an explicit one when the same
// logical condition can produce a varying subject/body (e.g. per-symbol
// error text) but should still only alert once per cooldown.
async function sendAlert(subject, body, dedupeKey = subject) {
  const now = Date.now();
  const last = _lastSentAt.get(dedupeKey);
  if (last && now - last < DEDUPE_COOLDOWN_MS) return;
  _lastSentAt.set(dedupeKey, now);

  console.error(`[alert] ${subject}: ${body}`);

  const transport = getTransport();
  if (!transport) {
    console.warn('[alerts] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — alert logged only, not emailed');
    return;
  }

  try {
    await transport.sendMail({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `[SIPY Wick] ${subject}`,
      text: body,
    });
  } catch (err) {
    console.error(`[alerts] failed to send alert email: ${err.message}`);
  }
}

module.exports = { sendAlert };
