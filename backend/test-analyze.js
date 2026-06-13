const fs = require('fs');
const path = require('path');
const http = require('http');

// Auto-find first image in Downloads
const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\jayaprakash', 'Downloads');
const imageExtensions = ['.png', '.jpg', '.jpeg'];

let imagePath = null;
try {
  const files = fs.readdirSync(downloadsDir);
  const imageFile = files.find(f => imageExtensions.includes(path.extname(f).toLowerCase()));
  if (imageFile) {
    imagePath = path.join(downloadsDir, imageFile);
    console.log('Using image:', imagePath);
  }
} catch (e) {
  console.error('Could not read Downloads folder:', e.message);
}

if (!imagePath) {
  console.error('No image found in Downloads. Add a chart PNG/JPG there and retry.');
  process.exit(1);
}

const imageData = fs.readFileSync(imagePath);
const ext = path.extname(imagePath).toLowerCase();
const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

const formData = {
  ticker: 'TEST',
  date: new Date().toISOString().split('T')[0],
  lookbackWindow: 3,
  chartSource: 'Kite',
  primaryTrend: 'Uptrend',
  trendDuration: '2-3 weeks',
  stockPhase: 'Mid uptrend',
  chartStructure: 'No pattern',
  opposingStructure: 'None',
  candlePattern: 'No pattern identified',
  patternDirection: 'N/A',
  volumeVsAverage: 'About average',
  macd: 'Cannot read',
  rsiDirection: 'Cannot read',
  narrative: 'Testing the unified analyse route end-to-end.',
  decision: 'Skip',
  confidence: 'Medium',
};

// Build multipart body manually
const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

function formField(name, value) {
  return (
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
    `${value}\r\n`
  );
}

const parts = [];
parts.push(Buffer.from(formField('formData', JSON.stringify(formData))));
parts.push(Buffer.from(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="chart"; filename="chart${ext}"\r\n` +
  `Content-Type: ${mime}\r\n\r\n`
));
parts.push(imageData);
parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

const body = Buffer.concat(parts);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/analyze',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
};

console.log('Sending request to POST /analyze ...\n');

const req = http.request(options, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(raw);
      console.log('=== RESPONSE ===\n');
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log('Raw response:\n', raw);
    }
  });
});

req.on('error', err => {
  console.error('Request failed:', err.message);
  console.error('Is the backend running? Run: node server.js');
});

req.write(body);
req.end();
