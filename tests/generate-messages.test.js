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
