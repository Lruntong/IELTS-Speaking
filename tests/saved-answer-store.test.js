import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSavedAnswer,
  isMaterialNewer,
  saveAnswer,
} from '../src/saved-answer-store.js';

test('saving the same question replaces only its current answer', () => {
  const once = saveAnswer({}, { questionId: 'q1', content: 'one', updatedAt: '2026-01-01' });
  const twice = saveAnswer(once, { questionId: 'q1', content: 'two', updatedAt: '2026-01-02' });

  assert.equal(Object.keys(twice).length, 1);
  assert.equal(getSavedAnswer(twice, 'q1').content, 'two');
});

test('detects material edits after answer generation', () => {
  assert.equal(
    isMaterialNewer({ materialUpdatedAt: '2026-01-01' }, { updatedAt: '2026-01-02' }),
    true
  );
});
