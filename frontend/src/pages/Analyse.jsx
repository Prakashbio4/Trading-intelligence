import { useState, useMemo, useEffect, useRef } from 'react';
import UploadZone from '../components/UploadZone.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import TradingViewChart from '../components/TradingViewChart.jsx';
import { SelectField, NumberField, TextField, TextArea } from '../components/Field.jsx';
import { SymbolField } from '../components/SymbolField.jsx';
import { analyzeUnified, saveSession } from '../api/index.js';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Fire-and-forget from the caller's perspective (not awaited in handleSubmit),
// but retries once and logs real failures instead of swallowing them —
// silent failures here mean a stock never shows up in Signals with no trace.
async function autoAddToUniverse(ticker, attempt = 1) {
  const token = localStorage.getItem('sipy_token');
  try {
    const res = await fetch(`${BASE}/universe`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: ticker }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500));
      return autoAddToUniverse(ticker, attempt + 1);
    }
    console.error(`Failed to add ${ticker} to stock universe:`, err.message);
  }
}
import {
  TREND_OPTIONS, TREND_DURATION, STOCK_PHASE, CHART_STRUCTURE, OPPOSING_STRUCTURE,
  SINGLE_CANDLE_TYPES, CANDLE_PATTERN_GROUPS,
  PATTERN_DIRECTION, PATTERN_QUALITY, PRIOR_TREND_MATCH,
  VOLUME_VS_AVG, VOLUME_CHARACTER, MACD_OPTIONS, RSI_OPTIONS, BOLLINGER_OPTIONS, SR_STRENGTH, SR_TIMEFRAME,
  PATTERN_CANDLECOUNT, PATTERN_ROLES,
} from '../api/options.js';

const SEQUENCE_DAYS = [-4, -3, -2, -1, 0];

function initSequence() {
  return SEQUENCE_DAYS.map(day => ({ day, pattern: '', quality: '', direction: '' }));
}

function patternMeta(triggerPattern) {
  const count = PATTERN_CANDLECOUNT[triggerPattern] ?? 1;
  const patternDays = SEQUENCE_DAYS.slice(-count);
  const contextDays = SEQUENCE_DAYS.slice(0, SEQUENCE_DAYS.length - count);
  const roles = PATTERN_ROLES[triggerPattern] ?? ['Today'];
  return { count, patternDays, contextDays, roles };
}
import styles from './Analyse.module.css';

const DECISIONS     = ['Take', 'Skip', 'Watch'];
const CONFIDENCE    = ['High', 'Medium', 'Low'];

function initForm() {
  return {
    ticker: '',
    date: new Date().toISOString().split('T')[0],
    chartSource: '',
    primaryTrend: '',
    trendDuration: '',
    stockPhase: '',
    chartStructure: '',
    opposingStructure: '',
    priorTrendMatch: '',
    volumeVsAverage: '',
    volumeCharacter: '',
    macd: '',
    rsiValue: '',
    rsiDirection: '',
    bollingerBands: '',
    nearestSupport: '',
    nearestResistance: '',
    srStrength: '',
    srTimeframe: '',
    narrative: '',
  };
}

function calcRRR(entry, sl, target) {
  const e = parseFloat(entry);
  const s = parseFloat(sl);
  const t = parseFloat(target);
  if (!e || !s || !t || e === s) return null;
  return Math.round(((t - e) / (e - s)) * 100) / 100;
}

// ── Format S&R level entries, guarding against non-primitive AI output ──────

function formatLevel(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    const val = v.value ?? v.price ?? v.level ?? v.support ?? v.resistance;
    return val != null ? String(val) : null;
  }
  return String(v);
}

function formatLevels(levels) {
  return [].concat(levels).map(formatLevel).filter(Boolean).join(' · ');
}

// ── S&R vs SL distance check (Varsity rule: must be within 4%) ───────────────

