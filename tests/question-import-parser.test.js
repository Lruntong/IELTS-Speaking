import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTextImport } from '../src/question-import-parser.js';
import { createEmptyBankState, importSeasonQuestions } from '../src/question-bank-store.js';

test('parseTextImport preserves one-line pipe cards', () => {
  assert.deepEqual(
    parseTextImport([
      'Describe a helpful person. | who the person is | how they helped you',
      'Describe a quiet place. | where it is | why you like it',
    ].join('\n')),
    [
      {
        prompt: 'Describe a helpful person.',
        cues: ['who the person is', 'how they helped you'],
        tags: [],
        season: '',
      },
      {
        prompt: 'Describe a quiet place.',
        cues: ['where it is', 'why you like it'],
        tags: [],
        season: '',
      },
    ]
  );
});

test('parseTextImport segments blank-separated and numbered Part 2 cards', () => {
  const cards = parseTextImport(`
1. Describe a person who taught you something useful.
You should say:
- who this person is
- what they taught you
and explain why it was useful

2) Describe a natural place you enjoyed visiting.
• where it is
• what you did there
and explain how you felt there
  `);

  assert.deepEqual(cards, [
    {
      prompt: 'Describe a person who taught you something useful.',
      cues: ['who this person is', 'what they taught you', 'why it was useful'],
      tags: [],
      season: '',
    },
    {
      prompt: 'Describe a natural place you enjoyed visiting.',
      cues: ['where it is', 'what you did there', 'how you felt there'],
      tags: [],
      season: '',
    },
  ]);
});

test('parseTextImport recognizes numbered card boundaries without blank lines', () => {
  const cards = parseTextImport(`
1) Describe an app you use often.
- what it is
- how you use it
2. Describe an object you have kept for years.
- what it is
- why you keep it
  `);

  assert.equal(cards.length, 2);
  assert.equal(cards[0].prompt, 'Describe an app you use often.');
  assert.deepEqual(cards[0].cues, ['what it is', 'how you use it']);
  assert.equal(cards[1].prompt, 'Describe an object you have kept for years.');
  assert.deepEqual(cards[1].cues, ['what it is', 'why you keep it']);
});

test('parsed duplicate cards are deduplicated within the selected season', () => {
  const parsed = parseTextImport(`
1. Describe a memorable teacher.
- who the teacher is

2. Describe a memorable teacher!
- what you learned
  `);
  let id = 0;
  const imported = importSeasonQuestions(
    createEmptyBankState(),
    parsed,
    '2026-09-12',
    () => `parsed-${++id}`
  );

  assert.equal(imported.userQuestions.length, 1);
  assert.equal(imported.userQuestions[0].id, 'parsed-1');
});
