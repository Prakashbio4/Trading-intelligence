import { useState, useEffect, useRef, useCallback } from 'react';
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
  const backfilledRef = useRef(new Set());

  const trimmedSymbol = (symbol || '').trim().toUpperCase();

  // Kick off (or skip, if already done) a deep history backfill for a symbol
  // that just settled as the chart's active symbol, then — once it actually
  // lands new data — force a re-fetch of bars so it shows up without a
  // manual reload. Only called from the same settle-point as setSymbol
  // (widget creation + the debounced symbol-switch below), never on raw
  // keystrokes, so a partial string typed mid-word never triggers this.
  const backfillAndRefresh = useCallback((sym) => {
    if (backfilledRef.current.has(sym)) return;
    backfilledRef.current.add(sym);

    backfillSymbolHistory(sym)
      .then(result => {
        if (result?.skipped) return; // already had full history — nothing changed
        if (activeSymbolRef.current !== sym) return; // user's since moved to another symbol
        const widget = widgetRef.current;
        if (!widget) return;
        widget.chartReady().then(() => widget.activeChart().setSymbol(sym));
      })
      .catch(() => {
        // Best-effort — the chart still works off whatever history already
        // exists even if this call fails (e.g. Groww auth is down).
      });
  }, []);

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
    // 45s update frequency (was 1hr) — UDFCompatibleDatafeed's built-in
    // polling re-hits /history at this interval, which now overlays a live
    // "today" bar (see backend/routes/datafeed.js), giving the chart a
    // near-real-time price without any streaming infrastructure.
    const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(`${BASE}/datafeed/udf`, 45000);

    const widget = new window.TradingView.widget({
      symbol: trimmedSymbol,
      interval: 'D',
      container: containerRef.current,
      datafeed,
      library_path: '/tradingview/charting_library/',
      locale: 'en',
      theme: 'light',
      autosize: true,
      timezone: 'Asia/Kolkata',
      // Bottom range-selector toolbar. `text` must match the library's
      // required <integer><y|m|d> format (verified against TradingView's
      // docs) — "All" has no native keyword, so it's approximated as a huge
      // duration with `title` overriding the displayed label. Resolution is
      // pinned to 'D' on every entry since /datafeed/udf only ever serves
      // daily bars; entries requesting an unsupported resolution get hidden
      // by the library rather than erroring, but 'D' is what we actually want
      // anyway.
      time_frames: [
        { text: '1d', resolution: 'D', title: '1D', description: '1 Day' },
        { text: '5d', resolution: 'D', title: '5D', description: '5 Days' },
        { text: '1m', resolution: 'D', title: '1M', description: '1 Month' },
        { text: '3m', resolution: 'D', title: '3M', description: '3 Months' },
        { text: '6m', resolution: 'D', title: '6M', description: '6 Months' },
        { text: '1y', resolution: 'D', title: '1Y', description: '1 Year' },
        { text: '5y', resolution: 'D', title: '5Y', description: '5 Years' },
        { text: '1000y', resolution: 'D', title: 'All', description: 'All' },
      ],
    });
    widgetRef.current = widget;
    widget.chartReady().then(() => {
      // The library restores a previously saved layout (incl. its theme)
      // from local storage on load, which silently overrides the `theme`
      // constructor option above for any browser that already has a saved
      // chart. changeTheme forces it regardless of what was saved.
      widget.changeTheme('light');
      addDefaultStudies(widget);
    });
    backfillAndRefresh(trimmedSymbol);

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === 'function') {
        widgetRef.current.remove();
      }
      widgetRef.current = null;
    };
  }, [librariesReady, trimmedSymbol, backfillAndRefresh]);

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
      backfillAndRefresh(trimmedSymbol);
    }, SYMBOL_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [trimmedSymbol, backfillAndRefresh]);

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
