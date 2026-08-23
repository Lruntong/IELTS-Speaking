import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuestionLocally } from '../src/local-classifier.js';

const cases = [
  ['Describe an elderly person you enjoy talking to.', 'M1'],
  ['Describe a close friend who helped you.', 'M2'],
  ['Describe an object you have kept for a long time.', 'M3'],
  ['Describe an app you use every day.', 'M4'],
  ['Describe a beautiful lake you visited.', 'M5'],
  ['Describe a room where you relax.', 'M6'],
  ['Describe an achievement you are proud of.', 'M7'],
  ['Describe a difficult experience when you failed.', 'M8'],
];

for (const [prompt, expected] of cases) {
  test(prompt, () => {
    assert.equal(classifyQuestionLocally({ prompt }), expected);
  });
}

test('ambiguous prompt stays unclassified', () => {
  assert.equal(classifyQuestionLocally({ prompt: 'Describe something interesting.' }), null);
});
