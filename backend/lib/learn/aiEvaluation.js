'use strict';

// One AI call per completed session — never per chart. Passes all 10 ground
// truth configs plus all 10 user calls and free-form notes, gets back a
// short, direct coaching evaluation.

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function summarizeChart(chart, i) {
  const truth = chart.pattern_present
    ? `${chart.pattern_slug} (${chart.clarity_level} clarity, volume ${chart.volume_character}, S/R ${chart.sr_proximity}, outcome ${chart.outcome_direction})`
    : `no setup (outcome ${chart.outcome_direction})`;
  const call = `detection=${chart.user_detection || '—'}, pattern=${chart.user_pattern_slug || '—'}, confidence=${chart.user_confidence || '—'}`;
  const notes = chart.user_notes ? ` | notes: "${chart.user_notes}"` : '';
  return `Chart ${i + 1} [${chart.chart_type}] — truth: ${truth} — call: ${call}${notes}`;
}

async function evaluateSession(charts) {
  const lines = charts
    .slice()
    .sort((a, b) => a.chart_index - b.chart_index)
    .map(summarizeChart);

  const systemPrompt = `You are a trading-skill coach reviewing one completed 10-chart perceptual training session.
Each chart tests detection (was a setup present?), classification (which pattern?), and confidence calibration.
Given the ground truth and the trader's calls below, respond with a short, direct evaluation covering:
1. What they caught
2. What they missed
3. Where confidence was miscalibrated (high confidence + wrong, or low confidence + right)
4. One specific observation about their reasoning drawn from their free-form notes, if any

Be concise and specific — reference chart numbers. No padding, no generic encouragement. Under 200 words.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: lines.join('\n') }],
  });

  return response.content[0].text;
}

module.exports = { evaluateSession };
