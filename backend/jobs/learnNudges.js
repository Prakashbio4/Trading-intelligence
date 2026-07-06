'use strict';

// Nudge scan — pure threshold logic, no AI call, same cron pattern as the
// OHLC/outcome jobs. Reads recent journal + Learn activity per user, flags
// the top pattern gaps, and writes them to learn_nudges. Also migrates
// Track 2 (reading-anchored) intake patterns to Track 1 once they show up
// in a real journal session.

const supabase = require('../lib/supabase');

const MIN_SAMPLE = 3;
const DETECTION_RATE_THRESHOLD = 60;
const FALSE_POSITIVE_RATE_THRESHOLD = 30;
const HIGH_CONF_WRONG_RATE_THRESHOLD = 25;
const MAX_NUDGES_PER_RUN = 3;

async function getActiveUserIds() {
  const { data, error } = await supabase.from('learn_charts').select('user_id');
  if (error) throw error;
  return [...new Set((data || []).map(r => r.user_id))];
}

async function scanUser(userId) {
  const { data: performance, error: perfErr } = await supabase
    .from('learn_pattern_performance').select('*').eq('user_id', userId);
  if (perfErr) throw perfErr;

  const { data: calibration, error: calErr } = await supabase
    .from('learn_calibration').select('*').eq('user_id', userId).eq('user_confidence', 'HIGH');
  if (calErr) throw calErr;

  const { data: existingNudges, error: nudgeErr } = await supabase
    .from('learn_nudges').select('trigger_type, pattern_slug').eq('user_id', userId).eq('status', 'pending');
  if (nudgeErr) throw nudgeErr;
  const alreadyPending = new Set((existingNudges || []).map(n => `${n.trigger_type}:${n.pattern_slug || ''}`));

  const candidates = [];

  for (const row of performance || []) {
    if (row.total_present >= MIN_SAMPLE && row.detection_rate_pct != null && row.detection_rate_pct < DETECTION_RATE_THRESHOLD) {
      if (!alreadyPending.has(`detection_gap:${row.pattern_slug}`)) {
        candidates.push({
          triggerType: 'detection_gap',
          patternSlug: row.pattern_slug,
          metricName: 'detection_rate_pct',
          metricValue: row.detection_rate_pct,
          thresholdValue: DETECTION_RATE_THRESHOLD,
          severity: DETECTION_RATE_THRESHOLD - row.detection_rate_pct,
          message: `Your detection rate on ${row.display_name} is ${row.detection_rate_pct}% — below the 60% bar. Worth a focused drill.`,
          recommendedFocus: [row.pattern_slug],
        });
      }
    }

    const absentCount = row.total_exposures - row.total_present;
    if (absentCount >= MIN_SAMPLE && row.false_positive_rate_pct != null && row.false_positive_rate_pct > FALSE_POSITIVE_RATE_THRESHOLD) {
      if (!alreadyPending.has(`false_positive:${row.pattern_slug}`)) {
        candidates.push({
          triggerType: 'false_positive',
          patternSlug: row.pattern_slug,
          metricName: 'false_positive_rate_pct',
          metricValue: row.false_positive_rate_pct,
          thresholdValue: FALSE_POSITIVE_RATE_THRESHOLD,
          severity: row.false_positive_rate_pct - FALSE_POSITIVE_RATE_THRESHOLD,
          message: `You're calling ${row.display_name} on charts where it isn't there ${row.false_positive_rate_pct}% of the time. Try more no-setup reps.`,
          recommendedFocus: [row.pattern_slug],
        });
      }
    }
  }

  const highConf = calibration?.[0];
  if (highConf && highConf.total_calls >= MIN_SAMPLE) {
    const wrongRatePct = 100 - highConf.accuracy_pct;
    if (wrongRatePct > HIGH_CONF_WRONG_RATE_THRESHOLD && !alreadyPending.has('high_confidence_wrong:')) {
      const weakestPatterns = (performance || [])
        .filter(r => r.detection_rate_pct != null)
        .sort((a, b) => a.detection_rate_pct - b.detection_rate_pct)
        .slice(0, 2)
        .map(r => r.pattern_slug);
      candidates.push({
        triggerType: 'high_confidence_wrong',
        patternSlug: null,
        metricName: 'high_confidence_wrong_rate_pct',
        metricValue: Math.round(wrongRatePct * 10) / 10,
        thresholdValue: HIGH_CONF_WRONG_RATE_THRESHOLD,
        severity: wrongRatePct - HIGH_CONF_WRONG_RATE_THRESHOLD,
        message: `${Math.round(wrongRatePct)}% of your HIGH-confidence calls were wrong — your conviction isn't tracking your accuracy.`,
        recommendedFocus: weakestPatterns,
      });
    }
  }

  candidates.sort((a, b) => b.severity - a.severity);
  const top = candidates.slice(0, MAX_NUDGES_PER_RUN);

  for (const c of top) {
    const { error } = await supabase.from('learn_nudges').insert({
      user_id: userId,
      trigger_type: c.triggerType,
      pattern_slug: c.patternSlug,
      metric_name: c.metricName,
      metric_value: c.metricValue,
      threshold_value: c.thresholdValue,
      message: c.message,
      recommended_focus: c.recommendedFocus,
    });
    if (error) console.error(`[learn-nudges] Failed to write nudge for ${userId}:`, error.message);
  }

  return top.length;
}

// Track 2 → Track 1 migration: once a pattern the user queued from reading
// shows up in a real journal session, it's no longer purely hypothetical.
async function migrateIntake(userId) {
  const { data: pending, error } = await supabase
    .from('learn_intake').select('*, learn_patterns(display_name)').eq('user_id', userId).is('migrated_to_track1_at', null);
  if (error || !pending?.length) return 0;

  const { data: journalRows } = await supabase
    .from('journal_sessions').select('ai_what_i_see').eq('user_id', userId).not('ai_what_i_see', 'is', null);
  const journalPatternNames = new Set(
    (journalRows || [])
      .map(r => r.ai_what_i_see?.candlePattern?.name)
      .filter(Boolean)
      .map(n => n.toLowerCase().replace(/\s+/g, '_'))
  );

  let migrated = 0;
  for (const row of pending) {
    if (journalPatternNames.has(row.pattern_slug)) {
      const { error: updateErr } = await supabase
        .from('learn_intake').update({ migrated_to_track1_at: new Date().toISOString() }).eq('id', row.id);
      if (!updateErr) migrated++;
    }
  }
  return migrated;
}

async function runLearnNudges() {
  const userIds = await getActiveUserIds();
  let nudgesWritten = 0;
  let migrations = 0;

  for (const userId of userIds) {
    try {
      nudgesWritten += await scanUser(userId);
      migrations += await migrateIntake(userId);
    } catch (err) {
      console.error(`[learn-nudges] Scan failed for user ${userId}:`, err.message);
    }
  }

  console.log(`[learn-nudges] Scanned ${userIds.length} user(s) — ${nudgesWritten} nudge(s) written, ${migrations} Track 2 → Track 1 migration(s).`);
  return { usersScanned: userIds.length, nudgesWritten, migrations };
}

module.exports = { runLearnNudges };
