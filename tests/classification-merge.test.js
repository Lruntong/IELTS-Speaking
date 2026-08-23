import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isConfirmedUnclassified,
  mergeClassificationResults,
  resolveDraftMotherId,
} from '../src/classification-merge.js';

test('an own null override permanently outranks local classification helpers', () => {
  assert.equal(isConfirmedUnclassified({ q1: null }, 'q1'), true);
  assert.equal(isConfirmedUnclassified({}, 'q1'), false);
  assert.equal(isConfirmedUnclassified({ q1: 'M1' }, 'q1'), false);
});

test('inherited wins, remote fills next, local fills omissions', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const result = mergeClassificationResults(
    questions,
    { a: 'M1' },
    [
      { id: 'a', motherId: 'M8' },
      { id: 'b', motherId: 'M2' },
      { id: 'c', motherId: 'BAD' },
    ],
    (question) => (question.id === 'c' ? 'M3' : null)
  );

  assert.deepEqual(result, { a: 'M1', b: 'M2', c: 'M3' });
});

test('ignores unknown ids and does not mutate inputs', () => {
  const questions = [{ id: 'a' }, { id: 'b' }];
  const inherited = { a: null };
  const remote = [
    { id: 'b', motherId: 'M8' },
    { id: 'missing', motherId: 'M1' },
  ];

  const result = mergeClassificationResults(questions, inherited, remote, () => null);

  assert.deepEqual(result, { a: null, b: 'M8' });
  assert.deepEqual(inherited, { a: null });
  assert.deepEqual(remote, [
    { id: 'b', motherId: 'M8' },
    { id: 'missing', motherId: 'M1' },
  ]);
  assert.notStrictEqual(result, inherited);
});

test('confirmed null override beats stale imported draft suggestions', () => {
  const result = resolveDraftMotherId(
    { id: 'q1', motherId: null },
    { q1: null },
    new Map([['q1', 'M4']]),
    () => 'M2'
  );

  assert.equal(result, null);
});

test('inherited null blocks remote and local suggestion generation', () => {
  let localCalls = 0;
  const result = mergeClassificationResults(
    [{ id: 'inherited-null' }, { id: 'new-question' }],
    { 'inherited-null': null },
    [
      { id: 'inherited-null', motherId: 'M1' },
      { id: 'new-question', motherId: 'M2' },
    ],
    () => {
      localCalls += 1;
      return 'M8';
    }
  );

  assert.deepEqual(result, { 'inherited-null': null, 'new-question': 'M2' });
  assert.equal(localCalls, 0);
});
