import { useState } from 'react';
import UploadZone from '../components/UploadZone.jsx';
import { SelectField, NumberField, TextField, TextArea } from '../components/Field.jsx';
import ComparisonOutput from '../components/ComparisonOutput.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { analyzeModule1, saveSession } from '../api/index.js';
import {
  TREND_OPTIONS, TREND_DURATION, CHART_STRUCTURE, OPPOSING_STRUCTURE,
  CANDLE_PATTERNS, PATTERN_DIRECTION, PATTERN_QUALITY, PRIOR_TREND_MATCH,
  VOLUME_VS_AVG, MACD_OPTIONS, RSI_OPTIONS, BOLLINGER_OPTIONS, SR_CONFIDENCE,
} from '../api/options.js';
import styles from './Learn.module.css';

const LOOKBACK = [1, 2, 3, 4, 5];
const CHART_SOURCES = ['Kite', 'TradingView', 'Chartink', 'Other'];

function initForm() {
  return {
    ticker: '', date: new Date().toISOString().split('T')[0], lookbackWindow: 3,
    chartSource: '',
    trend: '', trendDuration: '', chartStructure: '', opposingStructure: '',
    candlePattern: '', patternDirection: '', patternQuality: '', priorTrendMatch: '',
    volumeVsAvg: '', macd: '', rsiValue: '', rsiDirection: '', bollingerBands: '',
    supportLevel: '', resistanceLevel: '', srConfidence: '',
    notes: '',
  };
}

