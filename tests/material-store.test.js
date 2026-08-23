import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCoreMaterial,
  getQuestionMaterial,
  resolveMaterialForQuestion,
  upsertCoreMaterial,
  upsertQuestionMaterial,
} from '../src/material-store.js';

test('upsertCoreMaterial replaces the existing mother-topic slot and preserves unrelated materials', () => {
  const legacyMaterial = {
    id: 'legacy-1',
    title: '旧素材',
    story: '老故事',
    tags: ['legacy'],
    createdAt: '2026-08-20T00:00:00.000Z',
  };
  const firstPass = upsertCoreMaterial([legacyMaterial], {
    id: 'core-a',
    motherId: 'M1',
    title: '人物母题',
    story: '第一版故事',
    tags: ['家人'],
    createdAt: '2026-08-21T00:00:00.000Z',
  });

  const secondPass = upsertCoreMaterial(firstPass, {
    id: 'core-b',
    motherId: 'M1',
    title: '人物母题新版',
    story: '第二版故事',
    tags: ['长辈'],
    createdAt: '2026-08-22T00:00:00.000Z',
  });

  assert.equal(secondPass.filter((material) => material.type === 'mother-core').length, 1);
  assert.equal(getCoreMaterial(secondPass, 'M1')?.id, 'core-b');
  assert.equal(getCoreMaterial(secondPass, 'M1')?.story, '第二版故事');
  assert.deepEqual(secondPass.find((material) => material.id === 'legacy-1'), legacyMaterial);
});

test('upsertQuestionMaterial keeps exactly one dedicated material per question', () => {
  const firstPass = upsertQuestionMaterial([], {
    id: 'question-a',
    questionId: 'q-1',
    title: '未分类题专属素材',
    story: '第一次回答',
    tags: ['专属'],
    createdAt: '2026-08-21T00:00:00.000Z',
  });

  const secondPass = upsertQuestionMaterial(firstPass, {
    id: 'question-b',
    questionId: 'q-1',
    title: '未分类题专属素材新版',
    story: '第二次回答',
    tags: ['专属', '更新'],
    createdAt: '2026-08-22T00:00:00.000Z',
  });

  assert.equal(secondPass.filter((material) => material.type === 'question-specific').length, 1);
  assert.equal(getQuestionMaterial(secondPass, 'q-1')?.id, 'question-b');
  assert.equal(getQuestionMaterial(secondPass, 'q-1')?.title, '未分类题专属素材新版');
});

test('resolveMaterialForQuestion returns the core material for classified questions and the dedicated material for unclassified questions', () => {
  const materials = [
    {
      id: 'core-1',
      type: 'mother-core',
      motherId: 'M2',
      title: '人物故事',
      story: '核心母题故事',
      tags: ['人物'],
      createdAt: '2026-08-21T00:00:00.000Z',
    },
    {
      id: 'question-1',
      type: 'question-specific',
      questionId: 'q-2',
      title: '专属题目故事',
      story: '只给这道题用',
      tags: ['专属'],
      createdAt: '2026-08-22T00:00:00.000Z',
    },
  ];

  const classified = resolveMaterialForQuestion(materials, {
    id: 'q-1',
    motherId: 'M2',
  });
  const unclassified = resolveMaterialForQuestion(materials, {
    id: 'q-2',
    motherId: null,
  });

  assert.equal(classified?.bindingType, 'mother-core');
  assert.equal(classified?.material.id, 'core-1');
  assert.equal(unclassified?.bindingType, 'question-specific');
  assert.equal(unclassified?.material.id, 'question-1');
});

test('resolveMaterialForQuestion returns null when no matching binding exists', () => {
  assert.equal(
    resolveMaterialForQuestion(
      [
        {
          id: 'legacy-1',
          title: '旧素材',
          story: '老故事',
          tags: ['legacy'],
          createdAt: '2026-08-20T00:00:00.000Z',
        },
      ],
      {
        id: 'q-3',
        motherId: null,
      }
    ),
    null
  );
});
