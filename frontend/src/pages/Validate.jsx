import { useState, useMemo } from 'react';
import UploadZone from '../components/UploadZone.jsx';
import { SelectField, NumberField, TextField, TextArea } from '../components/Field.jsx';
import ValidationOutput from '../components/ValidationOutput.jsx';
import { analyzeModule3, saveSession } from '../api/index.js';
import {
  TREND_OPTIONS, TREND_DURATION, STOCK_PHASE, CHART_STRUCTURE, OPPOSING_STRUCTURE,
  CANDLE_PATTERNS, PATTERN_DIRECTION, PATTERN_QUALITY, PRIOR_TREND_MATCH,
  VOLUME_VS_AVG, VOLUME_CHARACTER, MACD_OPTIONS, RSI_OPTIONS, BOLLINGER_OPTIONS,
  DECISION_OPTIONS,
} from '../api/options.js';
import styles from './Validate.module.css';

const LOOKBACK = [1, 2, 3, 4, 5];

function initForm() {
  return {
    ticker: '', date: new Date().toISOString().split('T')[0], lookbackWindow: 3,
    // Big picture
    trend: '', trendDuration: '', stockPhase: '', chartStructure: '', opposingStructure: '',
    // Setup
    volumeCharacter: '', volumeVsAvg: '', bollingerBands: '', macd: '',
    rsiDirection: '', rsiValue: '',
    // Trigger
    candlePattern: '', patternDirection: '', patternQuality: '', priorTrendMatch: '',
    signalVolume: '',
    // Levels
    entryPrice: '', stopLoss: '', target: '',
    // S&R
    supportLevel: '', resistanceLevel: '',
    // Narrative & decision
    narrative: '', decision: 'Take',
  };
}

function calcRRR(entry, sl, target) {
  const e = parseFloat(entry), s = parseFloat(sl), t = parseFloat(target);
  if (!e || !s || !t || e === s) return null;
  return ((t - e) / (e - s)).toFixed(2);
}

