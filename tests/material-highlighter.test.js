import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findReusedRanges,
  renderHighlightedAnswer,
} from '../src/material-highlighter.js';

test('highlights meaningful repeated phrases but ignores common short text', () => {
  const material = 'I went fishing with my grandfather beside a quiet lake. It was a sunny morning.';
  const answer = 'I would like to talk about my grandfather. I went fishing with my grandfather beside a quiet lake, and the trip changed me.';
  const ranges = findReusedRanges(material, answer);

  assert.equal(
    answer.slice(ranges[0].start, ranges[0].end),
    'I went fishing with my grandfather beside a quiet lake'
  );
  assert.equal(ranges.some((range) => answer.slice(range.start, range.end) === 'I would'), false);
});

test('ranges do not overlap and survive punctuation/case differences', () => {
  const ranges = findReusedRanges('A Quiet Lake near HOME', 'I visited a quiet lake near home, last year.');

  assert.deepEqual(ranges, [{ start: 10, end: 32 }]);
});

test('common answer-opening boilerplate is not highlighted as meaningful reuse', () => {
  const material = 'I would like to talk about this topic today. The actual story is different.';
  const answer = 'To begin, I would like to talk about this topic today, before giving my own example.';

  assert.deepEqual(findReusedRanges(material, answer), []);
});

test('renderHighlightedAnswer builds text nodes and marks without writing markup', () => {
  const operations = [];
  const documentStub = {
    createTextNode(text) {
      return { nodeType: 'text', text };
    },
    createElement(tagName) {
      return {
        nodeType: 'element',
        tagName,
        className: '',
        title: '',
        children: [],
        appendChild(child) {
          this.children.push(child);
          operations.push(['mark-child', child.text]);
          return child;
        },
      };
    },
  };
  const container = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
      operations.push(['replace', children.length]);
    },
    set innerHTML(_value) {
      throw new Error('innerHTML should not be used for highlighted answers');
    },
  };

  renderHighlightedAnswer(
    container,
    'Practice near home with <script>alert(1)</script>',
    [{ start: 0, end: 18 }],
    'question',
    documentStub
  );

  assert.equal(container.children[0].tagName, 'mark');
  assert.equal(container.children[0].className, 'material-reuse');
  assert.equal(container.children[0].title, '来自本题素材');
  assert.equal(container.children[0].children[0].text, 'Practice near home');
  assert.equal(container.children[1].text, ' with <script>alert(1)</script>');
  assert.deepEqual(operations.at(-1), ['replace', 2]);
});
