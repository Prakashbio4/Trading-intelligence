'use strict';

// Aggregates ascending daily rows ({ date, open, high, low, close, volume })
// into weekly/monthly bars. Operates purely in memory on rows the caller
// already has (e.g. from ohlcCache.getSymbolRows) — no I/O, no new fetches.
//
// Bar date is the first actual trading day in that period, not the
// calendar-bucket key — avoids inventing a date that never traded (e.g. a
// Monday that was a market holiday).
function groupKey(dateStr, period) {
  if (period === 'M') return `${dateStr.slice(0, 7)}-01`;
  const d = new Date(dateStr + 'T00:00:00Z');
  const diffToMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().split('T')[0];
}

function aggregate(dailyRows, period) {
  const groups = new Map();
  for (const row of dailyRows) {
    const key = groupKey(row.date, period);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()]
    .map(rows => ({
      date: rows[0].date,
      open: Number(rows[0].open),
      high: Math.max(...rows.map(r => Number(r.high))),
      low: Math.min(...rows.map(r => Number(r.low))),
      close: Number(rows[rows.length - 1].close),
      volume: rows.reduce((sum, r) => sum + Number(r.volume), 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { aggregate };
