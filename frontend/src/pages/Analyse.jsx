import { useState, useMemo, useEffect, useRef } from 'react';
import UploadZone from '../components/UploadZone.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { SelectField, NumberField, TextField, TextArea } from '../components/Field.jsx';
import { analyzeUnified, saveSession } from '../api/index.js';
import {
  TREND_OPTIONS, TREND_DURATION, STOCK_PHASE, CHART_STRUCTURE, OPPOSING_STRUCTURE,
  SINGLE_CANDLE_TYPES, CANDLE_PATTERN_GROUPS,
  PATTERN_DIRECTION, PATTERN_QUALITY, PRIOR_TREND_MATCH,
  VOLUME_VS_AVG, VOLUME_CHARACTER, MACD_OPTIONS, RSI_OPTIONS, BOLLINGER_OPTIONS, SR_CONFIDENCE,
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

const LOOKBACK      = [1, 2, 3, 4, 5];
const CHART_SOURCES = ['Kite', 'TradingView', 'Chartink', 'Other'];
const DECISIONS     = ['Take', 'Skip', 'Watch'];
const CONFIDENCE    = ['High', 'Medium', 'Low'];

function initForm() {
  return {
    ticker: '',
    date: new Date().toISOString().split('T')[0],
    lookbackWindow: 3,
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
    srConfidence: '',
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
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [savedSession, setSavedSession] = useState(null);
  const [error,        setError]        = useState(null);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function setSeq(day, field, val) {
    setSequence(s => s.map(r => r.day === day ? { ...r, [field]: val } : r));
  }

  const rrr    = useMemo(() => calcRRR(entry, sl, target), [entry, sl, target]);
  const rrrOk  = rrr !== null && rrr >= 1.5;
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
          <div className={styles.lookbackRow}>
            <span className={styles.lookbackLabel}>Lookback window</span>
            {LOOKBACK.map(n => (
              <button
                key={n} type="button"
                disabled={locked}
                className={`${styles.lookbackBtn} ${form.lookbackWindow === n ? styles.lookbackActive : ''}`}
                onClick={() => set('lookbackWindow', n)}
              >{n}</button>
            ))}
            <span className={styles.lookbackUnit}>sessions</span>
          </div>
        </section>

        {/* ── Context ──────────────────────────────────────────────────── */}
        <section className="card">
          <div className="section-label">Context</div>
          <div className={styles.grid3}>
            <TextField label="Stock symbol" required value={form.ticker}
              onChange={v => !locked && set('ticker', v.toUpperCase())}
              placeholder="e.g. DEEPIND" />
            <TextField label="Date" value={form.date}
              onChange={v => !locked && set('date', v)} />
            <SelectField label="Chart source" value={form.chartSource}
              onChange={v => !locked && set('chartSource', v)} options={CHART_SOURCES} />
          </div>
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
          <div className={styles.grid3}>
            <NumberField label="Nearest support" value={form.nearestSupport}
              onChange={v => !locked && set('nearestSupport', v)} placeholder="₹" mono />
            <NumberField label="Nearest resistance" value={form.nearestResistance}
              onChange={v => !locked && set('nearestResistance', v)} placeholder="₹" mono />
            <SelectField label="S&R confidence" value={form.srConfidence}
              onChange={v => !locked && set('srConfidence', v)} options={SR_CONFIDENCE} />
          </div>
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
            <AIResponseDisplay analysis={result.analysis} />
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

function AIResponseDisplay({ analysis }) {
  const { whatISee, narrativeIRead, myDecision, whereYouWentWrong } = analysis;

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
                {[].concat(whatISee.keyLevels.support).join(' · ')}
              </span>
            </div>
            <div className={styles.keyLevelRow}>
              <span className={styles.keyLevelLabel}>Resistance</span>
              <span className={styles.keyLevelVal}>
                {[].concat(whatISee.keyLevels.resistance).join(' · ')}
              </span>
            </div>
          </div>
        )}
      </section>

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
          <p className={styles.decisionDisplayReason}>{myDecision?.reasoning}</p>
        </div>
        {myDecision?.verdict === 'TAKE' && myDecision?.entry != null && (
          <div className={styles.levelsTable}>
            <LevelRow label="Entry"     value={myDecision.entry}    note={myDecision.entryReasoning} />
            <LevelRow label="Stop Loss" value={myDecision.stopLoss} note={myDecision.slReasoning} />
            <LevelRow label="Target"    value={myDecision.target}   note={myDecision.targetReasoning} />
            <div className={styles.levelRow}>
              <span className={styles.levelLabel}>RRR</span>
              <span className={`${styles.levelValue} ${myDecision.rrr >= 1.5 ? styles.rrrGoodText : styles.rrrBadText}`}>
                {myDecision.rrr?.toFixed(2)}
              </span>
            </div>
            {myDecision.userLevelComparison && (
              <p className={styles.levelComparison}>{myDecision.userLevelComparison}</p>
            )}
          </div>
        )}
      </section>

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
