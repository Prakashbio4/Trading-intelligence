import { useState, useEffect } from 'react';
import { getSessions, updateSession } from '../api/index.js';
import ChatPanel from '../components/ChatPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import styles from './Journal.module.css';

const VERDICT_CLASS = {
  TRADE: 'badge-green', TAKE: 'badge-green',
  PASS: 'badge-red',  SKIP: 'badge-red', NO_TRADE: 'badge-red',
  CONDITIONAL: 'badge-amber', WATCH: 'badge-amber',
  LEARN: 'badge-muted',
};
const OUTCOME_CLASS = { Win: 'badge-green', Loss: 'badge-red', Open: 'badge-teal', Skip: 'badge-muted' };
const CONF_CLASS    = { HIGH: 'badge-green', MEDIUM: 'badge-amber', LOW: 'badge-red' };

function lvl(item) {
  if (item == null) return null;
  if (typeof item === 'object') return item.level ?? item.price ?? item.value ?? String(Object.values(item)[0]);
  return item;
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
function mono(v) { return v != null ? <span className="mono">{v}</span> : null; }

// ── Shared tiny components ────────────────────────────────────────────────────

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoKey}>{label}</span>
      <span className={styles.infoVal}>{value}</span>
    </div>
  );
}

function SectionHead({ children }) {
  return <div className={styles.sectionHead}>{children}</div>;
}

function ConfBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${CONF_CLASS[value] ?? 'badge-muted'}`}>{value}</span>;
}

// ── Unified YourRead ──────────────────────────────────────────────────────────
// Reads from formData (new sessions) with fallback to userInput (legacy)

function YourRead({ session }) {
  const f = session.formData || session.userInput || {};

  const trend     = f.primaryTrend   || f.trend;
  const duration  = f.trendDuration;
  const phase     = f.stockPhase;
  const structure = f.chartStructure;
  const opposing  = f.opposingStructure;
  const pattern   = f.candlePattern;
  const pDir      = f.patternDirection;
  const pQual     = f.patternQuality;
  const pPrior    = f.priorTrendMatch;
  const volAvg    = f.volumeVsAverage || f.volumeVsAvg;
  const volChar   = f.volumeCharacter;
  const macd      = f.macd;
  const rsi       = f.rsiValue ? `${f.rsiValue} — ${f.rsiDirection || ''}` : f.rsiDirection;
  const bb        = f.bollingerBands;
  const sup       = f.nearestSupport  || f.supportLevel;
  const res       = f.nearestResistance || f.resistanceLevel;
  const srConf    = f.srConfidence;
  const narrative = f.narrative || f.notes;

  return (
    <div className={styles.block}>
      <SectionHead>Your Read</SectionHead>

      <div className={styles.infoGroup}>
        <Row label="Trend"      value={trend} />
        <Row label="Duration"   value={duration} />
        <Row label="Phase"      value={phase} />
        <Row label="Structure"  value={structure} />
        <Row label="Opposing"   value={opposing} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Pattern"    value={pattern} />
        <Row label="Direction"  value={pDir} />
        <Row label="Quality"    value={pQual} />
        <Row label="Prior trend" value={pPrior} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Volume"     value={volAvg} />
        <Row label="Vol char."  value={volChar} />
        <Row label="MACD"       value={macd} />
        <Row label="RSI"        value={rsi ? mono(rsi) : null} />
        <Row label="Bollinger"  value={bb} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Support"    value={sup    ? mono(`₹${sup}`)  : null} />
        <Row label="Resistance" value={res    ? mono(`₹${res}`)  : null} />
        <Row label="S&R conf."  value={srConf} />
      </div>

      {narrative && (
        <div className={styles.narrativeBlock}>
          <span className={styles.infoKey}>Narrative</span>
          <p className={styles.narrativeText}>{narrative}</p>
        </div>
      )}

      {/* Decision chip for unified sessions */}
      {session.decision && (
        <div className={styles.decisionChips}>
          <span className={`badge ${
            session.decision === 'Take' ? 'badge-green' :
            session.decision === 'Skip' ? 'badge-red' : 'badge-amber'
          }`}>{session.decision.toUpperCase()}</span>
          {session.confidence && (
            <span className={`badge badge-muted`}>{session.confidence} confidence</span>
          )}
        </div>
      )}

      {/* Planned levels for TAKE sessions */}
      {session.decision === 'Take' && session.plannedEntry != null && (
        <div className={styles.plannedLevels}>
          <span className={styles.infoKey} style={{ display: 'block', marginBottom: 8 }}>Planned levels (locked)</span>
          <div className={styles.levelCells}>
            <div className={styles.levelCell}>
              <span className={styles.levelKey}>Entry</span>
              <span className="mono">₹{session.plannedEntry}</span>
            </div>
            <div className={styles.levelCell}>
              <span className={styles.levelKey}>SL</span>
              <span className="mono danger">₹{session.plannedSL}</span>
            </div>
            <div className={styles.levelCell}>
              <span className={styles.levelKey}>Target</span>
              <span className="mono accent">₹{session.plannedTarget}</span>
            </div>
            {session.plannedRRR != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>RRR</span>
                <span className={`mono ${session.plannedRRR >= 1.5 ? 'accent' : 'danger'}`}>
                  {session.plannedRRR}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Unified AIRead ────────────────────────────────────────────────────────────
// Shows 4-section response for new sessions, falls back to legacy display

function AIRead({ session }) {
  // New unified sessions
  if (session.aiWhatISee) {
    return <AIReadUnified session={session} />;
  }
  // Legacy module 1
  if (session.module === '1' && session.aiAnalysis) {
    return <AIReadLegacyM1 aiAnalysis={session.aiAnalysis} />;
  }
  // Legacy module 3
  if (session.module === '3' && session.aiAnalysis) {
    return <AIReadLegacyM3 aiAnalysis={session.aiAnalysis} />;
  }
  return null;
}

function AIReadUnified({ session }) {
  const { aiWhatISee: w, aiNarrative: n, aiDecision: d, aiCorrections: c = [] } = session;

  return (
    <div className={styles.aiCols}>
      {/* Left column: What I See + Narrative */}
      <div className={styles.aiCol}>

      {/* What I See */}
      {w && (
        <div className={styles.block}>
          <SectionHead>What the AI Saw</SectionHead>
          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Trend</span>
              <span className={styles.infoVal}>{w.trend?.direction}</span>
              <ConfBadge value={w.trend?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Structure</span>
              <span className={styles.infoVal}>{w.chartStructure?.pattern || '—'}</span>
              <ConfBadge value={w.chartStructure?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Pattern</span>
              <span className={styles.infoVal}>{w.candlePattern?.name || 'No pattern'}</span>
              <ConfBadge value={w.candlePattern?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Volume</span>
              <span className={styles.infoVal}>{w.volume?.vsAverage}</span>
              <ConfBadge value={w.volume?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>MACD</span>
              <span className={styles.infoVal}>{w.macd?.status}</span>
              <ConfBadge value={w.macd?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>RSI</span>
              <span className={`${styles.infoVal} mono`}>
                {w.rsi?.value != null ? `${w.rsi.value}  ` : ''}{w.rsi?.direction}
              </span>
              <ConfBadge value={w.rsi?.confidence} />
            </div>
          </div>
        </div>
      )}

      {/* Narrative */}
      {n?.aiNarrative && (
        <div className={styles.block}>
          <SectionHead>AI Narrative</SectionHead>
          <p className={styles.narrativeText}>{n.aiNarrative}</p>
          {n.divergences && (
            <div className={styles.divergeBlock}>
              <span className={styles.agreeLabel}>Divergences</span>
              <p>{n.divergences}</p>
            </div>
          )}
        </div>
      )}

      </div>{/* end left column */}

      {/* Right column: Decision + Where You Went Wrong */}
      <div className={styles.aiCol}>

      {/* Decision */}
      {d && (
        <div className={`${styles.block} ${styles.verdictBlock} ${
          d.verdict === 'TAKE' ? styles.verdictTrade :
          d.verdict === 'SKIP' ? styles.verdictPass  : styles.verdictWatch
        }`}>
          <div className={styles.sectionHeadRow}>
            <span className={`${styles.verdictWord} ${
              d.verdict === 'TAKE' ? styles.verdictWordTrade :
              d.verdict === 'SKIP' ? styles.verdictWordPass  : styles.verdictWordWatch
            }`}>{d.verdict}</span>
          </div>
          {d.reasoning && <p className={styles.verdictReason}>{d.reasoning}</p>}
          {d.verdict === 'TAKE' && d.entry != null && (
            <div className={styles.levelCells} style={{ marginTop: 12 }}>
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Entry</span>
                <span className="mono">₹{d.entry}</span>
              </div>
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>SL</span>
                <span className="mono danger">₹{d.stopLoss}</span>
              </div>
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Target</span>
                <span className="mono accent">₹{d.target}</span>
              </div>
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>RRR</span>
                <span className={`mono ${d.rrr >= 1.5 ? 'accent' : 'danger'}`}>{d.rrr}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Where You Went Wrong */}
      {c.length > 0 && (
        <div className={styles.block}>
          <SectionHead>Where You Went Wrong</SectionHead>
          <div className={styles.corrections}>
            {c.map((item, i) => (
              <div key={i} className={styles.correction}>
                <div className={styles.correctionHeader}>
                  <span className={styles.correctionRank}>{item.rank}</span>
                  <span className={styles.correctionField}>{item.field}</span>
                </div>
                <p className={styles.correctionText}>{item.correction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// ── Legacy AI displays (for the 3 existing sessions) ─────────────────────────

function AIReadLegacyM1({ aiAnalysis }) {
  const ann = aiAnalysis?.aiAnnotation;
  const cmp = aiAnalysis?.comparison;
  const sa  = aiAnalysis?.setupAssessment;
  if (!ann && !cmp && !sa) return null;

  return (
    <>
      {ann && (
        <div className={styles.block}>
          <SectionHead>AI's Read</SectionHead>
          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Trend</span>
              <span className={styles.infoVal}>{ann.trend?.direction}</span>
              <ConfBadge value={ann.trend?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Pattern</span>
              <span className={styles.infoVal}>{ann.candlePattern?.name || 'No pattern'} — {ann.candlePattern?.quality}</span>
              <ConfBadge value={ann.candlePattern?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Volume</span>
              <span className={styles.infoVal}>{ann.volume?.vsAverage}</span>
              <ConfBadge value={ann.volume?.confidence} />
            </div>
          </div>
        </div>
      )}
      {cmp?.primaryLearningPoint && (
        <div className={styles.block}>
          <SectionHead>Primary Learning Point</SectionHead>
          <p className={styles.narrativeText}>{cmp.primaryLearningPoint}</p>
        </div>
      )}
      {sa && (
        <div className={`${styles.block} ${styles.verdictBlock} ${
          sa.verdict === 'TRADE' ? styles.verdictTrade :
          sa.verdict === 'PASS'  ? styles.verdictPass  : styles.verdictWatch
        }`}>
          <span className={`${styles.verdictWord} ${
            sa.verdict === 'TRADE' ? styles.verdictWordTrade :
            sa.verdict === 'PASS'  ? styles.verdictWordPass  : styles.verdictWordWatch
          }`}>{sa.verdict}</span>
          {sa.verdictReason && <p className={styles.verdictReason}>{sa.verdictReason}</p>}
        </div>
      )}
    </>
  );
}

function AIReadLegacyM3({ aiAnalysis }) {
  const { verdict, checklistResults, levelValidation } = aiAnalysis ?? {};
  if (!verdict) return null;
  const verdictCls = verdict === 'TRADE' || verdict === 'TAKE' ? styles.verdictTrade
    : verdict === 'PASS' || verdict === 'SKIP' || verdict === 'NO_TRADE' ? styles.verdictPass
    : styles.verdictWatch;
  const verdictWordCls = verdict === 'TRADE' || verdict === 'TAKE' ? styles.verdictWordTrade
    : verdict === 'PASS' || verdict === 'SKIP' || verdict === 'NO_TRADE' ? styles.verdictWordPass
    : styles.verdictWordWatch;
  return (
    <div className={`${styles.block} ${styles.verdictBlock} ${verdictCls}`}>
      <span className={`${styles.verdictWord} ${verdictWordCls}`}>{verdict}</span>
      {checklistResults && (
        <span className={styles.checkScore}>
          {checklistResults.filter(c => c.passed).length}/{checklistResults.length} checks passed
        </span>
      )}
    </div>
  );
}

// ── Outcome editor ────────────────────────────────────────────────────────────

function OutcomeEditor({ session, onSaved }) {
  const isTake = session.decision === 'Take';

  const [outcome,      setOutcome]      = useState(session.outcome      ?? '');
  const [actualEntry,  setActualEntry]  = useState(session.actualEntry  ?? '');
  const [actualExit,   setActualExit]   = useState(session.actualExit   ?? '');
  const [notes,        setNotes]        = useState(session.notes        ?? '');
  const [saving,       setSaving]       = useState(false);

  async function save() {
    setSaving(true);
    try {
      const patch = { outcome: outcome || undefined, notes: notes || undefined };
      if (isTake) {
        if (actualEntry) patch.actualEntry = parseFloat(actualEntry);
        if (actualExit)  patch.actualExit  = parseFloat(actualExit);
      } else if (session.exitPrice || actualExit) {
        if (actualExit) patch.exitPrice = parseFloat(actualExit);
      }
      const updated = await updateSession(session.id, patch);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  // Planned vs actual delta (only for TAKE with planned levels)
  const hasPlanned = isTake && session.plannedEntry != null;
  const hasActual  = hasPlanned && session.actualEntry != null && session.actualExit != null;

  const actualRRR = hasActual
    ? Math.round(((session.actualExit - session.actualEntry) / (session.actualEntry - session.plannedSL)) * 100) / 100
    : null;
  const entrySlippage = hasActual
    ? Math.round((session.actualEntry - session.plannedEntry) * 100) / 100
    : null;

  return (
    <div className={styles.outcomeSection}>
      <SectionHead>What Happened</SectionHead>

      <div className={styles.outcomeRow}>
        <select value={outcome} onChange={e => setOutcome(e.target.value)} className={styles.smallSelect}>
          <option value="">Outcome…</option>
          <option>Win</option>
          <option>Loss</option>
          <option>Open</option>
          <option>Skip</option>
        </select>
      </div>

      {/* Actual levels — shown for TAKE sessions */}
      {isTake && (
        <div className={styles.actualLevels}>
          <span className={styles.infoKey} style={{ display: 'block', marginBottom: 8 }}>Actual levels</span>
          <div className={styles.outcomeRow}>
            <input
              type="number"
              placeholder="Actual entry ₹"
              value={actualEntry}
              onChange={e => setActualEntry(e.target.value)}
              className={styles.smallInput}
              step="0.01"
            />
            <input
              type="number"
              placeholder="Exit price ₹"
              value={actualExit}
              onChange={e => setActualExit(e.target.value)}
              className={styles.smallInput}
              step="0.01"
            />
          </div>
        </div>
      )}

      {/* Exit price for non-TAKE sessions */}
      {!isTake && (
        <div className={styles.outcomeRow} style={{ marginTop: 8 }}>
          <input
            type="number"
            placeholder="Exit price ₹"
            value={actualExit}
            onChange={e => setActualExit(e.target.value)}
            className={styles.smallInput}
            step="0.01"
          />
        </div>
      )}

      {/* Planned vs actual delta */}
      {hasActual && (
        <div className={styles.deltaBlock}>
          <span className={styles.infoKey} style={{ display: 'block', marginBottom: 8 }}>Planned vs Actual</span>
          <div className={styles.levelCells}>
            <div className={styles.levelCell}>
              <span className={styles.levelKey}>Entry slippage</span>
              <span className={`mono ${entrySlippage >= 0 ? 'danger' : 'accent'}`}>
                {entrySlippage >= 0 ? '+' : ''}{entrySlippage}
              </span>
            </div>
            <div className={styles.levelCell}>
              <span className={styles.levelKey}>Planned RRR</span>
              <span className="mono">{session.plannedRRR}</span>
            </div>
            {actualRRR != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Actual RRR</span>
                <span className={`mono ${actualRRR >= 1.5 ? 'accent' : 'danger'}`}>{actualRRR}</span>
              </div>
            )}
            {session.pnl != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>P&L</span>
                <span className={`mono ${session.pnl >= 0 ? 'accent' : 'danger'}`}>
                  {session.pnl >= 0 ? '+' : ''}₹{session.pnl}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="What actually happened? Anything you'd do differently?"
        className={styles.notesArea}
        rows={4}
      />

      <div className={styles.outcomeFooter}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save outcome'}
        </button>
      </div>
    </div>
  );
}

// ── Session detail modal ──────────────────────────────────────────────────────

function SessionDetail({ session, onClose, onUpdate }) {
  const lookback = session.formData?.lookbackWindow || session.userInput?.lookbackWindow;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <div className={styles.modalTopRow}>
              <span className={styles.modalTicker}>{session.ticker || '—'}</span>
              {session.outcome && (
                <span className={`badge ${OUTCOME_CLASS[session.outcome] ?? 'badge-muted'}`}>
                  {session.outcome}
                </span>
              )}
            </div>
            <span className={styles.modalMeta}>
              {formatDate(session.createdAt)}
              {lookback && ` · ${lookback}-session lookback`}
              {session.chartSource && ` · ${session.chartSource}`}
            </span>
            {session.learningTags?.length > 0 && (
              <div className={styles.modalTags}>
                {session.learningTags.map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <ErrorBoundary resetLabel="Close">
            {/* Chart image */}
            {session.imagePath && (
              <div className={styles.chartWrap}>
                <img
                  src={`http://localhost:3001/${session.imagePath.replace(/^\//, '')}`}
                  alt="chart"
                  className={styles.chartImg}
                />
              </div>
            )}

            {/* Your Read — full width */}
            <YourRead session={session} />

            {/* AI Analysis — 2-column grid */}
            <ErrorBoundary resetLabel="Dismiss">
              <AIRead session={session} />
            </ErrorBoundary>

            <OutcomeEditor session={session} onSaved={updated => onUpdate(updated)} />

            <ChatPanel
              session={session}
              onHistoryUpdate={chatHistory => onUpdate({ ...session, chatHistory })}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ── Main Journal page ─────────────────────────────────────────────────────────

