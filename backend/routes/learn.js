const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const { composeSession } = require('../lib/learn/sessionComposer');
const { scoreChart, scoreSession } = require('../lib/learn/scoring');
const { evaluateSession } = require('../lib/learn/aiEvaluation');

const router = express.Router();

// ── Conversion helpers ────────────────────────────────────────────────────────

function chartToRow(chart, sessionId, userId) {
  return {
    session_id: sessionId,
    user_id: userId,
    chart_index: chart.chartIndex,
    chart_type: chart.chartType,
    pattern_slug: chart.patternSlug,
    pattern_present: chart.patternPresent,
    clarity_level: chart.clarityLevel,
    trend_context: chart.trendContext,
    volume_character: chart.volumeCharacter,
    sr_proximity: chart.srProximity,
    outcome_direction: chart.outcomeDirection,
    ohlc_data: chart.ohlcData,
    sr_levels: chart.srLevels,
    volume_data: chart.volumeData,
  };
}

// What the client may see BEFORE answering — ground truth (pattern identity,
// clarity, chart type, outcome, S/R annotation) is withheld entirely. The
// user reads the raw candles/volume just like a real chart.
function chartToClientPreAnswer(row) {
  const visibleCandles = row.ohlc_data.filter(c => c.zone !== 'outcome');
  const visibleDates = new Set(visibleCandles.map(c => c.date));
  return {
    id: row.id,
    chartIndex: row.chart_index,
    ohlcData: visibleCandles,
    volumeData: row.volume_data.filter(v => visibleDates.has(v.date)),
    answered: !!row.answered_at,
  };
}

function chartToClientPostAnswer(row) {
  return {
    id: row.id,
    chartIndex: row.chart_index,
    outcomeCandles: row.ohlc_data.filter(c => c.zone === 'outcome'),
    srLevels: row.sr_levels,
  };
}

// Full reveal — used once the whole session is complete, for the review screen.
function chartToClientReview(row) {
  return {
    id: row.id,
    chartIndex: row.chart_index,
    chartType: row.chart_type,
    patternSlug: row.pattern_slug,
    patternPresent: row.pattern_present,
    clarityLevel: row.clarity_level,
    trendContext: row.trend_context,
    volumeCharacter: row.volume_character,
    srProximity: row.sr_proximity,
    outcomeDirection: row.outcome_direction,
    ohlcData: row.ohlc_data,
    srLevels: row.sr_levels,
    volumeData: row.volume_data,
    userDetection: row.user_detection,
    userPatternSlug: row.user_pattern_slug,
    userConfidence: row.user_confidence,
    userNotes: row.user_notes,
    detectionCorrect: row.detection_correct,
    classificationCorrect: row.classification_correct,
    confidenceAppropriate: row.confidence_appropriate,
  };
}

function sessionToClient(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    sessionType: row.session_type,
    focusPatterns: row.focus_patterns,
    chartCount: row.chart_count,
    triggeredBy: row.triggered_by,
    nudgeId: row.nudge_id,
    detectionScore: row.detection_score,
    classificationScore: row.classification_score,
    calibrationScore: row.calibration_score,
    falsePositiveCount: row.false_positive_count,
    highConfidenceWrongCount: row.high_confidence_wrong_count,
    aiEvaluation: row.ai_evaluation,
    aiEvaluationAt: row.ai_evaluation_at,
  };
}

