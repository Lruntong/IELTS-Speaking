import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/generate.js';

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

function deepSeekResponse(classifications, options = {}) {
  const content = options.rawContent ?? JSON.stringify({ classifications });
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: options.status || 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function questions(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `q-${index + 1}`,
    prompt: `Describe topic ${index + 1}.`,
    cues: [`detail ${index + 1}`],
  }));
}

async function invokeMotherClassify(items) {
  const res = createResponseRecorder();
  await handler({ method: 'POST', body: { task: 'mother-classify', questions: items } }, res);
  return res;
}

test('mother-classify uses exact 20-item batch boundaries', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  process.env.DEEPSEEK_API_KEY = 'test-key';
  const batchSizes = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const batch = JSON.parse(body.messages[1].content.split('题目列表：\n')[1]);
    batchSizes.push(batch.length);
    return deepSeekResponse(batch.map((question) => ({ id: question.id, motherId: 'M1' })));
  };

  const res = await invokeMotherClassify(questions(21));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(batchSizes, [20, 1]);
  assert.equal(res.payload.classifications.length, 21);
  assert.equal(res.payload.provider, 'deepseek');
  assert.equal(res.payload.incomplete, false);
  assert.equal(res.payload.remoteCount, 21);
});

test('mother-classify missing key returns stable 503 code', async (t) => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  delete process.env.DEEPSEEK_API_KEY;

  const res = await invokeMotherClassify(questions(1));

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.code, 'classification_unavailable');
});

test('mother-classify keeps valid mixed payload entries and reports unresolved items', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  process.env.DEEPSEEK_API_KEY = 'test-key';
  globalThis.fetch = async () => deepSeekResponse([
    { id: 'q-1', motherId: 'M2' },
    { id: 'q-1', motherId: 'M8' },
    { id: 'q-2', motherId: 'BAD' },
    { id: 'unknown', motherId: 'M3' },
  ]);

  const res = await invokeMotherClassify(questions(3));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.classifications, [{ id: 'q-1', motherId: 'M2' }]);
  assert.equal(res.payload.provider, 'mixed');
  assert.equal(res.payload.incomplete, true);
  assert.equal(res.payload.requestedCount, 3);
  assert.equal(res.payload.remoteCount, 1);
  assert.deepEqual(res.payload.unresolvedIds, ['q-2', 'q-3']);
});

test('mother-classify turns malformed successful payload into local fallback metadata', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  process.env.DEEPSEEK_API_KEY = 'test-key';
  globalThis.fetch = async () => deepSeekResponse([], { rawContent: 'not-json' });

  const res = await invokeMotherClassify(questions(2));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.classifications, []);
  assert.equal(res.payload.provider, 'local');
  assert.equal(res.payload.incomplete, true);
  assert.deepEqual(res.payload.unresolvedIds, ['q-1', 'q-2']);
});

test('mother-classify retains earlier batch success when a later batch fails', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalConsoleError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  console.error = () => {};
  process.env.DEEPSEEK_API_KEY = 'test-key';
  let call = 0;
  globalThis.fetch = async (_url, options) => {
    call += 1;
    if (call === 2) {
      return new Response('upstream failed', { status: 502 });
    }
    const body = JSON.parse(options.body);
    const batch = JSON.parse(body.messages[1].content.split('题目列表：\n')[1]);
    return deepSeekResponse(batch.map((question) => ({ id: question.id, motherId: 'M5' })));
  };

  const res = await invokeMotherClassify(questions(21));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.classifications.length, 20);
  assert.equal(res.payload.provider, 'mixed');
  assert.equal(res.payload.incomplete, true);
  assert.equal(res.payload.code, 'classification_partial');
  assert.deepEqual(res.payload.unresolvedIds, ['q-21']);
});

test('mother-classify retains earlier batch success when a later fetch throws', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalConsoleError = console.error;
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  });
  console.error = () => {};
  process.env.DEEPSEEK_API_KEY = 'test-key';
  let call = 0;
  globalThis.fetch = async (_url, options) => {
    call += 1;
    if (call === 2) {
      throw new Error('network interrupted');
    }
    const body = JSON.parse(options.body);
    const batch = JSON.parse(body.messages[1].content.split('题目列表：\n')[1]);
    return deepSeekResponse(batch.map((question) => ({ id: question.id, motherId: 'M5' })));
  };

  const res = await invokeMotherClassify(questions(21));

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.classifications.length, 20);
  assert.equal(res.payload.provider, 'mixed');
  assert.equal(res.payload.incomplete, true);
  assert.equal(res.payload.code, 'classification_partial');
  assert.deepEqual(res.payload.unresolvedIds, ['q-21']);
});
