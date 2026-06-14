require('dotenv').config();
const express = require('express');
const cors = require('cors');

const analyzeRouter = require('./routes/analyze');
const journalRouter = require('./routes/journal');
const authRouter    = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://trading-intelligence-iezvnxkq4-sipy.vercel.app',
  'https://app.sipy.in',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman) or matching origins
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/auth',    authRouter);
app.use('/analyze', analyzeRouter);
app.use('/journal', journalRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

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
