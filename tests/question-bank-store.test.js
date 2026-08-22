import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyBankState,
  importSeasonQuestions,
  mergeOfficialQuestions,
  migrateLegacyBank,
  serializeBankState,
} from '../src/question-bank-store.js';
import { normalizePrompt } from '../src/mother-topics.js';

test('createEmptyBankState returns the version 2 shell', () => {
  assert.deepEqual(createEmptyBankState(), {
    schemaVersion: 2,
    seasons: [],
    activeSeasonId: null,
    userQuestions: [],
    classificationOverrides: {},
    savedAnswers: {},
  });
});

test('migrateLegacyBank maps elder-person to M1 and keeps legacy assignments', () => {
  const migrated = migrateLegacyBank({
    questions: [
      {
        id: 'legacy-q1',
        prompt: 'Describe an old person you enjoy talking to.',
        cues: ['who he/she is'],
        tags: ['sample'],
        season: '2026-05-08',
      },
    ],
    assignments: {
      'legacy-q1': 'elder-person',
    },
  });

  assert.equal(migrated.userQuestions[0].motherId, 'M1');
  assert.equal(migrated.userQuestions[0].source, 'user');
  assert.equal(
    migrated.userQuestions[0].normalizedPrompt,
    'describe an old person you enjoy talking to'
  );
  assert.equal(migrated.legacy.assignments['legacy-q1'], 'elder-person');
});

test('importSeasonQuestions skips same-season duplicates, inherits motherId across seasons, and normalizes prompts', () => {
  const baseState = {
    ...createEmptyBankState(),
    seasons: [
      {
        id: '2026-05-08',
        label: '2026 年 5–8 月',
        status: 'current',
        createdAt: '2026-05-08T00:00:00.000Z',
      },
    ],
    activeSeasonId: '2026-05-08',
    userQuestions: [
      {
        id: 'user-q1',
        prompt: 'A teacher',
        cues: [],
        tags: [],
        seasonId: '2026-05-08',
        motherId: 'M1',
        source: 'user',
        normalizedPrompt: 'a teacher',
        createdAt: '2026-05-08T00:00:00.000Z',
      },
    ],
  };

  const sameSeason = importSeasonQuestions(
    baseState,
    [{ prompt: ' A  Teacher! ', cues: ['who this person is'] }],
    '2026-05-08',
    () => 'generated-same-season'
  );
  const crossSeason = importSeasonQuestions(
    baseState,
    [{ prompt: ' A  Teacher! ', cues: ['who this person is'] }],
    '2026-09-12',
    () => 'generated-cross-season'
  );

  assert.equal(normalizePrompt(' A  Teacher! '), 'a teacher');
  assert.equal(sameSeason.userQuestions.length, 1);
  assert.equal(crossSeason.userQuestions.length, 2);
  assert.equal(crossSeason.userQuestions[1].id, 'generated-cross-season');
  assert.equal(crossSeason.userQuestions[1].seasonId, '2026-09-12');
  assert.equal(crossSeason.userQuestions[1].motherId, 'M1');
});

test('mergeOfficialQuestions respects classification overrides and serializeBankState returns a detached plain object', () => {
  const state = {
    ...createEmptyBankState(),
    classificationOverrides: {
      official1: 'M2',
    },
  };

  const merged = mergeOfficialQuestions(state, [
    {
      id: 'official1',
      prompt: 'Describe an old person you enjoy talking to.',
      cues: [],
      tags: [],
      seasonId: '2026-05-08',
      motherId: 'M1',
      source: 'official',
      normalizedPrompt: 'describe an old person you enjoy talking to',
      createdAt: '2026-05-08T00:00:00.000Z',
    },
  ]);
  const serialized = serializeBankState(merged);

  assert.equal(merged.questions[0].motherId, 'M2');
  assert.equal(serialized.questions[0].motherId, 'M2');
  assert.notEqual(serialized, merged);
});
