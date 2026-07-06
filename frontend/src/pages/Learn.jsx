import { useState, useEffect } from 'react';
import CandleChart from '../components/CandleChart.jsx';
import {
  startLearnSession, answerLearnChart, completeLearnSession,
  getLearnNudges, dismissLearnNudge, getLearnPatterns,
  submitLearnIntake, getLearnIntake,
} from '../api/index.js';
import styles from './Learn.module.css';

const DETECTION_OPTIONS = ['Yes', 'No', 'Weak'];
const CONFIDENCE_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];

export default function Learn() {
  const [view, setView] = useState('home'); // home | session | results
  const [nudges, setNudges] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [intake, setIntake] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [session, setSession] = useState(null);
  const [charts, setCharts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => { loadHome(); }, []);

  async function loadHome() {
    setLoading(true);
    setError('');
    try {
      const [n, p, i] = await Promise.all([getLearnNudges(), getLearnPatterns(), getLearnIntake()]);
      setNudges(n);
      setPatterns(p);
      setIntake(i.filter(row => !row.first_drilled_at));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function begin(opts) {
    setError('');
    try {
      const data = await startLearnSession(opts);
      setSession(data.session);
      setCharts(data.charts);
      setCurrentIndex(0);
      setResult(null);
      setView('session');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDismissNudge(id) {
    await dismissLearnNudge(id);
    setNudges(ns => ns.filter(n => n.id !== id));
  }

  function onChartAnswered(chartId) {
    setCharts(cs => cs.map(c => (c.id === chartId ? { ...c, answered: true } : c)));
  }

  async function onFinish() {
    try {
      const data = await completeLearnSession(session.id);
      setResult(data);
      setView('results');
    } catch (err) {
      setError(err.message);
    }
  }

  function backToHome() {
    setView('home');
    setSession(null);
    setCharts([]);
    loadHome();
  }

  if (loading) return <div className={styles.page}><p className="muted">Loading…</p></div>;

  return (
    <div className={styles.page}>
      {error && <p className={styles.error}>{error}</p>}

      {view === 'home' && (
        <LearnHome
          nudges={nudges}
          intake={intake}
          patterns={patterns}
          onDismissNudge={onDismissNudge}
          onStartNudge={nudge => begin({ sessionType: 'adaptive', triggeredBy: 'nudge', nudgeId: nudge.id, focusPatterns: nudge.recommended_focus })}
          onStartAdaptive={() => begin({ sessionType: 'adaptive', triggeredBy: 'manual' })}
          onStartIntake={patternSlug => {
            submitLearnIntake(patternSlug, '').catch(() => {});
            begin({ sessionType: 'manual', triggeredBy: 'intake', focusPatterns: [patternSlug] });
          }}
        />
      )}

      {view === 'session' && session && (
        <SessionRunner
          charts={charts}
          currentIndex={currentIndex}
          patterns={patterns}
          onAnswered={onChartAnswered}
          onAdvance={() => setCurrentIndex(i => i + 1)}
          onFinish={onFinish}
        />
      )}

      {view === 'results' && result && (
        <ResultsView result={result} onDone={backToHome} />
      )}
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────

function LearnHome({ nudges, intake, patterns, onDismissNudge, onStartNudge, onStartAdaptive, onStartIntake }) {
  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Learn</h1>
        <p className={styles.subtitle}>Unlabeled charts. Call what you see. Find out what you actually know.</p>
      </div>

      {nudges.length > 0 && (
        <section className={`card ${styles.nudges}`}>
          <div className="section-label">Pending nudges</div>
          {nudges.map(n => (
            <div key={n.id} className={styles.nudgeRow}>
              <span className={styles.nudgeMsg}>{n.message}</span>
              <div className={styles.nudgeActions}>
                <button className="btn btn-primary" onClick={() => onStartNudge(n)}>Start session</button>
                <button className="btn btn-ghost" onClick={() => onDismissNudge(n.id)}>Dismiss</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className={`card ${styles.startCard}`}>
        <div className="section-label">Session</div>
        <p className={styles.startDesc}>10 charts — 3 clean, 3 ambiguous, 2 multi-concept, 2 no-setup. You won't be told what to look for.</p>
        <button className="btn btn-primary" onClick={onStartAdaptive}>Start session</button>
      </section>

      <section className={`card ${styles.intakeCard}`}>
        <div className="section-label">Learn a topic</div>
        <p className={styles.startDesc}>What did you read or watch today? Pick it and the session starts right away.</p>
        <select
          value=""
          onChange={e => { if (e.target.value) onStartIntake(e.target.value); }}
        >
          <option value="">Select a pattern…</option>
          {patterns.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
        </select>
        {intake.length > 0 && (
          <div className={styles.intakeQueue}>
            {intake.map(row => (
              <span key={row.id} className="badge badge-muted">{row.pattern_slug.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ── Session runner ───────────────────────────────────────────────────────────

function SessionRunner({ charts, currentIndex, patterns, onAnswered, onAdvance, onFinish }) {
  const chart = charts[currentIndex];
  const allAnswered = charts.every(c => c.answered);

  if (!chart) {
    return (
      <div className={styles.finishRow}>
        <p className="muted">All 10 charts answered.</p>
        <button className="btn btn-primary" onClick={onFinish} disabled={!allAnswered}>See results</button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.progress}>
        <span>Chart {currentIndex + 1} / {charts.length}</span>
      </div>
      <ChartCall
        key={chart.id}
        chart={chart}
        patterns={patterns}
        onAnswered={() => onAnswered(chart.id)}
        onNext={currentIndex + 1 < charts.length ? onAdvance : onFinish}
        isLast={currentIndex + 1 >= charts.length}
      />
    </div>
  );
}

// No reveal step — scoring is silent per chart. Submitting a call advances
// straight to the next chart (or to the session summary on chart 10).
function ChartCall({ chart, patterns, onAnswered, onNext, isLast }) {
  const [detection, setDetection] = useState(null);
  const [patternSlug, setPatternSlug] = useState('');
  const [confidence, setConfidence] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!detection || !confidence) return;
    setSubmitting(true);
    try {
      await answerLearnChart(chart.id, {
        userDetection: detection.toLowerCase(),
        userPatternSlug: patternSlug || null,
        userConfidence: confidence,
        userNotes: notes,
      });
      onAnswered();
      onNext();
    } catch (err) {
      alert(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.chartCall}>
      <CandleChart candles={chart.ohlcData} showVolume width={480} height={220} />

      <div className={styles.callForm}>
        <div className={styles.callGroup}>
          <span className={styles.callLabel}>Setup present</span>
          <div className={styles.tapRow}>
            {DETECTION_OPTIONS.map(opt => (
              <button key={opt} type="button"
                className={`btn ${detection === opt ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDetection(opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <div className={styles.callGroup}>
          <span className={styles.callLabel}>Pattern type</span>
          <select value={patternSlug} onChange={e => setPatternSlug(e.target.value)}>
            <option value="">Not sure / n-a</option>
            {patterns.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
          </select>
        </div>

        <div className={styles.callGroup}>
          <span className={styles.callLabel}>Confidence</span>
          <div className={styles.tapRow}>
            {CONFIDENCE_OPTIONS.map(opt => (
              <button key={opt} type="button"
                className={`btn ${confidence === opt ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setConfidence(opt)}>{opt}</button>
            ))}
          </div>
        </div>

        <textarea rows={2} placeholder="Optional reasoning notes…" value={notes} onChange={e => setNotes(e.target.value)} />

        <button className="btn btn-primary" onClick={submit} disabled={!detection || !confidence || submitting}>
          {submitting ? <span className="spinner" /> : (isLast ? 'Call it — finish session' : 'Call it')}
        </button>
      </div>
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

function ResultsView({ result, onDone }) {
  const { session, charts } = result;
  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Session results</h1>
      </div>

      <div className={styles.scoreGrid}>
        <ScoreCard label="Detection" value={session.detectionScore} />
        <ScoreCard label="Classification" value={session.classificationScore} />
        <ScoreCard label="Calibration" value={session.calibrationScore} />
      </div>

      {session.aiEvaluation && (
        <section className={`card ${styles.aiEval}`}>
          <div className="section-label">Coaching note</div>
          <p className={styles.aiEvalText}>{session.aiEvaluation}</p>
        </section>
      )}

      <section className={`card ${styles.reviewList}`}>
        <div className="section-label">Chart by chart</div>
        {charts.sort((a, b) => a.chartIndex - b.chartIndex).map(c => (
          <div key={c.id} className={styles.reviewRow}>
            <span className={styles.reviewIndex}>#{c.chartIndex + 1}</span>
            <span className={c.detectionCorrect ? 'teal' : 'danger'}>
              {c.detectionCorrect ? 'Correct' : 'Missed'}
            </span>
            <span className="muted">
              {c.patternPresent ? c.patternSlug?.replace(/_/g, ' ') : 'no setup'} · you said {c.userDetection}
              {c.userPatternSlug ? ` (${c.userPatternSlug.replace(/_/g, ' ')})` : ''} · {c.userConfidence}
            </span>
          </div>
        ))}
      </section>

      <button className="btn btn-primary" onClick={onDone}>Back to Learn</button>
    </div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className={`card ${styles.scoreCard}`}>
      <div className={styles.scoreLabel}>{label}</div>
      <div className={styles.scoreValue}>{value != null ? `${value}%` : '—'}</div>
    </div>
  );
}
