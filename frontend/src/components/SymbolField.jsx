import { useState, useEffect, useRef } from 'react';
import { searchSymbols } from '../api/index.js';
import { Field } from './Field.jsx';
import styles from './SymbolField.module.css';

// Stock symbol input with typeahead against Groww's NSE instrument master —
// lets a typo (e.g. "BELRSIE" for "BELRISE") get caught while typing instead
// of surfacing as a GA001 fetch failure the next night.
export function SymbolField({ label, hint, required, value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    const query = value || '';
    if (query.trim().length < 2) return; // rendering below is gated on length >= 2, nothing to fetch

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchSymbols(query);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function pick(s) {
    onChange(s.tradingSymbol);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e) {
    if (!open || !visibleSuggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, visibleSuggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); pick(visibleSuggestions[highlighted]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const query = value || '';
  const queryLongEnough = query.trim().length >= 2;
  const visibleSuggestions = queryLongEnough ? suggestions : [];
  const isExactMatch = visibleSuggestions.some(s => s.tradingSymbol === query.toUpperCase());
  const showNoMatches = queryLongEnough && !loading && visibleSuggestions.length === 0;

  return (
    <Field label={label} hint={hint} required={required}>
      <div className={styles.wrap} ref={boxRef}>
        <input
          type="text"
          value={query}
          placeholder={placeholder ?? ''}
          autoComplete="off"
          onChange={e => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && (visibleSuggestions.length > 0 || showNoMatches) && (
          <ul className={styles.dropdown}>
            {visibleSuggestions.map((s, i) => (
              <li
                key={s.tradingSymbol}
                className={i === highlighted ? styles.active : ''}
                onMouseDown={() => pick(s)}
              >
                <span className={styles.symbol}>{s.tradingSymbol}</span>
                <span className={styles.name}>{s.name}</span>
              </li>
            ))}
            {showNoMatches && (
              <li className={styles.empty}>No NSE match found — double-check spelling</li>
            )}
          </ul>
        )}
        {!open && !isExactMatch && !loading && visibleSuggestions.length > 0 && (
          <div className={styles.warning} onMouseDown={() => setOpen(true)}>
            Not an exact NSE match — click to see suggestions
          </div>
        )}
        {!open && showNoMatches && (
          <div className={styles.warning}>No NSE match found — double-check spelling</div>
        )}
      </div>
    </Field>
  );
}
