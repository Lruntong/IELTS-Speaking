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
    transcript: Array(45).fill('detail').join(' '),
    referenceAnswer: 'GENERATED_REFERENCE_MUST_NOT_BE_COMPARED',
    questionMotherId: 'M3',
    sourceMaterial: '我和外公在湖边钓鱼，那天早上阳光很好。',
  });

  const prompt = messages.map((message) => message.content).join('\n');

  assert.match(prompt, /做得好的：, 最值得改的一点：, 更自然的说法：, 下次挑战：/);
  assert.match(prompt, /Source material used to generate the answer/);
  assert.match(prompt, /M3/);
  assert.match(prompt, /isolated keywords/i);
  assert.match(prompt, /compare[^.]*only[^.]*original source material/i);
  assert.match(prompt, /Do not output a memorization percentage/i);
  assert.doesNotMatch(prompt, /GENERATED_REFERENCE_MUST_NOT_BE_COMPARED/);
});

test('speaking-review skips template judgment without source material or for a short transcript', () => {
  const withoutMaterial = buildGenerationMessages({
    task: 'speaking-review',
    topic: 'Describe a place.',
    transcript: Array(45).fill('original').join(' '),
    sourceMaterial: '',
  }).map((message) => message.content).join('\n');
  const shortTranscript = buildGenerationMessages({
    task: 'speaking-review',
    topic: 'Describe a place.',
    transcript: 'I visited the lake yesterday.',
    sourceMaterial: 'I visited a quiet lake with my family and stayed there all morning.',
  }).map((message) => message.content).join('\n');

  assert.match(withoutMaterial, /skip[^.]*template[^.]*source material/i);
  assert.match(shortTranscript, /skip[^.]*template[^.]*too short/i);
});
