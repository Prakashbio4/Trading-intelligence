'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { backfillSymbol } = require('../jobs/backfillHistory');

async function main() {
  const symbol = process.argv[2];
  const since = process.argv[3] || '2020-01-01';

  if (!symbol) {
    console.error('Usage: node scripts/backfill.js SYMBOL [sinceDate]');
    console.error('Example: node scripts/backfill.js ABCAPITAL 2020-01-01');
    process.exit(1);
  }

  try {
    await backfillSymbol(symbol.toUpperCase(), since);
  } catch (err) {
    console.error(`[backfill] Failed: ${err.message}`);
    process.exit(1);
  }
}

main();
