import { useState, useEffect, useRef, useCallback } from 'react';
import { SymbolField } from '../components/SymbolField.jsx';
import { getUniverse } from '../api/index.js';
import styles from './Chart.module.css';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export default function Chart() {
  const [librariesReady, setLibrariesReady] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [universeSymbols, setUniverseSymbols] = useState([]);
  const [symbolInput, setSymbolInput] = useState('');
  const [error, setError] = useState('');

  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const activeSymbolRef = useRef('');

  // Load the TradingView library scripts — dropped in manually by the user
  // under frontend/public/, since they're TradingView-licensed and not
  // redistributable via git.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadScript('/charting_library/charting_library.standalone.js'),
      loadScript('/datafeeds/udf/dist/bundle.js'),
    ])
      .then(() => { if (!cancelled) setLibrariesReady(true); })
      .catch(err => { if (!cancelled) setLibraryError(err.message); });
    return () => { cancelled = true; };
  }, []);

  // Default symbol: first active stock in the universe
  useEffect(() => {
    getUniverse()
      .then(rows => {
        const symbols = rows.filter(r => r.active).map(r => r.symbol);
        setUniverseSymbols(symbols);
        if (symbols.length) setSymbolInput(symbols[0]);
      })
      .catch(e => setError(e.message));
  }, []);

  const applySymbol = useCallback(symbol => {
    if (!symbol || symbol === activeSymbolRef.current) return;
    activeSymbolRef.current = symbol;

    const widget = widgetRef.current;
    if (!widget) return;
    widget.chartReady().then(() => {
      widget.activeChart().setSymbol(symbol);
    });
  }, []);

  // Create the widget once, when libraries + an initial symbol are ready
  useEffect(() => {
    if (!librariesReady || !symbolInput || widgetRef.current || !containerRef.current) return;

    activeSymbolRef.current = symbolInput;
    const datafeed = new window.Datafeeds.UDFCompatibleDatafeed(`${BASE}/datafeed/udf`, 3600000);

    const widget = new window.TradingView.widget({
      symbol: symbolInput,
      interval: 'D',
      container: containerRef.current,
      datafeed,
      library_path: '/charting_library/',
      locale: 'en',
      theme: 'dark',
      autosize: true,
      timezone: 'Asia/Kolkata',
    });
    widgetRef.current = widget;

    widget.chartReady().then(() => {
      widget.activeChart().onSymbolChanged().subscribe(null, symbolInfo => {
        const newSymbol = symbolInfo?.name;
        if (newSymbol && newSymbol !== activeSymbolRef.current) {
          activeSymbolRef.current = newSymbol;
          setSymbolInput(newSymbol);
        }
      });
    });

    return () => {
      if (widgetRef.current && typeof widgetRef.current.remove === 'function') {
        widgetRef.current.remove();
      }
      widgetRef.current = null;
    };
  }, [librariesReady, symbolInput]);

  // Switch symbol in-place when the field resolves to a known universe symbol,
  // instead of firing on every keystroke while the user is still typing.
  useEffect(() => {
    if (universeSymbols.includes(symbolInput)) applySymbol(symbolInput);
  }, [symbolInput, universeSymbols, applySymbol]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Chart</h1>
          <p className={styles.sub}>TradingView Advanced Charts — daily NSE data</p>
        </div>
        <div className={styles.symbolBox}>
          <SymbolField
            label="Symbol"
            value={symbolInput}
            onChange={setSymbolInput}
            placeholder="Symbol (e.g. RELIANCE)"
          />
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {libraryError ? (
        <div className={styles.notice}>
          <p>TradingView library not found.</p>
          <p className={styles.noticeHint}>
            Copy your <code>charting_library/</code> and <code>datafeeds/</code> folders into{' '}
            <code>frontend/public/</code>, then hard-refresh.
          </p>
        </div>
      ) : (
        <div className={styles.chartContainer} ref={containerRef}>
          {!librariesReady && <p className={styles.loading}>Loading chart library…</p>}
        </div>
      )}
    </div>
  );
}
