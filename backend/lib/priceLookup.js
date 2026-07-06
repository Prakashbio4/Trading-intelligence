'use strict';

const supabase = require('./supabase');

// Find the close price for a symbol N trading days after a given date,
// using already-stored ohlc_records.
async function getPriceAfterDays(symbol, fromDate, daysOffset) {
  // Fetch enough rows after the date to cover weekends/holidays
  const { data, error } = await supabase
    .from('ohlc_records')
    .select('date, close')
    .eq('symbol', symbol)
    .gt('date', fromDate)
    .order('date', { ascending: true })
    .limit(daysOffset + 5);

  if (error || !data?.length) return null;
  // Return the Nth trading day (index daysOffset - 1)
  return data[daysOffset - 1]?.close ?? null;
}

// Exact-date close — used as the Skip/Watch reference price (the close on
// the day the analysis was done). Null until that day's OHLC has been fetched.
async function getCloseOnDate(symbol, date) {
  const { data, error } = await supabase
    .from('ohlc_records')
    .select('close')
    .eq('symbol', symbol)
    .eq('date', date)
    .maybeSingle();

  if (error || !data) return null;
  return data.close;
}

// Daily high/low from fromDate onward (inclusive) — used to scan an open
// Take trade for a planned_target/planned_sl crossing on any day, not just
// fixed checkpoints.
async function getCandlesSince(symbol, fromDate) {
  const { data, error } = await supabase
    .from('ohlc_records')
    .select('date, high, low')
    .eq('symbol', symbol)
    .gte('date', fromDate)
    .order('date', { ascending: true });

  if (error) return [];
  return data ?? [];
}

module.exports = { getPriceAfterDays, getCloseOnDate, getCandlesSince };
