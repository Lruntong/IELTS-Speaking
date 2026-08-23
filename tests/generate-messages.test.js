import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGenerationMessages } from '../api/generate.js';

test('adapt-answer prompt requires exactly three natural paragraphs without invented facts', () => {
  const messages = buildGenerationMessages({
    task: 'adapt-answer',
    topic: 'Describe an older person you enjoy talking to.',
    cues: ['who this person is', 'what you do together'],
    motherLabel: '人物-长辈',
    personalMaterial: {
      title: '和外公湖边散步',
      story: '我常和外公在湖边散步，他会聊年轻时的工作。',
      tags: ['family'],
    },
  });

  const prompt = messages.map((message) => message.content).join('\n');

  assert.equal(messages.length, 2);
  assert.match(prompt, /exactly three/i);
  assert.match(prompt, /plain-text paragraphs/i);
  assert.match(prompt, /Do not invent/i);
  assert.match(prompt, /markdown headings/i);
  assert.match(prompt, /和外公湖边散步/);
});

test('speaking-review prompt keeps four Chinese headings and treats source material as context', () => {
  const messages = buildGenerationMessages({
    task: 'speaking-review',
    topic: 'Describe an outdoor activity.',
    transcript: 'I went fishing with my grandfather beside a quiet lake.',
    referenceAnswer: 'I went fishing with my grandfather beside a quiet lake.',
    questionMotherId: 'M3',
    sourceMaterial: '我和外公在湖边钓鱼，那天早上阳光很好。',
  });

  const prompt = messages.map((message) => message.content).join('\n');

  assert.match(prompt, /做得好的：, 最值得改的一点：, 更自然的说法：, 下次挑战：/);
  assert.match(prompt, /Source material used to generate the answer/);
  assert.match(prompt, /M3/);
  assert.match(prompt, /isolated keywords/i);
  assert.match(prompt, /Do not output a memorization percentage/i);
});
