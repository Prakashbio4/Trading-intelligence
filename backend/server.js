require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const analyzeRouter   = require('./routes/analyze');
const journalRouter   = require('./routes/journal');
const authRouter      = require('./routes/auth');
const universeRouter  = require('./routes/universe');
const { runFetchOhlc } = require('./jobs/fetchOhlc');
const { runPopulateOutcomes } = require('./jobs/populateOutcomes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Allow localhost, any vercel.app subdomain, and sipy.in
    if (
      origin.startsWith('http://localhost') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.sipy.in') ||
      origin === 'https://sipy.in'
    ) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/auth',     authRouter);
app.use('/analyze',  analyzeRouter);
app.use('/journal',  journalRouter);
app.use('/universe', universeRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Nightly OHLC fetch — runs at 4:15 PM IST (market closes 3:30 PM, buffer for data lag)
// Cron is in server local time — ensure server timezone is IST or adjust hour accordingly
// Nightly pipeline: OHLC fetch at 4:15 PM IST, then outcome population at 4:45 PM IST
cron.schedule('15 16 * * 1-5', () => {
  console.log('[cron] Triggering nightly OHLC fetch...');
  runFetchOhlc().catch(err => console.error('[cron] OHLC fetch error:', err.message));
}, { timezone: 'Asia/Kolkata' });

cron.schedule('45 16 * * 1-5', () => {
  console.log('[cron] Triggering outcome population...');
  runPopulateOutcomes().catch(err => console.error('[cron] Outcome population error:', err.message));
}, { timezone: 'Asia/Kolkata' });

app.listen(PORT, () => {
  console.log(`SIPY backend running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('WARNING: ANTHROPIC_API_KEY not set — /analyze routes will fail');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.warn('WARNING: Supabase env vars not set — DB routes will fail');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set — auth routes will fail');
  }
});
