import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSavedAnswer,
  isMaterialNewer,
  saveAnswer,
} from '../src/saved-answer-store.js';

test('saving the same question replaces only its current answer', () => {
  const once = saveAnswer({}, { questionId: 'q1', seasonId: ' 2026-05-08 ', content: 'one', updatedAt: '2026-01-01' });
  const twice = saveAnswer(once, { questionId: 'q1', content: 'two', updatedAt: '2026-01-02' });

  assert.equal(Object.keys(twice).length, 1);
  assert.equal(getSavedAnswer(twice, 'q1').content, 'two');
  assert.equal(getSavedAnswer(once, 'q1').seasonId, '2026-05-08');
});

test('material identity changes and missing bindings make a saved answer stale', () => {
  const answer = {
    materialId: 'material-a',
    materialUpdatedAt: '2026-01-02T00:00:00.000Z',
  };

  assert.equal(isMaterialNewer(answer, null), true);
  assert.equal(isMaterialNewer({ materialUpdatedAt: answer.materialUpdatedAt }, { id: 'material-a' }), true);
  assert.equal(isMaterialNewer(answer, { id: 'material-b', updatedAt: '2026-01-01' }), true);
  assert.equal(isMaterialNewer(answer, { id: 'material-a', updatedAt: '2026-01-01' }), false);
});

test('detects material edits after answer generation', () => {
  assert.equal(
    isMaterialNewer({ materialUpdatedAt: '2026-01-01' }, { updatedAt: '2026-01-02' }),
    true
  );
});
