import test from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentImportRequest } from '../src/import-session-state.js';

test('an import result is stale after the bank state changes during the AI request', () => {
  const stateAtStart = { userQuestions: [] };
  const changedState = { userQuestions: [] };

  assert.equal(isCurrentImportRequest({ stateAtStart, requestId: 4 }, changedState, 4), false);
  assert.equal(isCurrentImportRequest({ stateAtStart, requestId: 4 }, stateAtStart, 5), false);
  assert.equal(isCurrentImportRequest({ stateAtStart, requestId: 4 }, stateAtStart, 4), true);
});