export default function Journal() {
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [filters,   setFilters]   = useState({ verdict: '', outcome: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setSessions(await getSessions()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function handleUpdate(updated) {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  const filtered = sessions.filter(s => {
    const verdict = s.aiDecision?.verdict || s.aiVerdict;
    if (filters.verdict && verdict !== filters.verdict) return false;
    if (filters.outcome && s.outcome !== filters.outcome) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Journal</h1>
          <p className={styles.subtitle}>Every session logged automatically. Click any row to see the full record.</p>
        </div>
        <span className={styles.count}>{sessions.length} sessions</span>
      </div>

      <div className={styles.filters}>
        <select value={filters.verdict} onChange={e => setFilters(f => ({ ...f, verdict: e.target.value }))} className={styles.filterSelect}>
          <option value="">All verdicts</option>
          <option value="TAKE">Take</option>
          <option value="SKIP">Skip</option>
          <option value="WATCH">Watch</option>
        </select>
        <select value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))} className={styles.filterSelect}>
          <option value="">All outcomes</option>
          <option value="Win">Win</option>
          <option value="Loss">Loss</option>
          <option value="Open">Open</option>
          <option value="Skip">Skip</option>
        </select>
        <button className="btn btn-ghost" onClick={() => setFilters({ verdict: '', outcome: '' })}>Clear</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loadingRow}><span className="spinner" /> Loading sessions…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {sessions.length === 0
            ? 'No sessions yet. Complete an analysis to start your journal.'
            : 'No sessions match these filters.'}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Stock</th>
                <th>Pattern</th>
                <th>Decision</th>
                <th>AI Verdict</th>
                <th>Outcome</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const pattern = s.formData?.candlePattern || s.userInput?.candlePattern;
                const aiVerdict = s.aiDecision?.verdict || s.aiVerdict;
                return (
                  <tr key={s.id} className={styles.row} onClick={() => setSelected(s)}>
                    <td className="mono muted">{filtered.length - i}</td>
                    <td className="mono">{formatDate(s.createdAt)}</td>
                    <td className={styles.ticker}>{s.ticker || '—'}</td>
                    <td className={styles.pattern}>{pattern || '—'}</td>
                    <td>
                      {s.decision
                        ? <span className={`badge ${s.decision === 'Take' ? 'badge-green' : s.decision === 'Skip' ? 'badge-red' : 'badge-amber'}`}>{s.decision}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {aiVerdict
                        ? <span className={`badge ${VERDICT_CLASS[aiVerdict] ?? 'badge-muted'}`}>{aiVerdict}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {s.outcome
                        ? <span className={`badge ${OUTCOME_CLASS[s.outcome] ?? 'badge-muted'}`}>{s.outcome}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="mono">
                      {s.pnl != null
                        ? <span className={s.pnl >= 0 ? 'accent' : 'danger'}>{s.pnl >= 0 ? '+' : ''}₹{s.pnl}</span>
                        : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <SessionDetail
          session={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
