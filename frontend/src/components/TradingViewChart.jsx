import { useState, useEffect, useRef } from 'react';
import { backfillSymbolHistory } from '../api/index.js';
import styles from './TradingViewChart.module.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SYMBOL_DEBOUNCE_MS = 500;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-sipy-tv="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.sipyTv = src;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function addDefaultStudies(widget) {
  const chart = widget.chart();
  chart.createStudy('Bollinger Bands', true, false);
  chart.createStudy('Volume', false, false);
  chart.createStudy('Relative Strength Index', false, false);
  chart.createStudy('MACD', false, false);
}

// Embeddable TradingView Advanced Charts widget, driven by a `symbol` prop
// rather than owning its own symbol picker — the caller (Analyse) controls
// which stock is being charted. Symbol changes are debounced so a symbol
// still being typed doesn't thrash the widget with partial/invalid tickers.
export default function TradingViewChart({ symbol }) {
  const [librariesReady, setLibrariesReady] = useState(false);
  const [libraryError, setLibraryError] = useState('');

  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const activeSymbolRef = useRef('');
  const debounceRef = useRef(null);
  const backfillDebounceRef = useRef(null);
  const backfillTriggeredRef = useRef(new Set());

  const trimmedSymbol = (symbol || '').trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadScript('/tradingview/charting_library/charting_library.standalone.js'),
      loadScript('/tradingview/datafeeds/udf/dist/bundle.js'),
    ])
      .then(() => { if (!cancelled) setLibrariesReady(true); })
      .catch(err => { if (!cancelled) setLibraryError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // Create the widget once, when libraries + a first valid symbol are ready
  useEffect(() => {
    if (!librariesReady || trimmedSymbol.length < 2 || widgetRef.current || !containerRef.current) return;

    activeSymbolRef.current = trimmedSymbol;
    const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(`${BASE}/datafeed/udf`, 3600000);

    const widget = new window.TradingView.widget({
      symbol: trimmedSymbol,
      interval: 'D',
      container: containerRef.current,
      datafeed,
      library_path: '/tradingview/charting_library/',
      locale: 'en',
      theme: 'dark',
      autosize: true,
      timezone: 'Asia/Kolkata',
    });
    widgetRef.current = widget;
    widget.chartReady().then(() => addDefaultStudies(widget));

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === 'function') {
        widgetRef.current.remove();
      }
      widgetRef.current = null;
    };
  }, [librariesReady, trimmedSymbol]);

  // Switch symbol in-place on prop change, debounced so a symbol still being
  // typed doesn't repeatedly resolve partial/invalid tickers.
  useEffect(() => {
    if (trimmedSymbol.length < 2 || trimmedSymbol === activeSymbolRef.current) return;
    const widget = widgetRef.current;
    if (!widget) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      activeSymbolRef.current = trimmedSymbol;
      widget.chartReady().then(() => {
        widget.activeChart().setSymbol(trimmedSymbol);
      });
    }, SYMBOL_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [trimmedSymbol]);

  // Kick off a deep history backfill for every symbol typed here, so its
  // full available history is there next time it's charted — independent of
  // widget creation/switching, and independent of whether the analysis is
  // ever submitted. Debounced, and only fired once per distinct symbol per
  // component lifetime; the backend itself skips the work if this symbol
  // already has deep history stored, so re-typing an already-backfilled
  // symbol is a cheap no-op rather than a re-fetch.
  useEffect(() => {
    if (trimmedSymbol.length < 2 || backfillTriggeredRef.current.has(trimmedSymbol)) return;

    clearTimeout(backfillDebounceRef.current);
    backfillDebounceRef.current = setTimeout(() => {
      backfillTriggeredRef.current.add(trimmedSymbol);
      backfillSymbolHistory(trimmedSymbol).catch(() => {
        // Best-effort — the chart still works off whatever history already
        // exists even if this call fails (e.g. Groww auth is down).
      });
    }, SYMBOL_DEBOUNCE_MS);

    return () => clearTimeout(backfillDebounceRef.current);
  }, [trimmedSymbol]);

  if (libraryError) {
    return (
      <div className={styles.notice}>
        <p>TradingView library not found.</p>
        <p className={styles.noticeHint}>
          Run <code>git submodule update --init</code> to fetch the{' '}
          <code>frontend/public/tradingview</code> submodule, then hard-refresh.
        </p>
      </div>
    );
  }

  if (trimmedSymbol.length < 2) {
    return (
      <div className={styles.notice}>
        <p>Enter a stock symbol above to load its chart.</p>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer} ref={containerRef}>
      {!librariesReady && <p className={styles.loading}>Loading chart library…</p>}
    </div>
  );
}