function SRSlCheck({ support, resistance, sl, decision }) {
  if (!sl || !decision || decision === 'Skip') return null;

  const slVal  = parseFloat(sl);
  const supVal = parseFloat(support);
  const resVal = parseFloat(resistance);

  const isLong  = decision === 'Take'; // long uses support, short uses resistance
  const srLevel = isLong ? supVal : resVal;
  const label   = isLong ? 'support' : 'resistance';

  if (!srLevel || !slVal || srLevel <= 0 || slVal <= 0) return null;

  const pct = Math.abs((slVal - srLevel) / srLevel) * 100;
  const ok  = pct <= 4;

  return (
    <div style={{
      marginTop: 12,
      padding: '10px 14px',
      borderRadius: 6,
      background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      fontSize: 13,
      color: ok ? '#22c55e' : '#ef4444',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span>{ok ? '✓' : '✗'}</span>
      <span>
        SL {ok ? 'coincides with' : 'is too far from'} {label} —{' '}
        <strong>{pct.toFixed(1)}%</strong> apart
        {!ok && ' (Varsity rule: must be within 4% — disqualify this trade)'}
      </span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Analyse() {
  const [chartFile,      setChartFile]      = useState(null);
  const [form,           setForm]           = useState(initForm());
  const [sequence,       setSequence]       = useState(initSequence());
  const [triggerPattern, setTriggerPattern] = useState('');
  const [decision,     setDecision]     = useState(null);
  const [confidence,   setConfidence]   = useState(null);
  const [entry,        setEntry]        = useState('');
  const [sl,           setSl]           = useState('');
  const [target,       setTarget]       = useState('');
  const [skipEntry,    setSkipEntry]    = useState('');
  const [skipSL,       setSkipSL]       = useState('');
  const [skipTarget,   setSkipTarget]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [savedSession, setSavedSession] = useState(null);
  const [error,        setError]        = useState(null);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function setSeq(day, field, val) {
    setSequence(s => s.map(r => r.day === day ? { ...r, [field]: val } : r));
  }

  const rrr       = useMemo(() => calcRRR(entry, sl, target), [entry, sl, target]);
  const rrrOk     = rrr !== null && rrr >= 1.5;
  const skipRRR   = useMemo(() => calcRRR(skipEntry, skipSL, skipTarget), [skipEntry, skipSL, skipTarget]);
  const locked = !!result;

  const canSubmit = useMemo(() => {
    if (!form.ticker.trim() || !form.primaryTrend) return false;
    if (!triggerPattern) return false;
    if (!decision || !confidence) return false;
    if (decision === 'Take' && (!entry || !sl || !target)) return false;
    return true;
  }, [form.ticker, form.primaryTrend, triggerPattern, decision, confidence, entry, sl, target]);

  async function handleSubmit() {
    if (!chartFile) { setError('Please upload a chart image first.'); return; }
    setLoading(true);
    setError(null);

    const { count, patternDays, contextDays, roles } = patternMeta(triggerPattern);

    const patternCandles = patternDays.map((day, i) => {
      const row = sequence.find(r => r.day === day);
      return {
        role:       roles[i] ?? `Day ${day}`,
        day,
        candleType: count > 1 ? (row?.pattern || '') : triggerPattern,
        direction:  row?.direction || '',
        quality:    row?.quality   || '',
      };
    });

    const contextCandles = contextDays
      .map(day => {
        const row = sequence.find(r => r.day === day);
        if (!row?.pattern) return null;
        return { day, candleType: row.pattern, direction: row.direction, quality: row.quality };
      })
      .filter(Boolean);

    const payload = {
      ...form,
      ticker: form.ticker.toUpperCase(),
      patternName:    triggerPattern,
      patternCandles,
      contextCandles,
      decision,
      confidence,
      plannedEntry:  decision === 'Take' ? parseFloat(entry)  : null,
      plannedSL:     decision === 'Take' ? parseFloat(sl)     : null,
      plannedTarget: decision === 'Take' ? parseFloat(target) : null,
      plannedRRR:    decision === 'Take' ? rrr                : null,
      userEntry:     decision !== 'Take' ? (parseFloat(skipEntry)  || null) : null,
      userSL:        decision !== 'Take' ? (parseFloat(skipSL)     || null) : null,
      userTarget:    decision !== 'Take' ? (parseFloat(skipTarget) || null) : null,
    };

    const fd = new FormData();
    fd.append('chart', chartFile);
    fd.append('formData', JSON.stringify(payload));

    try {
      const data = await analyzeUnified(fd);
      setResult(data);

      const saved = await saveSession({
        ticker:        payload.ticker,
        date:          payload.date,
        chartSource:   payload.chartSource,
        lookbackWindow: payload.lookbackWindow,
        imagePath:     data.imagePath,
        promptVersion: data.promptVersion,
        formData:      payload,
        decision,
        confidence,
        plannedEntry:  payload.plannedEntry,
        plannedSL:     payload.plannedSL,
        plannedTarget: payload.plannedTarget,
        plannedRRR:    payload.plannedRRR,
        aiWhatISee:    data.analysis?.whatISee       ?? null,
        aiNarrative:   data.analysis?.narrativeIRead ?? null,
        aiDecision:    data.analysis?.myDecision     ?? null,
        aiCorrections: data.analysis?.whereYouWentWrong ?? [],
      });
      setSavedSession(saved);
      autoAddToUniverse(payload.ticker);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setChartFile(null);
    setForm(initForm());
    setSequence(initSequence());
    setTriggerPattern('');
    setDecision(null);
    setConfidence(null);
    setEntry('');
    setSl('');
    setTarget('');
    setSkipEntry('');
    setSkipSL('');
    setSkipTarget('');
    setResult(null);
    setSavedSession(null);
    setError(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analyse</h1>
        <p className={styles.subtitle}>
          Upload a chart. Fill in your read — no hints. Submit. See where the AI agrees and where it doesn't.
        </p>
      </div>

      <div className={styles.body}>

        {/* ── Chart upload ─────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Chart</div>
          <UploadZone onFile={setChartFile} disabled={locked || loading} />
        </section>

        {/* ── Context ──────────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Context</div>
          <div className={styles.grid2}>
            <SymbolField label="Stock symbol" required value={form.ticker}
              onChange={v => !locked && set('ticker', v)}
              placeholder="e.g. DEEPIND" />
            <TextField label="Date" value={form.date}
              onChange={v => !locked && set('date', v)} />
          </div>
        </section>

        {/* ── Live Chart ───────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Live Chart</div>
          <ErrorBoundary resetLabel="Reload chart">
            <TradingViewChart symbol={form.ticker} />
          </ErrorBoundary>
        </section>

        {/* ── Trend Read ───────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Trend Read</div>
          <div className={styles.grid2}>
            <SelectField label="Primary trend" required value={form.primaryTrend}
              onChange={v => !locked && set('primaryTrend', v)} options={TREND_OPTIONS} />
            <SelectField label="Trend duration" value={form.trendDuration}
              onChange={v => !locked && set('trendDuration', v)} options={TREND_DURATION} />
            <SelectField label="Stock phase" value={form.stockPhase}
              onChange={v => !locked && set('stockPhase', v)} options={STOCK_PHASE} />
            <SelectField label="Chart structure" value={form.chartStructure}
              onChange={v => !locked && set('chartStructure', v)} options={CHART_STRUCTURE} />
            <SelectField label="Opposing structure" value={form.opposingStructure}
              onChange={v => !locked && set('opposingStructure', v)} options={OPPOSING_STRUCTURE} />
          </div>
        </section>

        {/* ── Candle Sequence ──────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Candle Sequence</div>

          {/* Step 1 — pick the trigger pattern; form adapts below */}
          <div className={styles.groupedSelectWrap}>
            <label className={styles.groupedSelectLabel}>
              Today&apos;s candle pattern <span className={styles.required}>*</span>
            </label>
            <select
              value={triggerPattern}
              onChange={e => !locked && setTriggerPattern(e.target.value)}
              className={styles.groupedSelect}
              disabled={locked}
            >
              <option value="">— select pattern —</option>
              {CANDLE_PATTERN_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {triggerPattern && (() => {
            const { count, patternDays, contextDays, roles } = patternMeta(triggerPattern);
            const isMulti = count > 1;

            return (
              <>
                {/* Context candles — days before the pattern */}
                {contextDays.length > 0 && (
                  <div className={styles.contextSection}>
                    <p className={styles.seqHint}>Earlier candles — optional context</p>
                    <div className={styles.seqTable}>
                      <div className={styles.seqHeader}>
                        <span>Day</span><span>Candle type</span><span>Direction</span><span>Quality</span>
                      </div>
                      {contextDays.map(day => {
                        const row = sequence.find(r => r.day === day);
                        const hasP = row.pattern && row.pattern !== 'No pattern identified';
                        return (
                          <div key={day} className={styles.seqRow}>
                            <span className={styles.seqDay}>Day {day}</span>
                            <SelectField value={row.pattern}
                              onChange={v => !locked && setSeq(day, 'pattern', v)}
                              options={SINGLE_CANDLE_TYPES} />
                            <SelectField value={row.direction}
                              onChange={v => !locked && setSeq(day, 'direction', v)}
                              options={PATTERN_DIRECTION} disabled={!row.pattern} />
                            <SelectField value={row.quality}
                              onChange={v => !locked && setSeq(day, 'quality', v)}
                              options={PATTERN_QUALITY} disabled={!hasP} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pattern group — the candles that form the trigger pattern */}
                <div className={styles.patternGroup}>
                  <div className={styles.patternGroupHeader}>
                    <span className={styles.patternGroupName}>{triggerPattern}</span>
                    <span className={styles.patternGroupSpan}>
                      {isMulti ? `${count}-candle pattern` : 'single candle'}
                    </span>
                  </div>
                  <div className={styles.seqTable}>
                    <div className={styles.seqHeader}>
                      <span>Role</span>
                      {isMulti ? <span>Individual candle</span> : <span />}
                      <span>Direction</span><span>Quality</span>
                    </div>
                    {patternDays.map((day, i) => {
                      const row = sequence.find(r => r.day === day);
                      const role = roles[i] ?? `Day ${day}`;
                      const isLast = i === patternDays.length - 1;
                      const hasP = row.pattern && row.pattern !== 'No pattern identified';
                      return (
                        <div key={day} className={`${styles.seqRow} ${isLast ? styles.seqRowTrigger : ''}`}>
                          <span className={styles.seqDay}>
                            {role}
                          </span>
                          {isMulti
                            ? <SelectField value={row.pattern}
                                onChange={v => !locked && setSeq(day, 'pattern', v)}
                                options={SINGLE_CANDLE_TYPES} />
                            : <span />
                          }
                          <SelectField value={row.direction}
                            onChange={v => !locked && setSeq(day, 'direction', v)}
                            options={PATTERN_DIRECTION} disabled={!triggerPattern} />
                          <SelectField value={row.quality}
                            onChange={v => !locked && setSeq(day, 'quality', v)}
                            options={PATTERN_QUALITY}
                            disabled={isMulti ? !hasP : triggerPattern === 'No pattern identified'} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.seqFooter}>
                  <SelectField label="Prior trend match (sequence overall)" value={form.priorTrendMatch}
                    onChange={v => !locked && set('priorTrendMatch', v)} options={PRIOR_TREND_MATCH} />
                </div>
              </>
            );
          })()}
        </section>

        {/* ── Volume & Indicators ──────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Volume & Indicators</div>
          <div className={styles.grid2}>
            <SelectField label="Volume vs average" required value={form.volumeVsAverage}
              onChange={v => !locked && set('volumeVsAverage', v)} options={VOLUME_VS_AVG} />
            <SelectField label="Volume character" value={form.volumeCharacter}
              onChange={v => !locked && set('volumeCharacter', v)} options={VOLUME_CHARACTER} />
            <SelectField label="MACD" value={form.macd}
              onChange={v => !locked && set('macd', v)} options={MACD_OPTIONS} />
            <NumberField label="RSI value" hint="0–100" value={form.rsiValue}
              onChange={v => !locked && set('rsiValue', v)} placeholder="e.g. 55" mono />
            <SelectField label="RSI direction" value={form.rsiDirection}
              onChange={v => !locked && set('rsiDirection', v)} options={RSI_OPTIONS} />
            <SelectField label="Bollinger bands" value={form.bollingerBands}
              onChange={v => !locked && set('bollingerBands', v)} options={BOLLINGER_OPTIONS} />
          </div>
        </section>

        {/* ── S&R ──────────────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Support & Resistance</div>
          <div className={styles.grid2}>
            <NumberField label="Nearest support" value={form.nearestSupport}
              onChange={v => !locked && set('nearestSupport', v)} placeholder="₹" mono />
            <NumberField label="Nearest resistance" value={form.nearestResistance}
              onChange={v => !locked && set('nearestResistance', v)} placeholder="₹" mono />
            <SelectField label="S&R strength" value={form.srStrength}
              onChange={v => !locked && set('srStrength', v)} options={SR_STRENGTH} />
            <SelectField label="S&R timeframe" value={form.srTimeframe}
              onChange={v => !locked && set('srTimeframe', v)} options={SR_TIMEFRAME} />
          </div>
          <SRSlCheck
            support={form.nearestSupport}
            resistance={form.nearestResistance}
            sl={sl}
            decision={decision}
          />
        </section>

        {/* ── Narrative ────────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Your Narrative</div>
          <TextArea
            label="What are you seeing?"
            value={form.narrative}
            onChange={v => !locked && set('narrative', v)}
            placeholder="Plain English — trend context, setup confluence, why this candle matters, why now."
            rows={5}
          />
        </section>

        {/* ── Decision ─────────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Your Decision</div>

          <div className={styles.decisionRow}>
            {DECISIONS.map(d => (
              <button
                key={d} type="button" disabled={locked}
                className={`${styles.decisionBtn} ${decision === d ? styles[`decision${d}`] : ''}`}
                onClick={() => setDecision(d)}
              >{d.toUpperCase()}</button>
            ))}
          </div>

          {decision && (
            <div className={styles.confidenceRow}>
              <span className={styles.confidenceLabel}>Confidence</span>
              {CONFIDENCE.map(c => (
                <button
                  key={c} type="button" disabled={locked}
                  className={`${styles.confBtn} ${confidence === c ? styles.confActive : ''}`}
                  onClick={() => setConfidence(c)}
                >{c}</button>
              ))}
            </div>
          )}

          {decision === 'Take' && (
            <div className={styles.takeExpansion}>
              <div className={styles.grid3}>
                <NumberField label="Entry price" required value={entry}
                  onChange={v => !locked && setEntry(v)} placeholder="₹" mono />
                <NumberField label="Stop loss" required value={sl}
                  onChange={v => !locked && setSl(v)} placeholder="₹" mono />
                <NumberField label="Target" required value={target}
                  onChange={v => !locked && setTarget(v)} placeholder="₹" mono />
              </div>
              {rrr !== null && (
                <div className={`${styles.rrrDisplay} ${rrrOk ? styles.rrrGood : styles.rrrBad}`}>
                  <span className={styles.rrrLabel}>RRR</span>
                  <span className={styles.rrrValue}>{rrr.toFixed(2)}</span>
                  {!rrrOk && <span className={styles.rrrWarn}>Below 1.5 minimum — AI will flag this</span>}
                </div>
              )}
            </div>
          )}

          {(decision === 'Skip' || decision === 'Watch') && (
            <div className={styles.takeExpansion}>
              <p className={styles.optionalLevelsHint}>
                Optional — enter your estimated levels so the AI can compare against its own read
              </p>
              <div className={styles.grid3}>
                <NumberField label="Entry price" value={skipEntry}
                  onChange={v => !locked && setSkipEntry(v)} placeholder="₹" mono />
                <NumberField label="Stop loss" value={skipSL}
                  onChange={v => !locked && setSkipSL(v)} placeholder="₹" mono />
                <NumberField label="Target" value={skipTarget}
                  onChange={v => !locked && setSkipTarget(v)} placeholder="₹" mono />
              </div>
              {skipRRR !== null && (
                <div className={`${styles.rrrDisplay} ${skipRRR >= 1.5 ? styles.rrrGood : styles.rrrBad}`}>
                  <span className={styles.rrrLabel}>RRR</span>
                  <span className={styles.rrrValue}>{skipRRR.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {error && <div className={styles.error}>{error}</div>}

        {/* ── Submit ───────────────────────────────────────────────────── */}
        {!locked && (
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !canSubmit}
              onClick={handleSubmit}
            >
              {loading ? <><span className="spinner" /> Analysing…</> : 'Submit my analysis'}
            </button>
          </div>
        )}

        {/* ── Analysis loader ───────────────────────────────────────────── */}
        {loading && <AnalysisLoader />}

        {/* ── AI Response ──────────────────────────────────────────────── */}
        {result?.analysis && (
          <ErrorBoundary onReset={handleReset}>
            <AIResponseDisplay
              analysis={result.analysis}
              userLevels={{
                decision,
                entry:  decision === 'Take' ? parseFloat(entry)      : parseFloat(skipEntry)  || null,
                sl:     decision === 'Take' ? parseFloat(sl)          : parseFloat(skipSL)     || null,
                target: decision === 'Take' ? parseFloat(target)      : parseFloat(skipTarget) || null,
                rrr:    decision === 'Take' ? rrr                     : skipRRR,
              }}
              userRead={{
                trend:          form.primaryTrend,
                chartStructure: form.chartStructure,
                pattern:        triggerPattern,
                decision,
              }}
            />
          </ErrorBoundary>
        )}

        {/* ── Chat ─────────────────────────────────────────────────────── */}
        {savedSession && (
          <ChatPanel
            session={savedSession}
            onHistoryUpdate={h => setSavedSession(s => ({ ...s, chatHistory: h }))}
          />
        )}

        {/* ── New session ──────────────────────────────────────────────── */}
        {locked && (
          <div className={styles.actions}>
            <button type="button" className="btn btn-ghost" onClick={handleReset}>
              New session
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Analysis loader ───────────────────────────────────────────────────────────

const STAGES = [
  { label: 'Reading chart…',        pct: 12 },
  { label: 'Identifying trend…',    pct: 28 },
  { label: 'Assessing pattern…',    pct: 44 },
  { label: 'Checking indicators…',  pct: 60 },
  { label: 'Building narrative…',   pct: 76 },
  { label: 'Forming verdict…',      pct: 88 },
  { label: 'Finalising…',           pct: 96 },
];

function AnalysisLoader() {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIdx(i => (i < STAGES.length - 1 ? i + 1 : i));
    }, 2800);
    return () => clearInterval(timerRef.current);
  }, []);

  const stage = STAGES[idx];

  return (
    <div className={styles.analysisLoader}>
      <div className={styles.loaderBar}>
        <div className={styles.loaderFill} style={{ width: `${stage.pct}%` }} />
      </div>
      <div className={styles.loaderStage}>
        <span className={styles.loaderDot} />
        {stage.label}
      </div>
      <p className={styles.loaderHint}>AI is reading the chart independently — this takes ~20 seconds</p>
    </div>
  );
}

// ── AI Response display (inline — extracted to AIResponse.jsx in Task 6) ─────

function ConfBadge({ c }) {
  const cls = c === 'HIGH' ? 'badge-green' : c === 'MEDIUM' ? 'badge-amber' : 'badge-red';
  return <span className={`badge ${cls}`}>{c}</span>;
}

function VerdictBadge({ v }) {
  const cls = v === 'TAKE' ? 'badge-green' : v === 'SKIP' ? 'badge-red' : 'badge-amber';
  return <span className={`badge ${cls}`}>{v}</span>;
}

function ConvictionBadge({ c }) {
  const cls = c === 'STRONG' ? 'badge-green' : 'badge-amber';
  return <span className={`badge ${cls}`}>{c}</span>;
}

function AIRow({ label, value, conf, sub }) {
  return (
    <div className={styles.aiRow}>
      <span className={styles.aiRowLabel}>{label}</span>
      <div className={styles.aiRowRight}>
        <div className={styles.aiRowTop}>
          <span className={styles.aiRowValue}>{value || '—'}</span>
          {conf && <ConfBadge c={conf} />}
        </div>
        {sub && <p className={styles.aiRowSub}>{sub}</p>}
      </div>
    </div>
  );
}

function LevelRow({ label, value, note }) {
  return (
    <div className={styles.levelRow}>
      <span className={styles.levelLabel}>{label}</span>
      <span className={styles.levelValue}>₹{value}</span>
      {note && <span className={styles.levelNote}>{note}</span>}
    </div>
  );
}

function pctDiff(user, ai) {
  if (user == null || ai == null || ai === 0) return null;
  return ((user - ai) / ai) * 100;
}

function DiffCell({ user, ai }) {
  const diff = pctDiff(user, ai);
  if (diff === null) return <span className={styles.lcEmpty}>—</span>;
  const abs = Math.abs(diff);
  const cls = abs <= 3 ? styles.lcDiffGood : abs <= 7 ? styles.lcDiffWarn : styles.lcDiffBad;
  return (
    <span className={cls}>
      {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
    </span>
  );
}

function normalizeRead(s) {
  return (s || '').toString().trim().toLowerCase();
}

// Loose match: treats differently-worded but equivalent reads as a match.
// Exact comparison for divergences with reasoning is handled by the AI's
// own whereYouWentWrong / divergences text — this is just quick visibility.
function readsMatch(user, ai) {
  const nu = normalizeRead(user);
  const na = normalizeRead(ai);
  if (!nu || !na) return null;
  return nu === na || nu.includes(na) || na.includes(nu);
}

function ReadCompareRow({ label, user, ai }) {
  const match = readsMatch(user, ai);
  const icon  = match === null ? '—' : match ? '✓' : '✗';
  const cls   = match === null ? styles.lcEmpty : match ? styles.lcDiffGood : styles.lcDiffBad;
  return (
    <div className={styles.lcRow}>
      <span className={styles.lcLabel}>{label}</span>
      <span className={styles.lcVal}>{user || '—'}</span>
      <span className={styles.lcVal}>{ai || '—'}</span>
      <span className={cls}>{icon}</span>
    </div>
  );
}

function AIResponseDisplay({ analysis, userLevels, userRead }) {
  const { whatISee, narrativeIRead, myDecision, whereYouWentWrong } = analysis;
  const hasUserLevels = userLevels?.entry != null;
  const hasAILevels  = (myDecision?.verdict === 'TAKE' || myDecision?.verdict === 'WATCH') && myDecision?.entry != null;

  return (
    <div className={styles.aiWrap}>

      {/* 1 — What I See */}
      <section className="card">
        <div className="section-label">What I See</div>
        <div className={styles.aiGrid}>
          <AIRow label="Trend"          value={whatISee?.trend?.direction}         conf={whatISee?.trend?.confidence}          sub={whatISee?.trend?.basis} />
          <AIRow label="Chart structure" value={whatISee?.chartStructure?.pattern}  conf={whatISee?.chartStructure?.confidence} />
          <AIRow label="Pattern (trigger)"  value={whatISee?.candlePattern?.name}      conf={whatISee?.candlePattern?.confidence}  sub={whatISee?.candlePattern?.reasoning} />
          {whatISee?.candleSequence && (
            <AIRow
              label="Candle sequence"
              value={whatISee.candleSequence.sequenceType}
              conf={whatISee.candleSequence.confidence}
              sub={
                (whatISee.candleSequence.sequenceReadable ? `${whatISee.candleSequence.sequenceReadable}  ·  ` : '') +
                (whatISee.candleSequence.interpretation || '') +
                (whatISee.candleSequence.contradictsTrigger && whatISee.candleSequence.contradictionNote
                  ? `  ⚠ ${whatISee.candleSequence.contradictionNote}` : '')
              }
            />
          )}
          <AIRow label="Volume"          value={whatISee?.volume?.vsAverage}        conf={whatISee?.volume?.confidence}         sub={whatISee?.volume?.note} />
          <AIRow label="MACD"            value={whatISee?.macd?.status}             conf={whatISee?.macd?.confidence} />
          <AIRow label="RSI"
            value={[whatISee?.rsi?.value != null ? String(whatISee.rsi.value) : null, whatISee?.rsi?.direction].filter(Boolean).join('  ')}
            conf={whatISee?.rsi?.confidence}
          />
          <AIRow label="Bollinger bands" value={whatISee?.bollingerBands?.status}   conf={whatISee?.bollingerBands?.confidence} />
        </div>
        {whatISee?.keyLevels && (
          <div className={styles.keyLevels}>
            <div className={styles.keyLevelRow}>
              <span className={styles.keyLevelLabel}>Support</span>
              <span className={styles.keyLevelVal}>
                {formatLevels(whatISee.keyLevels.support)}
              </span>
            </div>
            <div className={styles.keyLevelRow}>
              <span className={styles.keyLevelLabel}>Resistance</span>
              <span className={styles.keyLevelVal}>
                {formatLevels(whatISee.keyLevels.resistance)}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 1b — Your Read vs AI's Read (AI forms this independently, with no hints) */}
      {userRead && (
        <section className="card">
          <div className="section-label">Your Read vs AI&apos;s Read</div>
          <div className={styles.lcTable}>
            <div className={styles.lcHeader}>
              <span />
              <span className={styles.lcColHead}>Yours</span>
              <span className={styles.lcColHead}>AI</span>
              <span className={styles.lcColHead} />
            </div>
            <ReadCompareRow label="Trend"     user={userRead.trend}          ai={whatISee?.trend?.direction} />
            <ReadCompareRow label="Structure" user={userRead.chartStructure} ai={whatISee?.chartStructure?.pattern} />
            <ReadCompareRow label="Pattern"   user={userRead.pattern}        ai={whatISee?.candlePattern?.name} />
            <ReadCompareRow label="Decision"  user={userRead.decision?.toUpperCase()} ai={myDecision?.verdict} />
          </div>
        </section>
      )}

      {/* 2 — Narrative I Read */}
      <section className="card">
        <div className="section-label">The Narrative I Read</div>
        <p className={styles.narrativeText}>{narrativeIRead?.aiNarrative}</p>
        {narrativeIRead?.agreementWithUser && (
          <div className={styles.agreeBlock}>
            <span className={styles.agreeLabel}>Agreement</span>
            <p>{narrativeIRead.agreementWithUser}</p>
          </div>
        )}
        {narrativeIRead?.divergences && (
          <div className={styles.divergeBlock}>
            <span className={styles.agreeLabel}>Divergences</span>
            <p>{narrativeIRead.divergences}</p>
          </div>
        )}
      </section>

      {/* 3 — My Decision */}
      <section className="card">
        <div className="section-label">My Decision</div>
        <div className={styles.decisionDisplay}>
          <VerdictBadge v={myDecision?.verdict} />
          {myDecision?.conviction && <ConvictionBadge c={myDecision.conviction} />}
          <p className={styles.decisionDisplayReason}>{myDecision?.reasoning}</p>
        </div>

        {/* AI's structural reasoning for levels */}
        {hasAILevels && (
          <div className={styles.levelsTable}>
            {myDecision?.verdict === 'WATCH' && (
              <p className={styles.watchLevelsNote}>Qualifying levels — conditions under which this setup would trigger</p>
            )}
            <LevelRow label="Entry"     value={myDecision.entry}    note={myDecision.entryReasoning} />
            <LevelRow label="Stop Loss" value={myDecision.stopLoss} note={myDecision.slReasoning} />
            <LevelRow label="Target"    value={myDecision.target}   note={myDecision.targetReasoning} />
            <div className={styles.levelRow}>
              <span className={styles.levelLabel}>RRR</span>
              <span className={`${styles.levelValue} ${myDecision.rrr >= 1.5 ? styles.rrrGoodText : styles.rrrBadText}`}>
                {myDecision.rrr?.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Side-by-side levels comparison */}
        {hasUserLevels && hasAILevels && (
          <div className={styles.lcWrap}>
            <p className={styles.lcTitle}>Your levels vs AI's levels</p>
            <div className={styles.lcTable}>
              <div className={styles.lcHeader}>
                <span />
                <span className={styles.lcColHead}>Yours</span>
                <span className={styles.lcColHead}>AI</span>
                <span className={styles.lcColHead}>Diff</span>
              </div>
              {[
                { label: 'Entry',   user: userLevels.entry,  ai: myDecision.entry },
                { label: 'SL',      user: userLevels.sl,     ai: myDecision.stopLoss },
                { label: 'Target',  user: userLevels.target, ai: myDecision.target },
                { label: 'RRR',     user: userLevels.rrr,    ai: myDecision.rrr, isRRR: true },
              ].map(({ label, user, ai, isRRR }) => (
                <div key={label} className={styles.lcRow}>
                  <span className={styles.lcLabel}>{label}</span>
                  <span className={styles.lcVal}>{user != null ? (isRRR ? user.toFixed(2) : `₹${user}`) : '—'}</span>
                  <span className={styles.lcVal}>{ai  != null ? (isRRR ? ai.toFixed(2)   : `₹${ai}`)  : '—'}</span>
                  {isRRR
                    ? <span className={Math.abs((user ?? 0) - (ai ?? 0)) <= 0.2 ? styles.lcDiffGood : styles.lcDiffWarn}>
                        {user != null && ai != null ? `${user >= ai ? '+' : ''}${(user - ai).toFixed(2)}` : '—'}
                      </span>
                    : <DiffCell user={user} ai={ai} />
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {myDecision?.verdict === 'WATCH' && myDecision?.watchReason && (
          <p className={styles.watchReason}>{myDecision.watchReason}</p>
        )}
      </section>

      {/* 3b — 8-Step Checklist */}
      {myDecision?.checklistResults?.length > 0 && (
        <section className="card">
          <div className="section-label">8-Step Checklist</div>
          <div className={styles.checklist}>
            {myDecision.checklistResults.map(item => {
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
        </section>
      )}

      {/* 4 — Where You Went Wrong (only if non-empty) */}
      {whereYouWentWrong?.length > 0 && (
        <section className="card">
          <div className="section-label">Where You Went Wrong</div>
          <div className={styles.corrections}>
            {whereYouWentWrong.map((c, i) => (
              <div key={i} className={styles.correction}>
                <div className={styles.correctionHeader}>
                  <span className={styles.correctionRank}>{c.rank}</span>
                  <span className={styles.correctionField}>{c.field}</span>
                </div>
                <p className={styles.correctionText}>{c.correction}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
