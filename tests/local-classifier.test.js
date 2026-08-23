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

test('cue points contribute specific evidence to an otherwise generic prompt', () => {
  assert.equal(
    classifyQuestionLocally({
      prompt: 'Describe a person you know.',
      cues: ['who your elderly mentor is', 'what this older person taught you'],
    }),
    'M1'
  );
});

test('generic person, place, and experience prompts remain unclassified', () => {
  const prompts = [
    'Describe a person you remember.',
    'Describe a place you enjoy visiting.',
    'Describe an experience that was important to you.',
  ];

  prompts.forEach((prompt) => assert.equal(classifyQuestionLocally({ prompt }), null));
});
