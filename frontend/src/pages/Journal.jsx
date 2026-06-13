import { useState, useEffect } from 'react';
import { getSessions, updateSession } from '../api/index.js';
import ChatPanel from '../components/ChatPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import styles from './Journal.module.css';

const MODULE_LABEL = { '1': 'M1 — Chart Eye Training', '2': 'M2 — Narrative Builder', '3': 'M3 — Trade Validator' };
const MODULE_SHORT = { '1': 'M1 Learn', '2': 'M2 Narrative', '3': 'M3 Validate' };

const VERDICT_CLASS = {
  TRADE: 'badge-green', TAKE: 'badge-green',
  PASS: 'badge-red', SKIP: 'badge-red', NO_TRADE: 'badge-red',
  CONDITIONAL: 'badge-amber', WATCH: 'badge-amber',
  LEARN: 'badge-muted',
};
const OUTCOME_CLASS = {
  Win: 'badge-green', Loss: 'badge-red', Open: 'badge-teal', Skip: 'badge-muted',
};
const CONF_CLASS = { HIGH: 'badge-green', MEDIUM: 'badge-amber', LOW: 'badge-red' };

function lvl(item) {
  if (item == null) return null;
  if (typeof item === 'object') return item.level ?? item.price ?? item.value ?? String(Object.values(item)[0]);
  return item;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Shared tiny components ────────────────────────────────────────────────────

function Row({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoKey}>{label}</span>
      <span className={`${styles.infoVal} ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function SectionHead({ children }) {
  return <div className={styles.sectionHead}>{children}</div>;
}

function ConfBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${CONF_CLASS[value] ?? 'badge-muted'}`}>{value}</span>;
}

// ── Your Read panels ─────────────────────────────────────────────────────────

function YourReadM1({ u }) {
  return (
    <div className={styles.block}>
      <SectionHead>Your Read</SectionHead>

      <div className={styles.infoGroup}>
        <Row label="Trend"          value={u.trend} />
        <Row label="Duration"       value={u.trendDuration} />
        <Row label="Structure"      value={u.chartStructure} />
        <Row label="Opposing"       value={u.opposingStructure} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Pattern"        value={u.candlePattern} />
        <Row label="Direction"      value={u.patternDirection} />
        <Row label="Quality"        value={u.patternQuality} />
        <Row label="Prior trend"    value={u.priorTrendMatch} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Volume"         value={u.volumeVsAvg} />
        <Row label="MACD"           value={u.macd} />
        <Row label="RSI"            value={u.rsiValue ? `${u.rsiValue} — ${u.rsiDirection}` : u.rsiDirection} mono />
        <Row label="Bollinger"      value={u.bollingerBands} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Support"        value={u.supportLevel ? `₹${u.supportLevel}` : null} mono />
        <Row label="Resistance"     value={u.resistanceLevel ? `₹${u.resistanceLevel}` : null} mono />
        <Row label="S&R confidence" value={u.srConfidence} />
      </div>

      {u.notes && (
        <div className={styles.narrativeBlock}>
          <span className={styles.infoKey}>Notes</span>
          <p className={styles.narrativeText}>{u.notes}</p>
        </div>
      )}
    </div>
  );
}

function YourReadM3({ u }) {
  return (
    <div className={styles.block}>
      <SectionHead>Your Read</SectionHead>

      <div className={styles.infoGroup}>
        <Row label="Trend"          value={u.trend} />
        <Row label="Duration"       value={u.trendDuration} />
        <Row label="Phase"          value={u.stockPhase} />
        <Row label="Structure"      value={u.chartStructure} />
        <Row label="Opposing"       value={u.opposingStructure} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Volume char."   value={u.volumeCharacter} />
        <Row label="Volume vs avg"  value={u.volumeVsAvg} />
        <Row label="Bollinger"      value={u.bollingerBands} />
        <Row label="MACD"           value={u.macd} />
        <Row label="RSI"            value={u.rsiValue ? `${u.rsiValue} — ${u.rsiDirection}` : u.rsiDirection} mono />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Pattern"        value={u.candlePattern} />
        <Row label="Quality"        value={u.patternQuality} />
        <Row label="Prior trend"    value={u.priorTrendMatch} />
        <Row label="Signal volume"  value={u.signalVolume} />
      </div>

      <div className={styles.infoGroup}>
        <Row label="Entry"          value={u.entryPrice ? `₹${u.entryPrice}` : null} mono />
        <Row label="Stop Loss"      value={u.stopLoss ? `₹${u.stopLoss}` : null} mono />
        <Row label="Target"         value={u.target ? `₹${u.target}` : null} mono />
        <Row label="RRR"            value={u.rrr} mono />
        <Row label="Support"        value={u.supportLevel ? `₹${u.supportLevel}` : null} mono />
        <Row label="Resistance"     value={u.resistanceLevel ? `₹${u.resistanceLevel}` : null} mono />
      </div>

      {u.narrative && (
        <div className={styles.narrativeBlock}>
          <span className={styles.infoKey}>Your narrative</span>
          <p className={styles.narrativeText}>{u.narrative}</p>
        </div>
      )}

      {u.decision && (
        <div className={styles.decisionChip}>
          Your decision: <strong>{u.decision}</strong>
        </div>
      )}
    </div>
  );
}

// ── AI output panels ──────────────────────────────────────────────────────────

function AIReadM1({ aiAnalysis }) {
  const ann = aiAnalysis?.aiAnnotation;
  const cmp = aiAnalysis?.comparison;
  const sa  = aiAnalysis?.setupAssessment;

  return (
    <>
      {/* Annotation */}
      {ann && (
        <div className={styles.block}>
          <SectionHead>AI's Read</SectionHead>

          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Trend</span>
              <span className={styles.infoVal}>{ann.trend?.direction} — {ann.trend?.duration}</span>
              <ConfBadge value={ann.trend?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Structure</span>
              <span className={styles.infoVal}>{ann.chartStructure?.pattern || '—'}</span>
              <ConfBadge value={ann.chartStructure?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Pattern</span>
              <span className={styles.infoVal}>{ann.candlePattern?.name || 'No pattern identified'} — {ann.candlePattern?.quality}</span>
              <ConfBadge value={ann.candlePattern?.confidence} />
            </div>
            {ann.candlePattern?.reasoning && (
              <p className={styles.aiNote}>{ann.candlePattern.reasoning}</p>
            )}
          </div>

          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Volume</span>
              <span className={styles.infoVal}>{ann.volume?.vsAverage}</span>
              <ConfBadge value={ann.volume?.confidence} />
            </div>
            {ann.volume?.note && <p className={styles.aiNote}>{ann.volume.note}</p>}
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>MACD</span>
              <span className={styles.infoVal}>{ann.indicators?.macd?.status}</span>
              <ConfBadge value={ann.indicators?.macd?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>RSI</span>
              <span className={`${styles.infoVal} mono`}>
                {ann.indicators?.rsi?.value != null ? ann.indicators.rsi.value : '—'} — {ann.indicators?.rsi?.direction}
              </span>
              <ConfBadge value={ann.indicators?.rsi?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Bollinger</span>
              <span className={styles.infoVal}>{ann.indicators?.bollingerBands?.status}</span>
              <ConfBadge value={ann.indicators?.bollingerBands?.confidence} />
            </div>
          </div>

          {(ann.keyLevels?.support?.length > 0 || ann.keyLevels?.resistance?.length > 0) && (
            <div className={styles.levelsBlock}>
              {ann.keyLevels.support?.map((s, i) => (
                <div key={i} className={styles.levelChip}>
                  <span className={styles.levelS}>S</span>
                  <span className="mono accent" style={{ fontSize: 12 }}>{lvl(s)}</span>
                </div>
              ))}
              {ann.keyLevels.resistance?.map((r, i) => (
                <div key={i} className={styles.levelChip}>
                  <span className={styles.levelR}>R</span>
                  <span className="mono danger" style={{ fontSize: 12 }}>{lvl(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison */}
      {cmp && (
        <div className={styles.block}>
          <div className={styles.sectionHeadRow}>
            <SectionHead>Field-by-Field Comparison</SectionHead>
            {cmp.overallAgreement && (
              <span className={`badge ${CONF_CLASS[cmp.overallAgreement] ?? 'badge-muted'}`}>
                {cmp.overallAgreement} agreement
              </span>
            )}
          </div>

          <div className={styles.cmpList}>
            {[
              { label: 'Trend',           f: 'trend'          },
              { label: 'Chart Structure', f: 'chartStructure' },
              { label: 'Candle Pattern',  f: 'candlePattern'  },
              { label: 'Volume',          f: 'volume'         },
              { label: 'Indicators',      f: 'indicators'     },
              { label: 'S&R Levels',      f: 'srLevels'       },
            ].map(({ label, f }) => {
              const field = cmp[f];
              if (!field) return null;
              return (
                <div key={f} className={`${styles.cmpItem} ${field.match === true ? styles.cmpGreen : field.match === false ? styles.cmpRed : ''}`}>
                  <div className={styles.cmpTop}>
                    <span className={styles.cmpLabel}>{label}</span>
                    <span className={field.match === true ? styles.matchY : field.match === false ? styles.matchN : styles.matchNeutral}>
                      {field.match === true ? '✓' : field.match === false ? '✗' : '—'}
                    </span>
                  </div>
                  <div className={styles.cmpReadRow}>
                    <span className={styles.cmpWho}>You</span>
                    <span className={styles.cmpVal}>{field.userRead || '—'}</span>
                  </div>
                  <div className={styles.cmpReadRow}>
                    <span className={styles.cmpWho}>AI</span>
                    <span className={styles.cmpVal}>{field.aiRead || '—'}</span>
                  </div>
                  {field.note && field.match === false && (
                    <p className={styles.cmpNote}>→ {field.note}</p>
                  )}
                </div>
              );
            })}
          </div>

          {cmp.primaryLearningPoint && (
            <div className={styles.lpBox}>
              <span className={styles.lpLabel}>Primary Learning Point</span>
              <p className={styles.lpText}>{cmp.primaryLearningPoint}</p>
            </div>
          )}
        </div>
      )}

      {/* Setup assessment */}
      {sa && (
        <div className={`${styles.block} ${styles.verdictBlock} ${
          sa.verdict === 'TRADE' ? styles.verdictTrade :
          sa.verdict === 'PASS'  ? styles.verdictPass  : styles.verdictWatch
        }`}>
          <div className={styles.sectionHeadRow}>
            <span className={`${styles.verdictWord} ${
              sa.verdict === 'TRADE' ? styles.verdictWordTrade :
              sa.verdict === 'PASS'  ? styles.verdictWordPass  : styles.verdictWordWatch
            }`}>{sa.verdict}</span>
            <span className={styles.checkScore}>{sa.checklistScore} checks passed</span>
          </div>

          {sa.verdictReason && <p className={styles.verdictReason}>{sa.verdictReason}</p>}

          <div className={styles.checkGrid}>
            {sa.checks?.map((c, i) => (
              <div key={i} className={styles.checkRow}>
                <span className={c.passed ? styles.checkY : styles.checkN}>{c.passed ? '✓' : '✗'}</span>
                <div>
                  <div className={styles.checkLabel}>{c.label}</div>
                  {c.note && <div className={styles.checkNote}>{c.note}</div>}
                </div>
              </div>
            ))}
          </div>

          {sa.proposedLevels && (sa.proposedLevels.entry || sa.proposedLevels.stopLoss || sa.proposedLevels.target) && (
            <div className={styles.proposedLevels}>
              <span className={styles.infoKey} style={{ marginBottom: 8, display: 'block' }}>AI Proposed Levels</span>
              <div className={styles.levelCells}>
                {sa.proposedLevels.entry != null && (
                  <div className={styles.levelCell}>
                    <span className={styles.levelKey}>Entry</span>
                    <span className="mono" style={{ fontSize: 15 }}>₹{sa.proposedLevels.entry}</span>
                  </div>
                )}
                {sa.proposedLevels.stopLoss != null && (
                  <div className={styles.levelCell}>
                    <span className={styles.levelKey}>Stop Loss</span>
                    <span className="mono danger" style={{ fontSize: 15 }}>₹{sa.proposedLevels.stopLoss}</span>
                  </div>
                )}
                {sa.proposedLevels.target != null && (
                  <div className={styles.levelCell}>
                    <span className={styles.levelKey}>Target</span>
                    <span className="mono accent" style={{ fontSize: 15 }}>₹{sa.proposedLevels.target}</span>
                  </div>
                )}
                {sa.proposedLevels.rrr != null && (
                  <div className={styles.levelCell}>
                    <span className={styles.levelKey}>RRR</span>
                    <span className={`mono ${parseFloat(sa.proposedLevels.rrr) >= 1.5 ? 'accent' : 'danger'}`} style={{ fontSize: 15 }}>
                      {sa.proposedLevels.rrr}
                    </span>
                  </div>
                )}
              </div>
              {sa.proposedLevels.reasoning && (
                <p className={styles.aiNote} style={{ marginTop: 8 }}>{sa.proposedLevels.reasoning}</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AIReadM3({ aiAnalysis }) {
  const { verdict, confidence, chartObservations, checklistResults, levelValidation, deviations } = aiAnalysis ?? {};

  const verdictCls = verdict === 'TRADE' || verdict === 'TAKE' ? styles.verdictTrade
    : verdict === 'PASS' || verdict === 'SKIP' || verdict === 'NO_TRADE' ? styles.verdictPass
    : styles.verdictWatch;

  const verdictWordCls = verdict === 'TRADE' || verdict === 'TAKE' ? styles.verdictWordTrade
    : verdict === 'PASS' || verdict === 'SKIP' || verdict === 'NO_TRADE' ? styles.verdictWordPass
    : styles.verdictWordWatch;

  return (
    <>
      {/* Verdict */}
      {verdict && (
        <div className={`${styles.block} ${styles.verdictBlock} ${verdictCls}`}>
          <div className={styles.sectionHeadRow}>
            <span className={`${styles.verdictWord} ${verdictWordCls}`}>{verdict}</span>
            <ConfBadge value={confidence} />
          </div>
          {Array.isArray(checklistResults) && checklistResults.length > 0 && (
            <span className={styles.checkScore}>
              {checklistResults.filter(c => c.passed).length}/{checklistResults.length} checks passed
            </span>
          )}
        </div>
      )}

      {/* Chart observations */}
      {chartObservations && (
        <div className={styles.block}>
          <SectionHead>AI's Chart Read</SectionHead>
          <div className={styles.infoGroup}>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Trend</span>
              <span className={styles.infoVal}>{chartObservations.trend?.direction}</span>
              <ConfBadge value={chartObservations.trend?.confidence} />
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Pattern</span>
              <span className={styles.infoVal}>{chartObservations.candlePattern?.name || 'No pattern identified'}</span>
              <ConfBadge value={chartObservations.candlePattern?.confidence} />
            </div>
            {chartObservations.candlePattern?.reasoning && (
              <p className={styles.aiNote}>{chartObservations.candlePattern.reasoning}</p>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoKey}>Volume</span>
              <span className={styles.infoVal}>{chartObservations.volume?.assessment}</span>
              <ConfBadge value={chartObservations.volume?.confidence} />
            </div>
          </div>
          {(chartObservations.keyLevels?.support?.length > 0 || chartObservations.keyLevels?.resistance?.length > 0) && (
            <div className={styles.levelsBlock}>
              {chartObservations.keyLevels.support?.map((s, i) => (
                <div key={i} className={styles.levelChip}>
                  <span className={styles.levelS}>S</span>
                  <span className="mono accent" style={{ fontSize: 12 }}>{lvl(s)}</span>
                </div>
              ))}
              {chartObservations.keyLevels.resistance?.map((r, i) => (
                <div key={i} className={styles.levelChip}>
                  <span className={styles.levelR}>R</span>
                  <span className="mono danger" style={{ fontSize: 12 }}>{lvl(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Checklist */}
      {checklistResults?.length > 0 && (
        <div className={styles.block}>
          <SectionHead>Varsity Checklist</SectionHead>
          <div className={styles.checkGrid}>
            {checklistResults.map((c, i) => (
              <div key={i} className={styles.checkRow}>
                <span className={c.passed ? styles.checkY : styles.checkN}>{c.passed ? '✓' : '✗'}</span>
                <div>
                  <div className={styles.sectionHeadRow}>
                    <span className={styles.checkLabel}>{c.item}</span>
                    <ConfBadge value={c.confidence} />
                  </div>
                  {c.comment && <div className={styles.checkNote}>{c.comment}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level validation */}
      {levelValidation && (
        <div className={styles.block}>
          <SectionHead>Level Validation</SectionHead>
          <div className={styles.checkGrid}>
            {['entry', 'stopLoss', 'target'].map(key => {
              const lv = levelValidation[key];
              if (!lv) return null;
              return (
                <div key={key} className={styles.checkRow}>
                  <span className={lv.valid ? styles.checkY : styles.checkN}>{lv.valid ? '✓' : '✗'}</span>
                  <div>
                    <span className={styles.checkLabel}>{key === 'stopLoss' ? 'Stop Loss' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    {lv.comment && <div className={styles.checkNote}>{lv.comment}</div>}
                    {lv.suggestedLevel && <div className={`${styles.checkNote} accent`}>Suggested: ₹{lv.suggestedLevel}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {levelValidation.rrr && (
            <div className={styles.rrrRow}>
              <span className={styles.infoKey}>RRR</span>
              <span className={`mono ${levelValidation.rrr.meetsMinimum ? 'accent' : 'danger'}`} style={{ fontSize: 15 }}>
                {levelValidation.rrr.calculated ?? '—'}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                {levelValidation.rrr.meetsMinimum ? '✓ passes' : `✗ min ${levelValidation.rrr.minimum ?? '1:1.5'}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Deviations */}
      {deviations?.length > 0 && (
        <div className={styles.block}>
          <SectionHead>Deviations</SectionHead>
          {deviations.map((d, i) => (
            <p key={i} className={styles.deviation}>→ {d}</p>
          ))}
        </div>
      )}
    </>
  );
}

// ── Outcome editor ────────────────────────────────────────────────────────────

function OutcomeEditor({ session, onSaved }) {
  const [outcome, setOutcome]     = useState(session.outcome ?? '');
  const [exitPrice, setExitPrice] = useState(session.exitPrice ?? '');
  const [notes, setNotes]         = useState(session.notes ?? '');
  const [saving, setSaving]       = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await updateSession(session.id, {
        outcome:   outcome || undefined,
        exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
        notes:     notes || undefined,
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.outcomeSection}>
      <SectionHead>What Happened</SectionHead>

      <div className={styles.outcomeRow}>
        <select value={outcome} onChange={e => setOutcome(e.target.value)} className={styles.smallSelect}>
          <option value="">Outcome…</option>
          <option>Win</option>
          <option>Loss</option>
          <option>Skip</option>
        </select>
        {session.module === '3' && (
          <input
            type="number"
            placeholder="Exit price ₹"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className={styles.smallInput}
            step="0.01"
          />
        )}
        {session.pnl != null && (
          <span className={`mono ${session.pnl >= 0 ? 'accent' : 'danger'}`} style={{ fontSize: 14 }}>
            P&L: {session.pnl >= 0 ? '+' : ''}₹{session.pnl}
          </span>
        )}
      </div>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="What actually happened? Anything you'd do differently? Write freely…"
        className={styles.notesArea}
        rows={4}
      />

      <div className={styles.outcomeFooter}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save outcome'}
        </button>
      </div>
    </div>
  );
}

// ── Session detail modal ──────────────────────────────────────────────────────

function SessionDetail({ session, onClose, onUpdate }) {
  const { userInput, aiAnalysis } = session;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <div className={styles.modalTopRow}>
              <span className={styles.modalTicker}>{session.ticker || '—'}</span>
              {session.outcome && (
                <span className={`badge ${OUTCOME_CLASS[session.outcome] ?? 'badge-muted'}`}>
                  {session.outcome}
                </span>
              )}
            </div>
            <span className={styles.modalMeta}>
              {formatDate(session.createdAt)}
              {' · '}
              {MODULE_SHORT[session.module]}
              {session.userInput?.lookbackWindow && ` · ${session.userInput.lookbackWindow}-session lookback`}
              {session.promptVersion && <span className={styles.promptVer}> · {session.promptVersion}</span>}
            </span>
            {session.learningTags?.length > 0 && (
              <div className={styles.modalTags}>
                {session.learningTags.map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <ErrorBoundary resetLabel="Close">
            {/* Chart */}
            {session.imagePath && (
              <div className={styles.chartWrap}>
                <img
                  src={`http://localhost:3001${session.imagePath}`}
                  alt="chart"
                  className={styles.chartImg}
                />
              </div>
            )}

            {/* Two-column: your read + AI read */}
            <div className={styles.cols}>
              <div className={styles.col}>
                {session.module === '1' && userInput && <YourReadM1 u={userInput} />}
                {session.module === '3' && userInput && <YourReadM3 u={userInput} />}
              </div>
              <div className={styles.col}>
                <ErrorBoundary resetLabel="Dismiss">
                  {session.module === '1' && <AIReadM1 aiAnalysis={aiAnalysis} />}
                  {session.module === '3' && <AIReadM3 aiAnalysis={aiAnalysis} />}
                </ErrorBoundary>
              </div>
            </div>

            {/* Outcome — full width */}
            <OutcomeEditor
              session={session}
              onSaved={updated => { onUpdate(updated); }}
            />

            {/* Chat — full width */}
            <ChatPanel
              session={session}
              onHistoryUpdate={chatHistory => onUpdate({ ...session, chatHistory })}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

// ── Main Journal page ─────────────────────────────────────────────────────────

export default function Journal() {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [filters, setFilters]     = useState({ module: '', verdict: '', outcome: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setSessions(await getSessions());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate(updated) {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  const filtered = sessions.filter(s => {
    if (filters.module  && s.module    !== filters.module)  return false;
    if (filters.verdict && s.aiVerdict !== filters.verdict) return false;
    if (filters.outcome && s.outcome   !== filters.outcome) return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Journal</h1>
          <p className={styles.subtitle}>Every session logged automatically. Click any row to see the full record.</p>
        </div>
        <span className={styles.count}>{sessions.length} sessions</span>
      </div>

      <div className={styles.filters}>
        <select value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} className={styles.filterSelect}>
          <option value="">All modules</option>
          <option value="1">Module 1</option>
          <option value="2">Module 2</option>
          <option value="3">Module 3</option>
        </select>
        <select value={filters.verdict} onChange={e => setFilters(f => ({ ...f, verdict: e.target.value }))} className={styles.filterSelect}>
          <option value="">All verdicts</option>
          <option value="TRADE">Trade</option>
          <option value="PASS">Pass</option>
          <option value="WATCH">Watch</option>
          <option value="LEARN">Learn</option>
        </select>
        <select value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))} className={styles.filterSelect}>
          <option value="">All outcomes</option>
          <option value="Win">Win</option>
          <option value="Loss">Loss</option>
          <option value="Open">Open</option>
          <option value="Skip">Skip</option>
        </select>
        <button className="btn btn-ghost" onClick={() => setFilters({ module: '', verdict: '', outcome: '' })}>Clear</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loadingRow}><span className="spinner" /> Loading sessions…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          {sessions.length === 0
            ? 'No sessions yet. Complete a Module 1 or Module 3 analysis to start your journal.'
            : 'No sessions match these filters.'}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Stock</th>
                <th>Module</th>
                <th>Pattern</th>
                <th>Verdict</th>
                <th>Outcome</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={styles.row} onClick={() => setSelected(s)}>
                  <td className="mono muted">{filtered.length - i}</td>
                  <td className="mono">{formatDate(s.createdAt)}</td>
                  <td className={styles.ticker}>{s.ticker || '—'}</td>
                  <td><span className="badge badge-muted">{MODULE_SHORT[s.module] ?? s.module}</span></td>
                  <td className={styles.pattern}>{s.userInput?.candlePattern || '—'}</td>
                  <td>
                    {s.aiVerdict
                      ? <span className={`badge ${VERDICT_CLASS[s.aiVerdict] ?? 'badge-muted'}`}>{s.aiVerdict}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {s.outcome
                      ? <span className={`badge ${OUTCOME_CLASS[s.outcome] ?? 'badge-muted'}`}>{s.outcome}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td className="mono">
                    {s.pnl != null
                      ? <span className={s.pnl >= 0 ? 'accent' : 'danger'}>{s.pnl >= 0 ? '+' : ''}₹{s.pnl}</span>
                      : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <SessionDetail
          session={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
