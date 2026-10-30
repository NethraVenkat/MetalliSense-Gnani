import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreIntents } from './score_intents.mjs';

const row = (transcript, overrides = {}) => ({
  transcript, expected_intent: 'element_value', expected_heat: '1051', success: true, ...overrides,
});

test('scores the cached clean Mn alias with the real mapper', () => {
  const [result] = scoreIntents([row('1051 magnus in a')]);
  assert.equal(result.intent_correct, true);
  assert.equal(result.intent_heat_correct, true);
  assert.equal(JSON.parse(result.predicted_params).element, 'Mn');
});
test('a correct intent with a corrupted heat fails the joint metric', () => {
  const [result] = scoreIntents([row('heat 81051 carbon available')]);
  assert.equal(result.intent_correct, true);
  assert.equal(result.intent_heat_correct, false);
});
test('prompts without a heat use intent correctness for the joint metric', () => {
  const [result] = scoreIntents([row('fpsi stock evolve', { expected_intent: 'stock_check', expected_heat: '' })]);
  assert.equal(result.intent_heat_correct, true);
  assert.equal(JSON.parse(result.predicted_params).alloy, 'FeSi');
});
test('provider failures and wrong intents cannot count as correct', () => {
  for (const result of scoreIntents([
    row('1051 magnus in a', { success: false }),
    row('1051 magnus in a', { success: 'False' }),
    row('1051 status enna'),
  ])) {
    assert.equal(result.intent_correct, false);
    assert.equal(result.intent_heat_correct, false);
  }
});
test('heat zero is an applicable reference, not a missing reference', () => {
  const [result] = scoreIntents([row('heat 1 status', { expected_intent: 'heat_status', expected_heat: '0' })]);
  assert.equal(result.intent_correct, true);
  assert.equal(result.intent_heat_correct, false);
});