// Resolves which patterns a new adaptive session should weight toward:
// an explicit pending nudge first, then undrilled Track 2 concept intake.
async function resolveFocusPatterns(userId) {
  const { data: nudge } = await supabase
    .from('learn_nudges')
    .select('recommended_focus')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nudge?.recommended_focus?.length) return nudge.recommended_focus;

  const { data: intake } = await supabase
    .from('learn_intake')
    .select('pattern_slug')
    .eq('user_id', userId)
    .is('first_drilled_at', null)
    .order('created_at', { ascending: true })
    .limit(5);
  if (intake?.length) return intake.map(r => r.pattern_slug);

  return [];
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /learn/sessions — start a new 10-chart session
router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    const { sessionType = 'adaptive', triggeredBy = 'manual', nudgeId = null, focusPatterns: explicitFocus } = req.body || {};

    const focusPatterns = explicitFocus?.length
      ? explicitFocus
      : (sessionType === 'adaptive' ? await resolveFocusPatterns(req.user.userId) : []);

    const charts = composeSession({ focusPatterns });

    const { data: session, error: sessionErr } = await supabase
      .from('learn_sessions')
      .insert({
        user_id: req.user.userId,
        session_type: sessionType,
        focus_patterns: focusPatterns,
        chart_count: charts.length,
        triggered_by: triggeredBy,
        nudge_id: nudgeId,
      })
      .select()
      .single();
    if (sessionErr) throw sessionErr;

    const chartRows = charts.map(c => chartToRow(c, session.id, req.user.userId));
    const { data: insertedCharts, error: chartsErr } = await supabase
      .from('learn_charts')
      .insert(chartRows)
      .select();
    if (chartsErr) throw chartsErr;

    if (nudgeId) {
      await supabase.from('learn_nudges').update({ acted_on_at: new Date().toISOString(), resulting_session_id: session.id, status: 'acted_on' }).eq('id', nudgeId);
    }

    insertedCharts.sort((a, b) => a.chart_index - b.chart_index);
    res.json({
      session: sessionToClient(session),
      charts: insertedCharts.map(chartToClientPreAnswer),
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not start session', detail: err.message });
  }
});

// GET /learn/sessions/:id — session status + charts (ground truth only once complete)
router.get('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from('learn_sessions').select('*').eq('id', req.params.id).maybeSingle();
    if (sessionErr) throw sessionErr;
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'superuser' && session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: chartRows, error: chartsErr } = await supabase
      .from('learn_charts').select('*').eq('session_id', session.id).order('chart_index');
    if (chartsErr) throw chartsErr;

    const charts = session.completed_at
      ? chartRows.map(chartToClientReview)
      : chartRows.map(row => row.answered_at ? { ...chartToClientPreAnswer(row), ...chartToClientPostAnswer(row) } : chartToClientPreAnswer(row));

    res.json({ session: sessionToClient(session), charts });
  } catch (err) {
    res.status(500).json({ error: 'Could not load session', detail: err.message });
  }
});

// POST /learn/charts/:id/answer — submit the 3-tap call + notes, get the outcome reveal
router.post('/charts/:id/answer', authMiddleware, async (req, res) => {
  try {
    const { userDetection, userPatternSlug = null, userConfidence, userNotes = '', userConceptsNoted = [] } = req.body || {};
    if (!['yes', 'no', 'weak'].includes(userDetection)) return res.status(400).json({ error: 'userDetection must be yes/no/weak' });
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(userConfidence)) return res.status(400).json({ error: 'userConfidence must be LOW/MEDIUM/HIGH' });

    const { data: chart, error: fetchErr } = await supabase
      .from('learn_charts').select('*').eq('id', req.params.id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!chart) return res.status(404).json({ error: 'Chart not found' });
    if (req.user.role !== 'superuser' && chart.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (chart.answered_at) return res.status(400).json({ error: 'Chart already answered' });

    const { detectionCorrect, classificationCorrect, confidenceAppropriate } = scoreChart(
      { patternPresent: chart.pattern_present, patternSlug: chart.pattern_slug, chartType: chart.chart_type },
      { userDetection, userPatternSlug, userConfidence },
    );

    const { data: updated, error: updateErr } = await supabase
      .from('learn_charts')
      .update({
        user_detection: userDetection,
        user_pattern_slug: userPatternSlug,
        user_confidence: userConfidence,
        user_notes: userNotes,
        user_concepts_noted: userConceptsNoted,
        answered_at: new Date().toISOString(),
        detection_correct: detectionCorrect,
        classification_correct: classificationCorrect,
        confidence_appropriate: confidenceAppropriate,
      })
      .eq('id', chart.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    res.json(chartToClientPostAnswer(updated));
  } catch (err) {
    res.status(500).json({ error: 'Could not submit answer', detail: err.message });
  }
});

// POST /learn/sessions/:id/complete — score the session and trigger the one AI coaching call
router.post('/sessions/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from('learn_sessions').select('*').eq('id', req.params.id).maybeSingle();
    if (sessionErr) throw sessionErr;
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.user.role !== 'superuser' && session.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (session.completed_at) return res.status(400).json({ error: 'Session already completed' });

    const { data: charts, error: chartsErr } = await supabase
      .from('learn_charts').select('*').eq('session_id', session.id).order('chart_index');
    if (chartsErr) throw chartsErr;
    if (charts.some(c => !c.answered_at)) return res.status(400).json({ error: 'All 10 charts must be answered before completing' });

    const scores = scoreSession(charts);
    let aiEvaluation = null;
    try {
      aiEvaluation = await evaluateSession(charts);
    } catch (aiErr) {
      console.error('[learn] AI evaluation failed:', aiErr.message);
    }

    const { data: updatedSession, error: updateErr } = await supabase
      .from('learn_sessions')
      .update({
        completed_at: new Date().toISOString(),
        detection_score: scores.detectionScore,
        classification_score: scores.classificationScore,
        calibration_score: scores.calibrationScore,
        false_positive_count: scores.falsePositiveCount,
        high_confidence_wrong_count: scores.highConfidenceWrongCount,
        ai_evaluation: aiEvaluation,
        ai_evaluation_at: aiEvaluation ? new Date().toISOString() : null,
      })
      .eq('id', session.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    await bumpIntakeDrillCounts(req.user.userId, charts);

    res.json({ session: sessionToClient(updatedSession), charts: charts.sort((a, b) => a.chart_index - b.chart_index).map(chartToClientReview) });
  } catch (err) {
    res.status(500).json({ error: 'Could not complete session', detail: err.message });
  }
});

