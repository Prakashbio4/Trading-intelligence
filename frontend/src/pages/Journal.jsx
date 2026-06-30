import { useState, useEffect, useRef, useCallback } from 'react';
import { getSessions, updateSession, deleteSession, deleteSessions, uploadOutcomeImages } from '../api/index.js';
import ChatPanel from '../components/ChatPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import styles from './Journal.module.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function authHdr() {
  const t = localStorage.getItem('sipy_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ── OHLC Candle Window viewer ─────────────────────────────────────────────────

function OhlcWindow({ ticker, date }) {
  const [candles, setCandles] = useState(null);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!ticker || !date) return;
    fetch(`${BASE}/universe/${ticker}/window?date=${date}&windowSize=7`, { headers: authHdr() })
      .then(r => r.json())
      .then(data => setCandles(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message));
  }, [ticker, date]);

  if (error)          return null;
  if (candles === null) return <p className={styles.ohlcLoading}>Loading price data…</p>;
  if (!candles.length)  return null;

  const W = 420, H = 160, PAD = 20, CW = 12;
  const prices = candles.flatMap(c => [c.high, c.low]);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const toY = p => PAD + ((maxP - p) / range) * (H - PAD * 2);
  const slotW = (W - PAD * 2) / candles.length;

  const ZONE_COLOR = { prior: null, pattern: '#f59e0b', aftermath: '#818cf8', today: '#6366f1' };

  return (
    <div className={styles.ohlcWrap}>
      <div className={styles.ohlcHeader}>
        <span className={styles.ohlcTitle}>7-Day Price Window</span>
        <div className={styles.ohlcLegend}>
          <span className={styles.legendDot} style={{ background: '#6b7280' }} /> Prior
          <span className={styles.legendDot} style={{ background: '#f59e0b' }} /> Pattern
          <span className={styles.legendDot} style={{ background: '#6366f1' }} /> Session day
        </div>
      </div>
      <svg width={W} height={H} className={styles.ohlcChart}>
        {candles.map((c, i) => {
          const x = PAD + i * slotW + slotW / 2;
          const bullish = c.close >= c.open;
          const zoneColor = ZONE_COLOR[c.zone];
          const color = zoneColor || (bullish ? '#22c55e' : '#ef4444');
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBot = toY(Math.min(c.open, c.close));
          const bodyH   = Math.max(bodyBot - bodyTop, 1.5);
          return (
            <g key={i}>
              <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth={1.5} />
              <rect x={x - CW/2} y={bodyTop} width={CW} height={bodyH}
                fill={bullish ? color : 'transparent'} stroke={color} strokeWidth={1.5} rx={1} />
              <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#6b7280">
                {c.date?.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.ohlcPrices}>
        {candles.map((c, i) => (
          <div key={i} className={`${styles.ohlcPrice} ${c.zone === 'today' ? styles.ohlcToday : ''}`}>
            <span className={styles.ohlcC}>₹{Number(c.close).toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const VERDICT_CLASS = {
  TRADE: 'badge-green', TAKE: 'badge-green',
  PASS: 'badge-red',  SKIP: 'badge-red', NO_TRADE: 'badge-red',
  CONDITIONAL: 'badge-amber', WATCH: 'badge-amber',
  LEARN: 'badge-muted',
};
const OUTCOME_CLASS = {
  Win: 'badge-green', Loss: 'badge-red', Open: 'badge-teal',
  Skip: 'badge-muted', Watch: 'badge-muted', Missed: 'badge-red',
};
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
        <Row label="Support"    value={sup != null ? mono(`₹${lvl(sup)}`)  : null} />
        <Row label="Resistance" value={res != null ? mono(`₹${lvl(res)}`)  : null} />
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
            {d.conviction && (
              <span className={`badge ${d.conviction === 'STRONG' ? 'badge-green' : 'badge-amber'}`}>
                {d.conviction}
              </span>
            )}
          </div>
          {d.reasoning && <p className={styles.verdictReason}>{d.reasoning}</p>}
          {d.verdict === 'WATCH' && d.watchReason && (
            <p className={styles.watchReason}>{d.watchReason}</p>
          )}
          {(d.verdict === 'TAKE' || d.verdict === 'WATCH') && d.entry != null && (
            <>
              {d.verdict === 'WATCH' && (
                <p className={styles.watchLevelsNote} style={{ marginTop: 8 }}>Qualifying levels</p>
              )}
              <div className={styles.levelCells} style={{ marginTop: 8 }}>
                <div className={styles.levelCell}>
                  <span className={styles.levelKey}>AI Entry</span>
                  <span className="mono">₹{d.entry}</span>
                </div>
                <div className={styles.levelCell}>
                  <span className={styles.levelKey}>AI SL</span>
                  <span className="mono danger">₹{d.stopLoss}</span>
                </div>
                <div className={styles.levelCell}>
                  <span className={styles.levelKey}>AI Target</span>
                  <span className="mono accent">₹{d.target}</span>
                </div>
                <div className={styles.levelCell}>
                  <span className={styles.levelKey}>AI RRR</span>
                  <span className={`mono ${d.rrr >= 1.5 ? 'accent' : 'danger'}`}>{d.rrr}</span>
                </div>
              </div>
              {/* Side-by-side comparison when user also had levels */}
              {session.plannedEntry != null && (
                <div className={styles.lcCompare}>
                  <div className={styles.lcCompareRow}>
                    <span className={styles.lcCompareHead} />
                    <span className={styles.lcCompareHead}>Yours</span>
                    <span className={styles.lcCompareHead}>AI</span>
                  </div>
                  {[
                    { label: 'Entry',  user: session.plannedEntry,  ai: d.entry },
                    { label: 'SL',     user: session.plannedSL,     ai: d.stopLoss },
                    { label: 'Target', user: session.plannedTarget, ai: d.target },
                    { label: 'RRR',    user: session.plannedRRR,    ai: d.rrr },
                  ].map(({ label, user, ai }) => {
                    const diff = ai && ai !== 0 ? ((user - ai) / ai) * 100 : null;
                    const diffCls = diff === null ? '' : Math.abs(diff) <= 3 ? styles.lcGood : Math.abs(diff) <= 7 ? styles.lcWarn : styles.lcBad;
                    return (
                      <div key={label} className={styles.lcCompareRow}>
                        <span className={styles.lcCompareLabel}>{label}</span>
                        <span className="mono">{user ?? '—'}</span>
                        <span className="mono">{ai  ?? '—'}</span>
                        {diff !== null && <span className={`mono ${diffCls}`}>{diff >= 0 ? '+' : ''}{diff.toFixed(1)}%</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 8-Step Checklist */}
      {d?.checklistResults?.length > 0 && (
        <div className={styles.block}>
          <SectionHead>8-Step Checklist</SectionHead>
          <div className={styles.checklist}>
            {d.checklistResults.map(item => {
              const cls = item.knockout
                ? styles.checkKnockout
                : !item.passed
                ? styles.checkFail
                : item.borderline
                ? styles.checkBorderline
                : styles.checkPass;
              const icon = item.knockout ? '✗' : !item.passed ? '✗' : item.borderline ? '~' : '✓';
              return (
                <div key={item.step} className={`${styles.checkItem} ${cls}`}>
                  <div className={styles.checkItemHeader}>
                    <span className={styles.checkStep}>{item.step}</span>
                    <span className={styles.checkLabel}>{item.label}</span>
                    <span className={styles.checkStatus}>{icon}</span>
                  </div>
                  {item.note && <p className={styles.checkNote}>{item.note}</p>}
                </div>
              );
            })}
          </div>
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

// ── Candle screenshot uploader ────────────────────────────────────────────────

function CandleUploadSlot({ label, hint, existingUrl, onFile, file }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const preview = file ? URL.createObjectURL(file) : existingUrl;

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) return;
    onFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className={styles.candleSlot}>
      <span className={styles.fieldLabel}>{label}</span>
      {hint && <span className={styles.candleSlotHint}>{hint}</span>}
      <div
        className={`${styles.candleZone} ${dragging ? styles.candleZoneDragging : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {preview ? (
          <img src={preview} alt={label} className={styles.candlePreview} />
        ) : (
          <div className={styles.candleZonePrompt}>
            <span className={styles.candleZoneIcon}>↑</span>
            <span className={styles.candleZoneLabel}>Drop or click to upload</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CandleUploadSection({ session, onSaved }) {
  const [entryFile,  setEntryFile]  = useState(null);
  const [exitFile,   setExitFile]   = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState(null);

  const hasChanges = entryFile || exitFile;

  async function handleUpload() {
    if (!hasChanges) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const updated = await uploadOutcomeImages(session.id, { entryChart: entryFile, exitChart: exitFile });
      onSaved(updated);
      setEntryFile(null);
      setExitFile(null);
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.candleSection}>
      <SectionHead>Candle Screenshots</SectionHead>
      <p className={styles.contextHint}>
        Upload chart screenshots so the AI can learn from your trade setup and what actually happened.
      </p>
      <div className={styles.candleSlots}>
        <CandleUploadSlot
          label="Entry chart"
          hint="Chart at the time you took (or passed on) the trade"
          existingUrl={session.outcomeChartEntry}
          file={entryFile}
          onFile={setEntryFile}
        />
        <CandleUploadSlot
          label="Post-trade chart"
          hint="Chart showing what happened after the trade"
          existingUrl={session.outcomeChartExit}
          file={exitFile}
          onFile={setExitFile}
        />
      </div>
      {uploadErr && <p className={styles.uploadErr}>{uploadErr}</p>}
      {hasChanges && (
        <div className={styles.outcomeFooter}>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload charts'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Outcome editor ────────────────────────────────────────────────────────────

function SmallSelect({ value, onChange, children, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={styles.smallSelect}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

function OutcomeEditor({ session, onSaved }) {
  // onSaved is passed to both the outcome save and the candle upload
  const isTake    = session.decision === 'Take';
  const existing  = session.outcomeData ?? {};

  // Take fields
  const [result,       setResult]       = useState(existing.result       ?? '');
  const [actualEntry,  setActualEntry]  = useState(session.actualEntry   ?? '');
  const [actualExit,   setActualExit]   = useState(session.actualExit    ?? '');

  // Skip/Watch fields
  const [direction,    setDirection]    = useState(existing.direction    ?? '');
  const [move,         setMove]         = useState(existing.move         ?? '');
  const [decisionOk,   setDecisionOk]   = useState(existing.decisionCorrect ?? '');

  // Shared fields
  const [setupPlayed,  setSetupPlayed]  = useState(existing.setupPlayedOut ?? '');
  const [macroNote,    setMacroNote]    = useState(existing.macroNote    ?? '');
  const [sectorNote,   setSectorNote]   = useState(existing.sectorNote   ?? '');
  const [notes,        setNotes]        = useState(session.notes         ?? '');
  const [saving,       setSaving]       = useState(false);

  async function save() {
    setSaving(true);
    try {
      const outcomeData = isTake
        ? { result, setupPlayedOut: setupPlayed, macroNote, sectorNote }
        : { direction, move, decisionCorrect: decisionOk, setupPlayedOut: setupPlayed, macroNote, sectorNote };

      const patch = { outcomeData, notes: notes || undefined };
      if (isTake) {
        if (actualEntry) patch.actualEntry = parseFloat(actualEntry);
        if (actualExit)  patch.actualExit  = parseFloat(actualExit);
      }
      const updated = await updateSession(session.id, patch);
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  // Planned vs actual delta
  const hasPlanned    = isTake && session.plannedEntry != null;
  const hasActual     = hasPlanned && session.actualEntry != null && session.actualExit != null;
  const actualRRR     = hasActual
    ? Math.round(((session.actualExit - session.actualEntry) / (session.actualEntry - session.plannedSL)) * 100) / 100
    : null;
  const entrySlippage = hasActual
    ? Math.round((session.actualEntry - session.plannedEntry) * 100) / 100
    : null;

  return (
    <div className={styles.outcomeSection}>

      {/* ── TAKE outcome ── */}
      {isTake && (
        <>
          <SectionHead>What Happened</SectionHead>
          <div className={styles.outcomeFields}>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Result</span>
              <SmallSelect value={result} onChange={setResult} placeholder="Select result…">
                <option value="hit_target">Hit target</option>
                <option value="stopped_out">Stopped out</option>
                <option value="manual_exit">Manually exited</option>
                <option value="open">Still open</option>
              </SmallSelect>
            </div>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Setup played out as read?</span>
              <SmallSelect value={setupPlayed} onChange={setSetupPlayed} placeholder="Select…">
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="partially">Partially</option>
              </SmallSelect>
            </div>
          </div>

          <div className={styles.actualLevels}>
            <span className={styles.fieldLabel}>Actual levels</span>
            <div className={styles.levelInputRow}>
              <input type="number" placeholder="Actual entry ₹" value={actualEntry}
                onChange={e => setActualEntry(e.target.value)} className={styles.smallInput} step="0.01" />
              <input type="number" placeholder="Exit price ₹" value={actualExit}
                onChange={e => setActualExit(e.target.value)} className={styles.smallInput} step="0.01" />
            </div>
          </div>

          {hasActual && (
            <div className={styles.deltaBlock}>
              <span className={styles.fieldLabel}>Planned vs Actual</span>
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
        </>
      )}

      {/* ── SKIP / WATCH outcome ── */}
      {!isTake && (
        <>
          <SectionHead>What Did the Stock Do?</SectionHead>
          <div className={styles.outcomeFields}>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Stock direction</span>
              <SmallSelect value={direction} onChange={setDirection} placeholder="Select…">
                <option value="as_expected">Moved in expected direction</option>
                <option value="opposite">Moved opposite</option>
                <option value="flat">Stayed flat</option>
              </SmallSelect>
            </div>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Approximate move</span>
              <input type="text" placeholder='e.g. "up 8% in 4 sessions"'
                value={move} onChange={e => setMove(e.target.value)} className={styles.smallInput} />
            </div>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Was the {session.decision} right?</span>
              <SmallSelect value={decisionOk} onChange={setDecisionOk} placeholder="Select…">
                <option value="yes">Yes — right to {session.decision?.toLowerCase()}</option>
                <option value="no">No — missed a valid move</option>
                <option value="too_early">Too early to tell</option>
              </SmallSelect>
            </div>
            <div className={styles.outcomeField}>
              <span className={styles.fieldLabel}>Setup played out as read?</span>
              <SmallSelect value={setupPlayed} onChange={setSetupPlayed} placeholder="Select…">
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="partially">Partially</option>
              </SmallSelect>
            </div>
          </div>
        </>
      )}

      {/* ── Market context (shared) ── */}
      <div className={styles.contextBlock}>
        <SectionHead>Market Context at Decision Time</SectionHead>
        <p className={styles.contextHint}>Write freely — whatever felt relevant when you made this call.</p>
        <textarea value={macroNote} onChange={e => setMacroNote(e.target.value)}
          placeholder="What was the broader market doing? (Nifty trend, global events, FII activity, pre-event nervousness…)"
          className={styles.notesArea} rows={3} />
        <textarea value={sectorNote} onChange={e => setSectorNote(e.target.value)}
          placeholder="What was the sector doing? (rotation, specific news, hot or cooling…)"
          className={styles.notesArea} rows={2} style={{ marginTop: 8 }} />
      </div>

      {/* ── Auto price snapshots ── */}
      {session.outcomeAuto && Object.keys(session.outcomeAuto).length > 0 && (
        <div className={styles.autoOutcome}>
          <SectionHead>Price Snapshots (Auto)</SectionHead>
          <div className={styles.snapshotRow}>
            {[3, 5, 10].map(n => {
              const snap = session.outcomeAuto[`t${n}`];
              if (!snap) return null;
              const up = snap.pct_vs_entry >= 0;
              return (
                <div key={n} className={styles.snapshot}>
                  <span className={styles.snapLabel}>T+{n}</span>
                  <span className={`mono ${up ? 'accent' : 'danger'}`}>
                    {up ? '+' : ''}{snap.pct_vs_entry}%
                  </span>
                  <span className={styles.snapPrice}>₹{Number(snap.price).toFixed(0)}</span>
                  {snap.hit_target && <span className="badge badge-green">Target hit</span>}
                  {snap.hit_sl     && <span className="badge badge-red">SL hit</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notes (shared) ── */}
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={isTake ? "What actually happened? Anything you'd do differently?" : 'Any other observations about this Skip/Watch decision?'}
        className={styles.notesArea} rows={3} />

      <div className={styles.outcomeFooter}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save outcome'}
        </button>
      </div>

      <CandleUploadSection session={session} onSaved={onSaved} />
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteConfirmDialog({ count, onConfirm, onCancel, deleting }) {
  return (
    <div className={styles.confirmOverlay}>
      <div className={styles.confirmBox}>
        <p className={styles.confirmTitle}>Delete {count === 1 ? 'this entry' : `${count} entries`}?</p>
        <p className={styles.confirmBody}>This action cannot be undone.</p>
        <div className={styles.confirmFooter}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Session detail modal ──────────────────────────────────────────────────────

function SessionDetail({ session, onClose, onUpdate, onDelete }) {
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
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexShrink: 0 }}>
            <button className={styles.deleteBtnModal} onClick={() => onDelete(session)}>Delete</button>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>
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

            {/* OHLC 7-day candle window */}
            {session.ticker && session.date && (
              <OhlcWindow ticker={session.ticker} date={session.date} />
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
  const [sessions,      setSessions]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [filters,       setFilters]       = useState({ verdict: '', outcome: '' });
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | { type:'single'|'bulk', ids:Set }
  const [deleting,      setDeleting]      = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelectedIds(new Set()); }, [filters]);

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

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  }

  function requestDelete(session) {
    setDeleteConfirm({ type: 'single', ids: new Set([session.id]) });
  }

  function requestBulkDelete() {
    setDeleteConfirm({ type: 'bulk', ids: new Set(selectedIds) });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const ids = [...deleteConfirm.ids];
      if (deleteConfirm.type === 'single') {
        await deleteSession(ids[0]);
      } else {
        await deleteSessions(ids);
      }
      setSessions(prev => prev.filter(s => !deleteConfirm.ids.has(s.id)));
      setSelectedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      if (selected && deleteConfirm.ids.has(selected.id)) setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = sessions.filter(s => {
    const verdict = s.aiDecision?.verdict || s.aiVerdict;
    if (filters.verdict && verdict !== filters.verdict) return false;
    if (filters.outcome && s.outcome !== filters.outcome) return false;
    return true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));

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

      {selectedIds.size > 0 && (
        <div className={styles.deleteBar}>
          <span className={styles.deleteBarText}>{selectedIds.size} {selectedIds.size === 1 ? 'entry' : 'entries'} selected</span>
          <button className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>Deselect all</button>
          <button className="btn btn-danger" onClick={requestBulkDelete}>Delete selected</button>
        </div>
      )}

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
                <th className={styles.checkCol}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
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
                const pattern = s.formData?.patternName || s.formData?.candlePattern || s.userInput?.candlePattern;
                const aiVerdict = s.aiDecision?.verdict || s.aiVerdict;
                const od = s.outcomeData;
                const outcomeLabel = s.outcome
                  ? s.outcome
                  : od?.decisionCorrect === 'no' ? 'Missed'
                  : null;
                const outcomeDetail = !s.outcome && od
                  ? (od.direction === 'as_expected' ? '↑ as read' : od.direction === 'opposite' ? '↓ opposite' : od.direction === 'flat' ? '→ flat' : null)
                  : null;
                return (
                  <tr key={s.id} className={styles.row} onClick={() => setSelected(s)}>
                    <td className={styles.checkCol} onClick={e => { e.stopPropagation(); toggleSelect(s.id); }}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
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
                      {outcomeLabel
                        ? <span className={`badge ${OUTCOME_CLASS[outcomeLabel] ?? 'badge-muted'}`}>{outcomeLabel}</span>
                        : outcomeDetail
                        ? <span className="muted">{outcomeDetail}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="mono">
                      {s.pnl != null
                        ? <span className={s.pnl >= 0 ? 'accent' : 'danger'}>{s.pnl >= 0 ? '+' : ''}₹{s.pnl}</span>
                        : od?.move
                        ? <span className="muted">{od.move}</span>
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
          onDelete={requestDelete}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmDialog
          count={deleteConfirm.ids.size}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
