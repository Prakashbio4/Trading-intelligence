import { useState, useEffect } from 'react';
import styles from './Signals.module.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function authHeaders() {
  const token = localStorage.getItem('sipy_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchSignals(days) {
  const res = await fetch(`${BASE}/journal/signals?days=${days}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchWindow(symbol, date) {
  const res = await fetch(`${BASE}/universe/${symbol}/window?date=${date}&windowSize=7`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Mini candlestick chart ────────────────────────────────────────────────────

function CandleChart({ candles }) {
  if (!candles?.length) return null;

  const W = 320, H = 140, PAD = 16, CANDLE_W = 10;
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toY = p => PAD + ((maxP - p) / range) * (H - PAD * 2);
  const slotW = (W - PAD * 2) / candles.length;

  return (
    <svg width={W} height={H} className={styles.chart}>
      {candles.map((c, i) => {
        const x = PAD + i * slotW + slotW / 2;
        const bullish = c.close >= c.open;
        const color = c.zone === 'pattern' ? '#f59e0b'
          : c.zone === 'today' ? '#6366f1'
          : bullish ? '#22c55e' : '#ef4444';
        const bodyTop    = toY(Math.max(c.open, c.close));
        const bodyBot    = toY(Math.min(c.open, c.close));
        const bodyH      = Math.max(bodyBot - bodyTop, 1);

        return (
          <g key={i}>
            {/* Wick */}
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth={1} />
            {/* Body */}
            <rect x={x - CANDLE_W / 2} y={bodyTop} width={CANDLE_W} height={bodyH}
              fill={bullish ? color : 'transparent'} stroke={color} strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Single signal card ──────────────────────────────────────────────────────

function SignalCard({ signal }) {
  const [candles, setCandles] = useState(null);
  const [open, setOpen]       = useState(false);

  async function toggle() {
    if (!open && !candles) {
      try {
        const data = await fetchWindow(signal.symbol, signal.date);
        setCandles(data);
      } catch (_) { setCandles([]); }
    }
    setOpen(o => !o);
  }

  const biases = [...new Set(signal.patterns.map(p => p.bias))];
  const bullish  = biases.some(b => b?.includes('bullish'));
  const bearish  = biases.some(b => b?.includes('bearish'));
  const sentiment = bullish && bearish ? 'mixed' : bullish ? 'bullish' : 'bearish';

  return (
    <div className={`${styles.card} ${open ? styles.cardOpen : ''}`}>
      <button className={styles.cardHeader} onClick={toggle}>
        <div className={styles.cardLeft}>
          <span className={styles.symbol}>{signal.symbol}</span>
          <span className={styles.date}>{signal.date}</span>
        </div>
        <div className={styles.cardRight}>
          <span className={`${styles.sentiment} ${styles[sentiment]}`}>{sentiment}</span>
          <span className={styles.patternCount}>{signal.patterns.length} pattern{signal.patterns.length > 1 ? 's' : ''}</span>
          <span className={styles.close}>₹{Number(signal.close).toFixed(2)}</span>
          <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className={styles.cardBody}>
          <div className={styles.patterns}>
            {signal.patterns.map((p, i) => (
              <div key={i} className={styles.patternRow}>
                <span className={styles.patternName}>{p.name}</span>
                <span className={`${styles.biasBadge} ${p.bias?.includes('bullish') ? styles.bull : styles.bear}`}>
                  {p.bias?.replace('_', ' ')}
                </span>
                <span className={styles.patternDates}>{p.startDate} → {p.completionDate}</span>
                {p.trend && (
                  <span className={styles.patternContext}>
                    {p.trend} prior trend · {p.volumeRatio}x avg volume · {p.srDistancePct}% from S&amp;R
                  </span>
                )}
                {p.levels && (
                  <span className={styles.patternContext}>
                    Entry ₹{p.levels.entry} · SL ₹{p.levels.sl} · Target ₹{p.levels.target}
                  </span>
                )}
              </div>
            ))}
          </div>
          {candles === null
            ? <p className={styles.loading}>Loading chart…</p>
            : <CandleChart candles={candles} />
          }
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Signals() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [days,    setDays]    = useState(3);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchSignals(days)
      .then(setSignals)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Signals</h1>
          <p className={styles.sub}>Your universe, scanned daily for candle + prior trend + volume + S&amp;R</p>
        </div>
        <select className={styles.daysSelect} value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={3}>Last 3 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error   && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.loading}>Loading…</p>}

      {!loading && !error && (
        <>
          <p className={styles.count}>{signals.length} signal{signals.length !== 1 ? 's' : ''}</p>
          <div className={styles.list}>
            {signals.length === 0
              ? <p className={styles.empty}>No signals right now — nothing in your universe meets the checklist.</p>
              : signals.map(s => <SignalCard key={`${s.symbol}|${s.date}`} signal={s} />)
            }
          </div>
        </>
      )}
    </div>
  );
}
