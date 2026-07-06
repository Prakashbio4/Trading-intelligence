import styles from './CandleChart.module.css';

// Shared OHLC candlestick renderer — used by Signals (mini price-action
// preview) and Learn (training charts, always with a volume pane and
// optional S/R level overlay). `candles` need { open, high, low, close,
// volume, zone }. Known zones get a distinct color: 'pattern' (amber),
// 'today' | 'outcome' (indigo, i.e. "the reveal"), everything else is
// plain bullish/bearish green/red.

function zoneColor(zone, bullish) {
  if (zone === 'pattern') return '#f59e0b';
  if (zone === 'today' || zone === 'outcome') return '#6366f1';
  return bullish ? '#22c55e' : '#ef4444';
}

export default function CandleChart({ candles, srLevels = [], showVolume = false, width = 320, height = 140 }) {
  if (!candles?.length) return null;

  const W = width, H = height, PAD = 16, CANDLE_W = Math.max(Math.min(320 / candles.length, 12), 3);
  const VOL_H = showVolume ? Math.round(H * 0.28) : 0;
  const PRICE_H = H - VOL_H - (showVolume ? 6 : 0);

  const prices = candles.flatMap(c => [c.high, c.low]).concat(srLevels.map(l => l.price));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toY = p => PAD + ((maxP - p) / range) * (PRICE_H - PAD * 2);
  const slotW = (W - PAD * 2) / candles.length;

  const maxVol = Math.max(...candles.map(c => c.volume || 0), 1);
  const volTop = PRICE_H + (showVolume ? 6 : 0);
  const toVolY = v => volTop + VOL_H - (v / maxVol) * VOL_H;

  return (
    <svg width={W} height={H} className={styles.chart}>
      {srLevels.map((lvl, i) => (
        <g key={i}>
          <line x1={PAD} y1={toY(lvl.price)} x2={W - PAD} y2={toY(lvl.price)}
            stroke={lvl.type === 'support' ? '#22c55e' : '#ef4444'} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        </g>
      ))}
      {candles.map((c, i) => {
        const x = PAD + i * slotW + slotW / 2;
        const bullish = c.close >= c.open;
        const color = zoneColor(c.zone, bullish);
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyBot = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyBot - bodyTop, 1);

        return (
          <g key={i}>
            <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x - CANDLE_W / 2} y={bodyTop} width={CANDLE_W} height={bodyH}
              fill={bullish ? color : 'transparent'} stroke={color} strokeWidth={1.5} />
            {showVolume && (
              <rect x={x - CANDLE_W / 2} y={toVolY(c.volume || 0)} width={CANDLE_W}
                height={VOL_H - (toVolY(c.volume || 0) - volTop)} fill={color} opacity={0.35} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
