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

module.exports = { getPriceAfterDays };