export default function Validate() {
  const [chartFile, setChartFile] = useState(null);
  const [form, setForm] = useState(initForm());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  const rrr = useMemo(() => calcRRR(form.entryPrice, form.stopLoss, form.target), [form.entryPrice, form.stopLoss, form.target]);
  const rrrValid = rrr != null && parseFloat(rrr) >= 1.5;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!chartFile) { setError('Please upload a chart image first.'); return; }
    if (!form.ticker.trim()) { setError('Stock symbol is required.'); return; }
    if (!form.trend || !form.candlePattern) { setError('Trend and candle pattern are required.'); return; }
    if (!form.entryPrice || !form.stopLoss || !form.target) { setError('Entry, SL, and Target are required.'); return; }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append('chart', chartFile);
    fd.append('userAnalysis', JSON.stringify({ ...form, rrr }));

    try {
      const data = await analyzeModule3(fd);
      setResult(data);

      await saveSession({
        module: '3',
        ticker: form.ticker.toUpperCase(),
        date: form.date,
        lookbackWindow: form.lookbackWindow,
        imagePath: data.imagePath,
        promptVersion: data.promptVersion,
        userInput: { ...form, rrr },
        aiAnnotation: null,
        aiAnalysis: data.analysis,
        learningTags: data.analysis?.learningTags ?? [],
        decision: form.decision,
        aiVerdict: data.analysis?.verdict ?? null,
        entryPrice: parseFloat(form.entryPrice) || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setChartFile(null);
    setForm(initForm());
    setResult(null);
    setError(null);
    setSaved(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.tag}>Module 3</div>
        <h1 className={styles.title}>Trade Validator</h1>
        <p className={styles.subtitle}>
          Complete your full independent analysis. Submit. AI runs the Varsity checklist and returns a structured verdict.
        </p>
      </div>

      <div className={styles.layout}>
        {/* ── LEFT: form ── */}
        <div className={styles.formCol}>
          <form onSubmit={handleSubmit}>
            {/* Upload */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">Upload Chart</div>
              <UploadZone onFile={setChartFile} disabled={loading || !!result} />
              <div className={styles.lookbackRow}>
                <span className={styles.lookbackLabel}>Lookback</span>
                {LOOKBACK.map(n => (
                  <button key={n} type="button"
                    className={`${styles.lookbackBtn} ${form.lookbackWindow === n ? styles.lookbackActive : ''}`}
                    onClick={() => set('lookbackWindow', n)}>{n}</button>
                ))}
                <span className={styles.lookbackUnit}>sessions</span>
              </div>
              <div className={styles.metaRow}>
                <TextField label="Ticker" required value={form.ticker}
                  onChange={v => set('ticker', v.toUpperCase())} placeholder="DEEPIND" />
                <TextField label="Date" value={form.date} onChange={v => set('date', v)} />
              </div>
            </section>

            {/* Big Picture */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">The Big Picture</div>
              <div className={styles.grid2}>
                <SelectField label="Primary trend" required value={form.trend}
                  onChange={v => set('trend', v)} options={TREND_OPTIONS} />
                <SelectField label="Trend duration" value={form.trendDuration}
                  onChange={v => set('trendDuration', v)} options={TREND_DURATION} />
                <SelectField label="Stock phase" value={form.stockPhase}
                  onChange={v => set('stockPhase', v)} options={STOCK_PHASE} />
                <SelectField label="Dow structure" value={form.chartStructure}
                  onChange={v => set('chartStructure', v)} options={CHART_STRUCTURE} />
                <SelectField label="Opposing structure" value={form.opposingStructure}
                  onChange={v => set('opposingStructure', v)} options={OPPOSING_STRUCTURE} />
              </div>
            </section>

            {/* The Setup */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">The Setup</div>
              <div className={styles.grid2}>
                <SelectField label="Volume character" value={form.volumeCharacter}
                  onChange={v => set('volumeCharacter', v)} options={VOLUME_CHARACTER} />
                <SelectField label="Volume vs average" value={form.volumeVsAvg}
                  onChange={v => set('volumeVsAvg', v)} options={VOLUME_VS_AVG} />
                <SelectField label="Bollinger bands" value={form.bollingerBands}
                  onChange={v => set('bollingerBands', v)} options={BOLLINGER_OPTIONS} />
                <SelectField label="MACD" value={form.macd}
                  onChange={v => set('macd', v)} options={MACD_OPTIONS} />
                <SelectField label="RSI direction" value={form.rsiDirection}
                  onChange={v => set('rsiDirection', v)} options={RSI_OPTIONS} />
                <NumberField label="RSI value" hint="0–100" value={form.rsiValue}
                  onChange={v => set('rsiValue', v)} placeholder="44" mono />
              </div>
            </section>

            {/* The Trigger */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">The Trigger</div>
              <div className={styles.grid2}>
                <SelectField label="Pattern identified" required value={form.candlePattern}
                  onChange={v => set('candlePattern', v)} options={CANDLE_PATTERNS} />
                <SelectField label="Pattern direction" value={form.patternDirection}
                  onChange={v => set('patternDirection', v)} options={PATTERN_DIRECTION} />
                <SelectField label="Pattern quality" value={form.patternQuality}
                  onChange={v => set('patternQuality', v)} options={PATTERN_QUALITY} />
                <SelectField label="Prior trend match" value={form.priorTrendMatch}
                  onChange={v => set('priorTrendMatch', v)} options={PRIOR_TREND_MATCH} />
                <SelectField label="Signal day volume" value={form.signalVolume}
                  onChange={v => set('signalVolume', v)} options={VOLUME_VS_AVG} />
              </div>
            </section>

            {/* Levels */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">Your Levels</div>
              <div className={styles.grid3}>
                <NumberField label="Entry" required value={form.entryPrice}
                  onChange={v => set('entryPrice', v)} placeholder="₹" mono />
                <NumberField label="Stop Loss" required value={form.stopLoss}
                  onChange={v => set('stopLoss', v)} placeholder="₹" mono />
                <NumberField label="Target" required value={form.target}
                  onChange={v => set('target', v)} placeholder="₹" mono />
              </div>
              <div className={styles.rrrRow}>
                <span className={styles.rrrLabel}>RRR</span>
                {rrr ? (
                  <span className={`${styles.rrrVal} ${rrrValid ? styles.rrrGood : styles.rrrBad}`}>
                    {rrr} {rrrValid ? '✓' : '✗ min 1.5'}
                  </span>
                ) : (
                  <span className={styles.rrrEmpty}>Fill entry, SL, target</span>
                )}
              </div>
            </section>

            {/* S&R */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">S&R Levels</div>
              <div className={styles.grid2}>
                <NumberField label="Nearest support" value={form.supportLevel}
                  onChange={v => set('supportLevel', v)} placeholder="₹" mono />
                <NumberField label="Nearest resistance" value={form.resistanceLevel}
                  onChange={v => set('resistanceLevel', v)} placeholder="₹" mono />
              </div>
            </section>

            {/* Narrative */}
            <section className={`card ${styles.section}`}>
              <div className="section-label">Your Narrative</div>
              <TextArea label="Complete trade thesis" value={form.narrative}
                onChange={v => set('narrative', v)}
                placeholder="Describe the full trade story — big picture, setup, trigger, why now..."
                rows={6} />
              <div className={styles.decisionRow}>
                <span className={styles.decisionLabel}>Decision</span>
                {DECISION_OPTIONS.map(d => (
                  <button key={d} type="button"
                    className={`${styles.decisionBtn} ${form.decision === d ? styles.decisionActive : ''}`}
                    onClick={() => set('decision', d)}>{d}</button>
                ))}
              </div>
            </section>

            {error && <div className={styles.error}>{error}</div>}

            {!result && (
              <div className={styles.submitRow}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <><span className="spinner" /> Validating…</> : 'Submit for AI validation'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── RIGHT: AI response ── */}
        <div className={styles.resultCol}>
          {!result && !loading && (
            <div className={styles.resultPlaceholder}>
              <span className={styles.placeholderIcon}>▷</span>
              <span>AI verdict appears here after you submit</span>
            </div>
          )}
          {loading && (
            <div className={styles.resultPlaceholder}>
              <span className="spinner" />
              <span>Running Varsity checklist…</span>
            </div>
          )}
          {result && (
            <ValidationOutput
              result={result}
              saved={saved}
              onNewSession={handleReset}
            />
          )}
        </div>
      </div>
    </div>
  );
}