export default function Learn() {
  const [chartFile, setChartFile] = useState(null);
  const [form, setForm] = useState(initForm());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!chartFile) { setError('Please upload a chart image first.'); return; }
    if (!form.ticker.trim()) { setError('Stock symbol is required.'); return; }
    if (!form.trend) { setError('Primary trend is required.'); return; }
    if (!form.candlePattern) { setError('Candle pattern is required.'); return; }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append('chart', chartFile);
    fd.append('userRead', JSON.stringify(form));

    try {
      const data = await analyzeModule1(fd);
      setResult(data);

      // Auto-save to journal
      const tags = data.analysis?.comparison?.learningTags ?? [];
      await saveSession({
        module: '1',
        ticker: form.ticker.toUpperCase(),
        timeframe: form.chartSource,
        date: form.date,
        lookbackWindow: form.lookbackWindow,
        imagePath: data.imagePath,
        promptVersion: data.promptVersion,
        userInput: form,
        aiAnnotation: data.analysis?.aiAnnotation ?? null,
        aiAnalysis: data.analysis,
        learningTags: tags,
        decision: null,
        aiVerdict: 'LEARN',
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
        <div className={styles.tag}>Module 1</div>
        <h1 className={styles.title}>Chart Eye Training</h1>
        <p className={styles.subtitle}>
          Upload a chart. Fill in what you see — no hints. Submit. See how your read compares to the AI's independent analysis.
        </p>
      </div>

      {!result ? (
        <form className={styles.body} onSubmit={handleSubmit}>
          {/* ── Upload ── */}
          <section className="card">
            <div className="section-label">Step 1 — Upload your chart</div>
            <UploadZone onFile={setChartFile} disabled={loading} />
            <div className={styles.lookbackRow}>
              <span className={styles.lookbackLabel}>Lookback window</span>
              {LOOKBACK.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.lookbackBtn} ${form.lookbackWindow === n ? styles.lookbackActive : ''}`}
                  onClick={() => set('lookbackWindow', n)}
                >
                  {n}
                </button>
              ))}
              <span className={styles.lookbackUnit}>sessions</span>
            </div>
          </section>

          {/* ── Context ── */}
          <section className="card">
            <div className="section-label">Context</div>
            <div className={styles.grid2}>
              <TextField label="Stock symbol" required value={form.ticker}
                onChange={v => set('ticker', v.toUpperCase())} placeholder="e.g. DEEPIND" />
              <TextField label="Date" value={form.date} onChange={v => set('date', v)} />
              <SelectField label="Chart source" value={form.chartSource}
                onChange={v => set('chartSource', v)} options={CHART_SOURCES} />
            </div>
          </section>

          {/* ── Trend ── */}
          <section className="card">
            <div className="section-label">Trend Read</div>
            <div className={styles.grid2}>
              <SelectField label="Primary trend" required value={form.trend}
                onChange={v => set('trend', v)} options={TREND_OPTIONS} />
              <SelectField label="Trend duration" required value={form.trendDuration}
                onChange={v => set('trendDuration', v)} options={TREND_DURATION} />
              <SelectField label="Chart structure" value={form.chartStructure}
                onChange={v => set('chartStructure', v)} options={CHART_STRUCTURE} />
              <SelectField label="Opposing structure" value={form.opposingStructure}
                onChange={v => set('opposingStructure', v)} options={OPPOSING_STRUCTURE} />
            </div>
          </section>

          {/* ── Candle Pattern ── */}
          <section className="card">
            <div className="section-label">Candle Pattern</div>
            <div className={styles.grid2}>
              <SelectField label="Pattern identified" required value={form.candlePattern}
                onChange={v => set('candlePattern', v)} options={CANDLE_PATTERNS} />
              <SelectField label="Pattern direction" value={form.patternDirection}
                onChange={v => set('patternDirection', v)} options={PATTERN_DIRECTION} />
              <SelectField label="Pattern quality" value={form.patternQuality}
                onChange={v => set('patternQuality', v)} options={PATTERN_QUALITY} />
              <SelectField label="Prior trend match" value={form.priorTrendMatch}
                onChange={v => set('priorTrendMatch', v)} options={PRIOR_TREND_MATCH} />
            </div>
          </section>

          {/* ── Volume & Indicators ── */}
          <section className="card">
            <div className="section-label">Volume & Indicators</div>
            <div className={styles.grid2}>
              <SelectField label="Volume vs average" value={form.volumeVsAvg}
                onChange={v => set('volumeVsAvg', v)} options={VOLUME_VS_AVG} />
              <SelectField label="MACD" value={form.macd}
                onChange={v => set('macd', v)} options={MACD_OPTIONS} />
              <NumberField label="RSI value" hint="0–100" value={form.rsiValue}
                onChange={v => set('rsiValue', v)} placeholder="e.g. 44" mono />
              <SelectField label="RSI direction" value={form.rsiDirection}
                onChange={v => set('rsiDirection', v)}
                options={['Rising', 'Falling', 'Flat', 'Cannot read']} />
              <SelectField label="Bollinger bands" value={form.bollingerBands}
                onChange={v => set('bollingerBands', v)} options={BOLLINGER_OPTIONS} />
            </div>
          </section>

          {/* ── S&R ── */}
          <section className="card">
            <div className="section-label">Support & Resistance</div>
            <div className={styles.grid3}>
              <NumberField label="Nearest support" value={form.supportLevel}
                onChange={v => set('supportLevel', v)} placeholder="₹" mono />
              <NumberField label="Nearest resistance" value={form.resistanceLevel}
                onChange={v => set('resistanceLevel', v)} placeholder="₹" mono />
              <SelectField label="S&R confidence" value={form.srConfidence}
                onChange={v => set('srConfidence', v)} options={SR_CONFIDENCE} />
            </div>
          </section>

          {/* ── Notes ── */}
          <section className="card">
            <div className="section-label">Your Notes</div>
            <TextArea label="What are you seeing?" value={form.notes}
              onChange={v => set('notes', v)}
              placeholder="Describe in plain English what the chart is telling you..."
              rows={5} />
          </section>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Analysing…</> : 'Submit my analysis'}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}
          <ErrorBoundary onReset={handleReset}>
            <ComparisonOutput
              result={result}
              userInput={form}
              saved={saved}
              onNewSession={handleReset}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
