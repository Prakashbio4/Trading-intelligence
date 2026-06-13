import styles from './ValidationOutput.module.css';

const VERDICT_CONFIG = {
  TAKE:       { label: 'TAKE',       cls: styles.verdictTake,   badgeCls: 'badge-green'  },
  SKIP:       { label: 'SKIP',       cls: styles.verdictSkip,   badgeCls: 'badge-red'    },
  CONDITIONAL:{ label: 'CONDITIONAL',cls: styles.verdictCond,   badgeCls: 'badge-amber'  },
  NO_TRADE:   { label: 'NO TRADE',   cls: styles.verdictSkip,   badgeCls: 'badge-red'    },
};

const CONF_CLASS = { HIGH: 'badge-green', MEDIUM: 'badge-amber', LOW: 'badge-red' };

function CheckItem({ item }) {
  const passed = item.passed;
  return (
    <div className={`${styles.checkItem} ${passed ? styles.checkPass : styles.checkFail}`}>
      <span className={styles.checkIcon}>{passed ? '✓' : '✗'}</span>
      <div className={styles.checkBody}>
        <div className={styles.checkHeader}>
          <span className={styles.checkRule}>{item.item}</span>
          <span className={`badge ${CONF_CLASS[item.confidence] ?? 'badge-muted'}`}>{item.confidence}</span>
        </div>
        <div className={styles.checkComment}>{item.comment}</div>
        {item.varsityReference && (
          <div className={styles.checkRef}>Varsity: {item.varsityReference}</div>
        )}
      </div>
    </div>
  );
}

function LevelRow({ label, valid, comment, extra }) {
  return (
    <div className={styles.levelRow}>
      <span className={`${styles.levelIcon} ${valid ? styles.levelPass : styles.levelFail}`}>
        {valid ? '✓' : '✗'}
      </span>
      <div>
        <span className={styles.levelLabel}>{label}</span>
        {extra && <span className="mono" style={{ marginLeft: 8, color: 'var(--text)' }}>{extra}</span>}
        {comment && <div className={styles.levelComment}>{comment}</div>}
      </div>
    </div>
  );
}

export default function ValidationOutput({ result, saved, onNewSession }) {
  const { analysis } = result;
  const {
    verdict, confidence, chartObservations, checklistResults,
    levelValidation, deviations, learningTags,
  } = analysis ?? {};

  const vc = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.SKIP;
  const passCount = checklistResults?.filter(c => c.passed).length ?? 0;
  const totalCount = checklistResults?.length ?? 0;

  return (
    <div className={styles.wrap}>
      {/* Verdict banner */}
      <div className={`${styles.verdictBanner} ${vc.cls}`}>
        <div className={styles.verdictMain}>
          <span className={styles.verdictLabel}>{vc.label}</span>
          <span className={`badge ${CONF_CLASS[confidence] ?? 'badge-muted'}`}>{confidence}</span>
        </div>
        <div className={styles.verdictScore}>
          {passCount}/{totalCount} checklist items passed
        </div>
      </div>

      {/* Chart observations */}
      {chartObservations && (
        <div className="card">
          <div className="section-label">Chart Observations</div>
          <div className={styles.obsGrid}>
            {chartObservations.trend && (
              <div className={styles.obsItem}>
                <span className={styles.obsKey}>Trend</span>
                <span className={styles.obsVal}>{chartObservations.trend.direction}</span>
                <span className={`badge ${CONF_CLASS[chartObservations.trend.confidence] ?? 'badge-muted'}`}>
                  {chartObservations.trend.confidence}
                </span>
              </div>
            )}
            {chartObservations.candlePattern && (
              <div className={styles.obsItem}>
                <span className={styles.obsKey}>Pattern</span>
                <span className={styles.obsVal}>
                  {chartObservations.candlePattern.name || 'No pattern identified'}
                </span>
                <span className={`badge ${CONF_CLASS[chartObservations.candlePattern.confidence] ?? 'badge-muted'}`}>
                  {chartObservations.candlePattern.confidence}
                </span>
              </div>
            )}
            {chartObservations.volume && (
              <div className={styles.obsItem}>
                <span className={styles.obsKey}>Volume</span>
                <span className={styles.obsVal}>{chartObservations.volume.assessment}</span>
              </div>
            )}
          </div>
          {(chartObservations.keyLevels?.support?.length > 0 || chartObservations.keyLevels?.resistance?.length > 0) && (
            <div className={styles.obsLevels}>
              {chartObservations.keyLevels.support?.length > 0 && (
                <span>Support: <span className="mono accent">{chartObservations.keyLevels.support.join(', ')}</span></span>
              )}
              {chartObservations.keyLevels.resistance?.length > 0 && (
                <span>Resistance: <span className="mono danger">{chartObservations.keyLevels.resistance.join(', ')}</span></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      {checklistResults?.length > 0 && (
        <div className="card">
          <div className="section-label">Varsity Checklist</div>
          <div className={styles.checklist}>
            {checklistResults.map((item, i) => <CheckItem key={i} item={item} />)}
          </div>
        </div>
      )}

      {/* Level validation */}
      {levelValidation && (
        <div className="card">
          <div className="section-label">Level Validation</div>
          <div className={styles.levels}>
            <LevelRow label="Entry" valid={levelValidation.entry?.valid}
              comment={levelValidation.entry?.comment} />
            <LevelRow label="Stop Loss" valid={levelValidation.stopLoss?.valid}
              comment={levelValidation.stopLoss?.comment}
              extra={levelValidation.stopLoss?.suggestedLevel ? `→ ₹${levelValidation.stopLoss.suggestedLevel}` : null} />
            <LevelRow label="Target" valid={levelValidation.target?.valid}
              comment={levelValidation.target?.comment} />
            <div className={styles.rrrRow}>
              <span className={styles.rrrLabel}>RRR</span>
              <span className={`mono ${levelValidation.rrr?.meetsMinimum ? 'accent' : 'danger'}`}>
                {levelValidation.rrr?.calculated ?? '—'}
              </span>
              <span className={styles.rrrMin}>
                {levelValidation.rrr?.meetsMinimum ? '✓ meets minimum' : `✗ minimum ${levelValidation.rrr?.varsityMinimum}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Deviations */}
      {deviations?.length > 0 && (
        <div className={styles.deviations}>
          {deviations.map((d, i) => (
            <div key={i} className={styles.deviation}>→ {d}</div>
          ))}
        </div>
      )}

      {/* Tags */}
      {learningTags?.length > 0 && (
        <div className={styles.tags}>
          {learningTags.map(tag => (
            <span key={tag} className="badge badge-muted">{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        {saved && <span className={styles.savedNote}>✓ Saved to Journal</span>}
        <button className="btn btn-ghost" onClick={onNewSession}>New session</button>
      </div>
    </div>
  );
}
