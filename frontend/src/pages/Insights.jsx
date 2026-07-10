import { useState, useEffect } from 'react';
import ChatPanel from '../components/ChatPanel.jsx';
import { getLearnInsights, getInsightsContext, sendInsightsChat } from '../api/index.js';
import styles from './Insights.module.css';

const UNLOCK_AT = 20;

const PLACEHOLDER_CARDS = [
  { label: 'Agreement rate',   desc: 'How often your read matches the AI across all fields' },
  { label: 'Strongest pattern', desc: 'The pattern you identify most accurately and consistently' },
  { label: 'Biggest gap area',  desc: 'The field where your read diverges most from the AI' },
  { label: 'AI accuracy',       desc: 'How often the AI verdict aligned with what actually happened' },
];

export default function Insights() {
  const [context, setContext]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);
  const [learn,   setLearn]     = useState(null);

  useEffect(() => {
    getInsightsContext()
      .then(data => { setContext(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
    getLearnInsights().then(setLearn).catch(() => {});
  }, []);

  const total    = context?.total ?? 0;
  const unlocked = total >= UNLOCK_AT;

  // Build a minimal session-like object so ChatPanel can call POST /journal/:id/chat
  // For Insights we use a special sentinel ID; the backend uses insights-context instead.
  // We skip ChatPanel for now and use a direct fetch — see InsightsChat below.

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Insights</h1>
        <p className={styles.subtitle}>
          Aggregated learning across all your sessions. Unlocks at {UNLOCK_AT} entries.
        </p>
      </div>

      {/* ── Chat with AI ── always visible */}
      <section className={`card ${styles.chatSection}`}>
        <div className="section-label">Ask about your patterns</div>
        {loading ? (
          <div className={styles.loadingRow}><span className="spinner" /> Loading context…</div>
        ) : error ? (
          <div className={styles.error}>Could not load journal context: {error}</div>
        ) : (
          <InsightsChat context={context} />
        )}
      </section>

      {/* ── Session count ── */}
      <div className={styles.countRow}>
        <span className={styles.countNum}>{total}</span>
        <span className={styles.countLabel}>
          {total === 1 ? 'session logged' : 'sessions logged'}
        </span>
        {!unlocked && (
          <span className={styles.countHint}>
            · Insights unlock at {UNLOCK_AT}
            <span className={styles.progressBar}>
              <span className={styles.progressFill} style={{ width: `${Math.min((total / UNLOCK_AT) * 100, 100)}%` }} />
            </span>
            {UNLOCK_AT - total} to go
          </span>
        )}
      </div>

      {/* ── Metric cards ── */}
      <div className={styles.cardGrid}>
        {PLACEHOLDER_CARDS.map(card => (
          <div key={card.label} className={`${styles.metricCard} ${unlocked ? styles.metricActive : styles.metricLocked}`}>
            <div className={styles.metricLabel}>{card.label}</div>
            {unlocked ? (
              <div className={styles.metricValue}>—</div>
            ) : (
              <>
                <div className={styles.metricPlaceholder} />
                <div className={styles.metricPlaceholder} style={{ width: '60%' }} />
                <p className={styles.metricDesc}>{card.desc}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Learn module panels ── */}
      {learn && (
        <>
          <LearnPerformancePanel rows={learn.patternPerformance} />
          <CalibrationPanel rows={learn.calibration} />
          <JournalBridgePanel rows={learn.journalBridge} />
        </>
      )}

    </div>
  );
}

// ── Learn performance panel — direct read from learn_pattern_performance, no AI ──

function LearnPerformancePanel({ rows }) {
  const ranked = [...(rows || [])].sort((a, b) => (a.detection_rate_pct ?? 0) - (b.detection_rate_pct ?? 0));
  return (
    <section className={`card ${styles.learnPanel}`}>
      <div className="section-label">Learn — pattern performance</div>
      {!ranked.length ? (
        <p className="muted">No Learn sessions yet — patterns you drill will show up here.</p>
      ) : (
        <div className={styles.learnTable}>
          {ranked.map(r => (
            <div key={r.pattern_slug} className={styles.learnRow}>
              <span className={styles.learnPatternName}>{r.display_name}</span>
              <span className={r.detection_rate_pct >= 70 ? 'teal' : r.detection_rate_pct >= 50 ? 'amber' : 'danger'}>
                {r.detection_rate_pct != null ? `${r.detection_rate_pct}% detection` : '—'}
              </span>
              <span className="muted">{r.false_positive_rate_pct != null ? `${r.false_positive_rate_pct}% false positive` : ''}</span>
              <span className="muted">{r.total_exposures} exposures</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Calibration curve — accuracy by confidence bucket ───────────────────────

function CalibrationPanel({ rows }) {
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  const sorted = [...(rows || [])].sort((a, b) => order[a.user_confidence] - order[b.user_confidence]);
  return (
    <section className={`card ${styles.learnPanel}`}>
      <div className="section-label">Confidence calibration</div>
      {!sorted.length ? (
        <p className="muted">Answer enough Learn charts to see whether your confidence tracks your accuracy.</p>
      ) : (
        <div className={styles.calibrationBars}>
          {sorted.map(r => (
            <div key={r.user_confidence} className={styles.calibrationRow}>
              <span className={styles.calibrationLabel}>{r.user_confidence}</span>
              <div className={styles.calibrationTrack}>
                <div
                  className={styles.calibrationFill}
                  style={{
                    width: `${r.accuracy_pct}%`,
                    background: r.user_confidence === 'HIGH' && r.accuracy_pct < 60 ? 'var(--danger)' : 'var(--accent)',
                  }}
                />
              </div>
              <span className="muted">{r.accuracy_pct}% accurate ({r.total_calls})</span>
            </div>
          ))}
          {sorted.some(r => r.user_confidence === 'HIGH' && r.accuracy_pct < 60) && (
            <p className={styles.calibrationWarning}>
              HIGH confidence is landing near a coin flip — your conviction isn't tracking your accuracy yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Journal ↔ Learn bridge — conviction gap vs recognition gap, no AI ───────

function JournalBridgePanel({ rows }) {
  const flagged = (rows || []).filter(r => r.diagnostic === 'conviction_gap' || r.diagnostic === 'recognition_gap');
  return (
    <section className={`card ${styles.learnPanel}`}>
      <div className="section-label">Journal ↔ Learn diagnostic</div>
      {!flagged.length ? (
        <p className="muted">No conviction or recognition gaps detected yet.</p>
      ) : (
        <div className={styles.learnTable}>
          {flagged.map(r => (
            <div key={r.pattern_name} className={styles.learnRow}>
              <span className={styles.learnPatternName}>{r.pattern_name}</span>
              <span className={`badge ${r.diagnostic === 'conviction_gap' ? 'badge-amber' : 'badge-red'}`}>
                {r.diagnostic === 'conviction_gap' ? 'Conviction gap' : 'Recognition gap'}
              </span>
              <span className="muted">
                {r.diagnostic === 'conviction_gap'
                  ? `You detect it ${r.learn_detection_rate_pct}% of the time but only act on it ${r.journal_action_rate_pct}% of the time`
                  : `Detection rate ${r.learn_detection_rate_pct}% but it's appeared in ${r.journal_encounters} journal sessions — drill it`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Insights chat — direct fetch, no session ID needed ────────────────────────

function InsightsChat({ context }) {
  const [history, setHistory] = useState([]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const suggestions = [
    'What is my biggest gap area?',
    'Which patterns have I identified correctly?',
    'Where does my read consistently differ from the AI?',
  ];

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError(null);
    setLoading(true);

    const optimistic = { role: 'user', content: text };
    setHistory(h => [...h, optimistic]);

    try {
      const data = await sendInsightsChat(text, context, history);
      setHistory(h => [...h, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message);
      setHistory(h => h.filter(m => m !== optimistic));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className={styles.chat}>
      <div className={styles.messages}>
        {history.length === 0 && (
          <div className={styles.emptySuggestions}>
            {suggestions.map(s => (
              <button key={s} className={styles.suggestion} onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgAI}`}>
            <span className={styles.msgWho}>{m.role === 'user' ? 'You' : 'AI'}</span>
            <p className={styles.msgText}>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.msgAI}`}>
            <span className={styles.msgWho}>AI</span>
            <span className={styles.typing}><span /><span /><span /></span>
          </div>
        )}
        {error && <div className={styles.chatError}>{error}</div>}
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your patterns across sessions… (Enter to send)"
          rows={2}
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
          {loading ? <span className="spinner" /> : '↑'}
        </button>
      </div>
    </div>
  );
}
