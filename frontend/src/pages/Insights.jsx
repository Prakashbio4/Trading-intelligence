import { useState, useEffect } from 'react';
import ChatPanel from '../components/ChatPanel.jsx';
import styles from './Insights.module.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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

  useEffect(() => {
    fetch(`${BASE}/journal/insights-context`)
      .then(r => r.json())
      .then(data => { setContext(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
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

    </div>
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
      const res = await fetch(`${BASE}/journal/insights-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
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
