// Pure local scoring: JSON rows on stdin, enriched JSON rows on stdout. No STT client.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapIntent } from '../../../../MetalliSense_Frontend_R/MetalliSense_Frontend/src/services/voiceIntents.js';

function heatNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const digits = String(value).trim();
  if (!/^\d+$/.test(digits)) throw new Error(`Invalid reference heat number: ${digits}`);
  return Number(digits);
}

export function scoreIntents(rows) {
  return rows.map(row => {
    if (typeof row.expected_intent !== 'string' || !row.expected_intent.trim()) {
      throw new Error('Each row needs an independent expected_intent label');
    }
    const predicted = mapIntent(row.transcript ?? '');
    const success = row.success === true || String(row.success).toLowerCase() === 'true';
    const expectedHeat = heatNumber(row.expected_heat);
    const correct = success && predicted.intent === row.expected_intent;
    return {
      ...row,
      predicted_intent: predicted.intent,
      predicted_params: JSON.stringify(predicted.params),
      intent_correct: correct,
      // Heat is required only for prompts whose independent reference contains one.
      intent_heat_correct: correct && (expectedHeat === null || predicted.params.heatNumber === expectedHeat),
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rows = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF/, ''));
    if (!Array.isArray(rows)) throw new Error('Expected a JSON array on stdin');
    process.stdout.write(JSON.stringify(scoreIntents(rows)));
  } catch (error) {
    console.error(`Intent scoring failed: ${error.message}`);
    process.exitCode = 1;
  }
}