async function bumpIntakeDrillCounts(userId, charts) {
  const slugs = [...new Set(charts.filter(c => c.pattern_slug).map(c => c.pattern_slug))];
  if (!slugs.length) return;
  const { data: rows } = await supabase
    .from('learn_intake').select('*').eq('user_id', userId).in('pattern_slug', slugs);
  for (const row of rows || []) {
    await supabase.from('learn_intake').update({
      drill_count: row.drill_count + 1,
      first_drilled_at: row.first_drilled_at || new Date().toISOString(),
    }).eq('id', row.id);
  }
}

// ── Nudges ───────────────────────────────────────────────────────────────────

// GET /learn/nudges — pending nudges, most recent first
router.get('/nudges', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('learn_nudges')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not load nudges', detail: err.message });
  }
});

// POST /learn/nudges/:id/dismiss
router.post('/nudges/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const { data: nudge, error: fetchErr } = await supabase
      .from('learn_nudges').select('user_id').eq('id', req.params.id).maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!nudge) return res.status(404).json({ error: 'Nudge not found' });
    if (req.user.role !== 'superuser' && nudge.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { error } = await supabase
      .from('learn_nudges')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not dismiss nudge', detail: err.message });
  }
});

// ── Track 2 — concept intake ─────────────────────────────────────────────────

// POST /learn/intake — "what did you read or watch today?"
router.post('/intake', authMiddleware, async (req, res) => {
  try {
    const { patternSlug, sourceNote = '' } = req.body || {};
    if (!patternSlug) return res.status(400).json({ error: 'patternSlug is required' });

    const { data, error } = await supabase
      .from('learn_intake')
      .insert({ user_id: req.user.userId, pattern_slug: patternSlug, source_note: sourceNote })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not log intake', detail: err.message });
  }
});

// GET /learn/intake — undrilled Track 2 queue
router.get('/intake', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('learn_intake')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not load intake queue', detail: err.message });
  }
});

// ── Pattern library ──────────────────────────────────────────────────────────

// GET /learn/patterns — for the pattern-type tag picker in the UI
router.get('/patterns', authMiddleware, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('learn_patterns').select('*').order('category').order('display_name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Could not load pattern library', detail: err.message });
  }
});

// ── Insights panels — direct view reads, no AI ──────────────────────────────

// GET /learn/insights
router.get('/insights', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [performance, calibration, bridge] = await Promise.all([
      supabase.from('learn_pattern_performance').select('*').eq('user_id', userId),
      supabase.from('learn_calibration').select('*').eq('user_id', userId),
      supabase.from('learn_journal_bridge').select('*').eq('user_id', userId),
    ]);
    if (performance.error) throw performance.error;
    if (calibration.error) throw calibration.error;
    if (bridge.error) throw bridge.error;

    res.json({
      patternPerformance: performance.data,
      calibration: calibration.data,
      journalBridge: bridge.data,
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load learn insights', detail: err.message });
  }
});

module.exports = router;
