import { useState } from 'react';
import styles from './ComparisonOutput.module.css';

const CONF = { HIGH: 'badge-green', MEDIUM: 'badge-amber', LOW: 'badge-red' };

function ConfBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${CONF[value] ?? 'badge-muted'}`}>{value}</span>;
}

// Extract a displayable value from a level that may be a primitive or {level, note} object
function lvl(item) {
  if (item == null) return null;
  if (typeof item === 'object') return item.level ?? item.price ?? item.value ?? String(Object.values(item)[0]);
  return item;
}

// Truncate a long AI text field to the first sentence or N chars
function short(text, n = 80) {
  if (!text) return '—';
  const firstSentence = text.split(/[.。]/)[0].trim();
  if (firstSentence.length <= n) return firstSentence;
  return firstSentence.slice(0, n) + '…';
}

function AnnotationGrid({ annotation }) {
  if (!annotation) return null;
  const { trend, chartStructure, candlePattern, volume, indicators, keyLevels } = annotation;

  const rows = [
    {
      key: 'Trend',
      value: trend?.direction || '—',
      sub: trend?.duration,
      conf: trend?.confidence,
    },
    {
      key: 'Structure',
      value: short(chartStructure?.pattern),
      conf: chartStructure?.confidence,
    },
    {
      key: 'Pattern',
      value: candlePattern?.name || 'No pattern identified',
      sub: candlePattern?.quality,
      conf: candlePattern?.confidence,
    },
    {
      key: 'Volume',
      value: volume?.vsAverage || '—',
      sub: volume?.vsAverage
        ? (volume.supportsTrade ? 'Supports trade' : 'Does not support trade')
        : undefined,
      conf: volume?.confidence,
    },
    {
      key: 'MACD',
      value: short(indicators?.macd?.status),
      conf: indicators?.macd?.confidence,
    },
    {
      key: 'RSI',
      value: indicators?.rsi?.value != null
        ? `${indicators.rsi.value} — ${indicators.rsi.direction}`
        : indicators?.rsi?.direction || '—',
      conf: indicators?.rsi?.confidence,
    },
    {
      key: 'Bollinger',
      value: short(indicators?.bollingerBands?.status),
      conf: indicators?.bollingerBands?.confidence,
    },
  ].filter(r => r.value && r.value !== '—');

  return (
    <div className={styles.annoCard}>
      <div className="section-label">AI Read</div>
      <div className={styles.annoRows}>
        {rows.map(r => (
          <div key={r.key} className={styles.annoRow}>
            <span className={styles.annoKey}>{r.key}</span>
            <div className={styles.annoRight}>
              <span className={styles.annoVal}>{r.value}</span>
              {r.sub && <span className={styles.annoSub}>{r.sub}</span>}
            </div>
            <ConfBadge value={r.conf} />
          </div>
        ))}
      </div>

      {/* Key levels */}
      {(keyLevels?.support?.length > 0 || keyLevels?.resistance?.length > 0) && (
        <div className={styles.annoLevels}>
          {keyLevels.support?.slice(0, 2).map((s, i) => (
            <div key={i} className={styles.annoLevel}>
              <span className={styles.levelTag}>S</span>
              <span className={`mono ${styles.levelVal} accent`}>{lvl(s)}</span>
            </div>
          ))}
          {keyLevels.resistance?.slice(0, 2).map((r, i) => (
            <div key={i} className={styles.annoLevel}>
              <span className={`${styles.levelTag} ${styles.levelTagR}`}>R</span>
              <span className={`mono ${styles.levelVal} danger`}>{lvl(r)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, match, userRead, aiRead, note }) {
  const [expanded, setExpanded] = useState(false);
  const hasNote = !!note;

  return (
    <div className={`${styles.cmpRow} ${match === false ? styles.cmpMismatch : match === true ? styles.cmpMatch : ''}`}>
      <div className={styles.cmpHeader}>
        <span className={styles.cmpLabel}>{label}</span>
        <span className={`${styles.cmpIcon} ${match === true ? styles.iconMatch : match === false ? styles.iconMismatch : styles.iconNeutral}`}>
          {match === true ? '✓' : match === false ? '✗' : '—'}
        </span>
      </div>

      <div className={styles.cmpReads}>
        <div className={styles.cmpRead}>
          <span className={styles.cmpWho}>You</span>
          <span className={styles.cmpVal}>{userRead || '—'}</span>
        </div>
        <div className={styles.cmpDivider} />
        <div className={styles.cmpRead}>
          <span className={styles.cmpWho}>AI</span>
          <span className={styles.cmpVal}>{aiRead || '—'}</span>
        </div>
      </div>

      {hasNote && match === false && (
        <div className={styles.cmpNote}>
          <span className={styles.cmpArrow}>→</span>
          <span className={expanded ? '' : styles.cmpNoteClamp}>{note}</span>
          {note.length > 120 && (
            <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const VERDICT_CONFIG = {
  TRADE: { label: 'TRADE',  cls: styles.verdictTrade, icon: '▲' },
  PASS:  { label: 'PASS',   cls: styles.verdictPass,  icon: '✕' },
  WATCH: { label: 'WATCH',  cls: styles.verdictWatch, icon: '◎' },
};

function SetupAssessment({ assessment }) {
  if (!assessment || typeof assessment !== 'object') return null;
  const { checks, checklistScore, proposedLevels, verdict, verdictReason } = assessment;
  const vc = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.WATCH;
  const safeChecks = Array.isArray(checks) ? checks : [];

  return (
    <div className={`${styles.assessCard} ${vc.cls}`}>
      {/* Verdict banner */}
      <div className={styles.verdictRow}>
        <div className={styles.verdictLeft}>
          <span className={styles.verdictIcon}>{vc.icon}</span>
          <span className={styles.verdictLabel}>{vc.label}</span>
        </div>
        <span className={styles.checkScore}>{checklistScore} checks passed</span>
      </div>

      {verdictReason && (
        <p className={styles.verdictReason}>{verdictReason}</p>
      )}

      {/* Checklist */}
      {safeChecks.length > 0 && (
        <div className={styles.checkList}>
          {safeChecks.map((c, i) => (
            <div key={i} className={styles.checkItem}>
              <span className={c.passed ? styles.checkPass : styles.checkFail}>
                {c.passed ? '✓' : '✗'}
              </span>
              <div className={styles.checkBody}>
                <span className={styles.checkLabel}>{c.label}</span>
                {c.note && <span className={styles.checkNote}>{c.note}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proposed levels */}
      {proposedLevels && (proposedLevels.entry || proposedLevels.stopLoss || proposedLevels.target) && (
        <div className={styles.levels}>
          <div className="section-label" style={{ marginBottom: 8 }}>AI Proposed Levels</div>
          <div className={styles.levelRow}>
            {proposedLevels.entry != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Entry</span>
                <span className={`mono ${styles.levelVal}`}>₹{proposedLevels.entry}</span>
              </div>
            )}
            {proposedLevels.stopLoss != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Stop Loss</span>
                <span className={`mono ${styles.levelVal} danger`}>₹{proposedLevels.stopLoss}</span>
              </div>
            )}
            {proposedLevels.target != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>Target</span>
                <span className={`mono ${styles.levelVal} accent`}>₹{proposedLevels.target}</span>
              </div>
            )}
            {proposedLevels.rrr != null && (
              <div className={styles.levelCell}>
                <span className={styles.levelKey}>RRR</span>
                <span className={`mono ${styles.levelVal} ${parseFloat(proposedLevels.rrr) >= 1.5 ? 'accent' : 'danger'}`}>
                  {proposedLevels.rrr} {parseFloat(proposedLevels.rrr) >= 1.5 ? '✓' : '✗'}
                </span>
              </div>
            )}
          </div>
          {proposedLevels.reasoning && (
            <p className={styles.levelReasoning}>{proposedLevels.reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComparisonOutput({ result, saved, onNewSession }) {
  const { analysis, imagePath } = result;
  const { aiAnnotation, comparison, setupAssessment } = analysis ?? {};

  const agreementCls = {
    HIGH: styles.agreeHigh, MEDIUM: styles.agreeMed, LOW: styles.agreeLow,
  }[comparison?.overallAgreement] ?? '';

  return (
    <div className={styles.wrap}>

      {/* ── Chart image ── */}
      {imagePath && (
        <div className={styles.chartWrap}>
          <img src={`http://localhost:3001${imagePath}`} alt="chart" className={styles.chart} />
        </div>
      )}

      {/* ── AI read grid ── */}
      <AnnotationGrid annotation={aiAnnotation} />

      {/* ── Comparison ── */}
      <div className={styles.cmpCard}>
        <div className={styles.cmpCardHeader}>
          <div className="section-label" style={{ marginBottom: 0 }}>Your Read vs AI Read</div>
          {comparison?.overallAgreement && (
            <span className={`${styles.agreeTag} ${agreementCls}`}>
              {comparison.overallAgreement} agreement
            </span>
          )}
        </div>

        <div className={styles.cmpRows}>
          {[
            { label: 'Trend',           field: 'trend'          },
            { label: 'Chart Structure', field: 'chartStructure' },
            { label: 'Candle Pattern',  field: 'candlePattern'  },
            { label: 'Volume',          field: 'volume'         },
            { label: 'Indicators',      field: 'indicators'     },
            { label: 'S&R Levels',      field: 'srLevels'       },
          ].map(({ label, field }) => (
            <CompareRow
              key={field}
              label={label}
              match={comparison?.[field]?.match}
              userRead={comparison?.[field]?.userRead}
              aiRead={comparison?.[field]?.aiRead}
              note={comparison?.[field]?.note}
            />
          ))}
        </div>
      </div>

      {/* ── Setup assessment + verdict ── */}
      <SetupAssessment assessment={setupAssessment} />

      {/* ── Learning point ── */}
      {comparison?.primaryLearningPoint && (
        <div className={styles.learningPoint}>
          <div className={styles.lpLabel}>Primary Learning Point</div>
          <p className={styles.lpText}>{comparison.primaryLearningPoint}</p>
          {comparison.learningTags?.length > 0 && (
            <div className={styles.lpTags}>
              {comparison.learningTags.map(tag => (
                <span key={tag} className="badge badge-muted">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div className={styles.footer}>
        {saved && <span className={styles.savedNote}>✓ Saved to Journal</span>}
        <button className="btn btn-ghost" onClick={onNewSession}>New session</button>
      </div>
    </div>
  );
}
