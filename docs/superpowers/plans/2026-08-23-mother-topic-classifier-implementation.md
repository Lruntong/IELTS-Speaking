# Mother Topic Classifier and Material Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a seasonal Part 2 question classifier that binds each classified question to one of eight core materials, gives unclassified questions one dedicated material, and saves one highlighted adapted answer per question.

**Architecture:** Keep the existing Vite/vanilla JavaScript UI and add focused ESM modules for domain constants, persistence/migration, local classification, and reusable-answer highlighting. `main.js` remains the UI coordinator; `api/generate.js` remains the single server endpoint with separate DeepSeek tasks. Official questions are read-only static data, while user additions and overrides remain in versioned LocalStorage.

**Tech Stack:** Vite 8, browser ES modules, vanilla HTML/CSS, Node.js built-in test runner, Vercel-style serverless API, DeepSeek JSON Output.

**Spec:** `docs/superpowers/specs/2026-08-23-mother-topic-classifier-design.md`

## Global Constraints

- Stay on the current Vite architecture; do not migrate to Next.js, TypeScript, React, or Zustand.
- Do not restructure the layouts or core logic of existing material generation, recording, reading, transcription, or review flows.
- Extend fields only; never rename or delete existing stored fields.
- Use internal IDs `M1`–`M8`; show only natural Chinese labels such as `人物－长辈`.
- Keep exactly one core material per mother topic and one dedicated material per unclassified question.
- Keep exactly one saved adapted answer per question; confirm before overwriting it.
- Classification UI must keep a draft until the user clicks `确认分类`.
- Do not add `@dnd-kit`; use native drag events plus Pointer Events because the app is not React.
- Commit each task separately and preserve unrelated working-tree changes.

---

### Task 1: Domain constants, seasonal schema, and compatibility migration

**Files:**
- Create: `src/mother-topics.js`
- Create: `src/question-bank-store.js`
- Create: `data/question-bank.js`
- Create: `tests/question-bank-store.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `MOTHER_TOPICS`, `LEGACY_TO_MOTHER_ID`, `getMotherTopic(id)`, `normalizePrompt(text)`.
- Produces: `createEmptyBankState()`, `migrateLegacyBank(raw)`, `mergeOfficialQuestions(state, officialQuestions)`, `importSeasonQuestions(state, items, seasonId)`, `serializeBankState(state)`.
- Data shape: `{ schemaVersion: 2, seasons, activeSeasonId, userQuestions, classificationOverrides, savedAnswers }`.

- [ ] **Step 1: Add the test command and write failing migration/import tests**

Add `"test": "node --test"` to `package.json`. In `tests/question-bank-store.test.js`, assert these exact behaviors:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { importSeasonQuestions, migrateLegacyBank, normalizePrompt } from '../src/question-bank-store.js';

test('legacy slot ids migrate without deleting legacy assignments', () => {
  const migrated = migrateLegacyBank({
    questions: [{ id: 'old-1', prompt: 'Describe an old person.', season: '2026-05' }],
    assignments: { 'old-1': 'elder-person' },
    suggestions: {}
  });
  assert.equal(migrated.userQuestions[0].motherId, 'M1');
  assert.equal(migrated.legacy.assignments['old-1'], 'elder-person');
});

test('same-season duplicates skip and cross-season duplicates inherit motherId', () => {
  const base = migrateLegacyBank({ questions: [], assignments: {}, suggestions: {} });
  const may = importSeasonQuestions(base, [{ prompt: 'Describe a helpful teacher.', motherId: 'M1' }], '2026-05-08');
  const mayAgain = importSeasonQuestions(may.state, [{ prompt: '  Describe a helpful teacher! ' }], '2026-05-08');
  const september = importSeasonQuestions(may.state, [{ prompt: 'Describe a helpful teacher!' }], '2026-09-12');
  assert.equal(mayAgain.added.length, 0);
  assert.equal(mayAgain.skipped.length, 1);
  assert.equal(september.added[0].motherId, 'M1');
  assert.notEqual(september.added[0].id, may.added[0].id);
  assert.equal(normalizePrompt(' A  Teacher! '), 'a teacher');
});
```

- [ ] **Step 2: Run the tests and verify the missing modules fail**

Run: `npm test -- tests/question-bank-store.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/question-bank-store.js`.

- [ ] **Step 3: Implement constants, migration, merge, and import as pure functions**

In `src/mother-topics.js`, export frozen records for all eight topics and the fixed legacy map. In `src/question-bank-store.js`, keep all functions free of DOM and LocalStorage access. Normalize case, Unicode punctuation, repeated whitespace, terminal punctuation, and apostrophe variants. Generate IDs with an injectable/default ID factory so tests are deterministic when needed.

`migrateLegacyBank` must copy the old object under `legacy`, extend each legacy question with `seasonId`, `normalizedPrompt`, `source: 'user'`, and mapped `motherId`, and never mutate its argument. `mergeOfficialQuestions` must let `classificationOverrides[question.id]` win over static `motherId`.

Seed `data/question-bank.js` with the existing eight sample questions under a `2026-05-08` season so the static-data loading path works without inventing a full production question bank.

- [ ] **Step 4: Run unit tests and build**

Run: `npm test -- tests/question-bank-store.test.js`

Expected: all tests PASS.

Run: `npm run build`

Expected: Vite exits 0 and writes `dist/`.

- [ ] **Step 5: Commit the data foundation**

```bash
git add package.json src/mother-topics.js src/question-bank-store.js data/question-bank.js tests/question-bank-store.test.js
git commit -m "feat: add seasonal mother-topic data model"
```

---

### Task 2: Local classifier and confirmed classification drafts

**Files:**
- Create: `src/local-classifier.js`
- Create: `tests/local-classifier.test.js`
- Modify: `index.html:114-165`
- Modify: `main.js:428-795`
- Modify: `style.css:79-122`

**Interfaces:**
- Consumes: `MOTHER_TOPICS`, `getMotherTopic`, `normalizePrompt`, and the Task 1 state shape.
- Produces: `classifyQuestionLocally(question): 'M1'|'M2'|'M3'|'M4'|'M5'|'M6'|'M7'|'M8'|null`.
- UI state: `classificationDraft: Record<questionId, motherId|null>`; only `confirmClassificationDraft()` writes overrides.

- [ ] **Step 1: Write failing conservative-classifier tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuestionLocally } from '../src/local-classifier.js';

const cases = [
  ['Describe an elderly person you enjoy talking to.', 'M1'],
  ['Describe a close friend who helped you.', 'M2'],
  ['Describe an object you have kept for a long time.', 'M3'],
  ['Describe an app you use every day.', 'M4'],
  ['Describe a beautiful lake you visited.', 'M5'],
  ['Describe a room where you relax.', 'M6'],
  ['Describe an achievement you are proud of.', 'M7'],
  ['Describe a difficult experience when you failed.', 'M8']
];
for (const [prompt, expected] of cases) test(prompt, () => assert.equal(classifyQuestionLocally({ prompt }), expected));
test('ambiguous prompt stays unclassified', () => assert.equal(classifyQuestionLocally({ prompt: 'Describe something interesting.' }), null));
```

- [ ] **Step 2: Run the classifier test and verify failure**

Run: `npm test -- tests/local-classifier.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement conservative keyword scoring**

Tokenize prompt and cues, score exact phrase hits above token hits, add a small normalized Levenshtein tie-breaker, and return `null` when the best score is zero or tied. Keep thresholds in named constants and do not expose numeric confidence to UI.

- [ ] **Step 4: Replace the always-live board with a seasonal board and modal draft**

In `index.html`, add `seasonSelect`, `openImportModalBtn`, and one accessible `<dialog id="classificationDialog">` containing import step, preview step, eight-topic navigation, question-card area, unclassified pool, Cancel, and `确认分类`. Keep the existing bank section and IDs needed by unrelated navigation.

In `main.js`, load the Task 1 state, merge official data, filter render output by `activeSeasonId`, and clone current classifications into `classificationDraft` when the dialog opens. Drag/drop and select changes update only the draft. Cancel closes without persistence; close with differences uses `window.confirm`; confirm copies draft values into `classificationOverrides` and persists once.

Add Pointer Events that create a visual drag proxy and resolve targets using `document.elementFromPoint`, while retaining keyboard-accessible `<select>` controls on cards.

- [ ] **Step 5: Style and verify the dialog at desktop and mobile widths**

Add modal backdrop, two-column desktop layout, fixed unclassified pool, selected topic state, compact cards, and a one-column layout under 760px. Ensure focus indicators remain visible.

Run: `npm test`

Expected: all tests PASS.

Run: `npm run build`

Expected: build exits 0.

- [ ] **Step 6: Commit the manual classifier**

```bash
git add src/local-classifier.js tests/local-classifier.test.js index.html main.js style.css
git commit -m "feat: add confirmed seasonal classification dialog"
```

---

### Task 3: DeepSeek batch classification with partial local fallback

**Files:**
- Modify: `api/generate.js:8-177`
- Modify: `main.js` classification request flow from Task 2
- Create: `src/classification-merge.js`
- Create: `tests/classification-merge.test.js`

**Interfaces:**
- Produces API response: `{ classifications: [{ id, motherId }], provider: 'deepseek' }`.
- Produces: `mergeClassificationResults(questions, inherited, remote, localClassifier): Record<string, string|null>`.
- Valid mother IDs are exactly `M1`–`M8`; malformed or unknown IDs are ignored.

- [ ] **Step 1: Write failing partial-result merge tests**

```js
test('inherited wins, remote fills next, local fills omissions', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = mergeClassificationResults(
    questions,
    { a: 'M1' },
    [{ id: 'a', motherId: 'M8' }, { id: 'b', motherId: 'M2' }, { id: 'c', motherId: 'BAD' }],
    q => q.id === 'c' ? 'M3' : null
  );
  assert.deepEqual(result, { a: 'M1', b: 'M2', c: 'M3' });
});
```

- [ ] **Step 2: Run the merge test and verify failure**

Run: `npm test -- tests/classification-merge.test.js`

Expected: FAIL because `mergeClassificationResults` is not implemented.

- [ ] **Step 3: Implement deterministic merge precedence**

Implement inherited → valid DeepSeek result → local classifier → `null`. Return a new object and never mutate inputs.

- [ ] **Step 4: Update the API task**

Replace legacy slug output for `slot-recommend` with `M1`–`M8` output and rename the internal handler to `handleMotherClassify`. Send batches of at most 20 questions, request JSON only, validate every ID and mother ID, and return non-streaming JSON. Read `DEEPSEEK_MODEL` with a current-model default while leaving the answer/review model behavior configurable and backward compatible.

If `DEEPSEEK_API_KEY` is absent, return status 503 with a stable `classification_unavailable` code so the browser immediately uses local fallback. Do not return model-provided confidence or reasons.

- [ ] **Step 5: Wire import preview to AI and fallback**

Call the API only for newly imported questions without inherited classifications. Merge partial results through `mergeClassificationResults`; on network/non-2xx/parse error, run the local classifier for all unresolved questions. Show only `已完成 AI 初步分类` or `已使用本地规则完成初步分类`.

- [ ] **Step 6: Run all tests and build, then commit**

Run: `npm test && npm run build`

Expected: all tests pass and build exits 0.

```bash
git add api/generate.js main.js src/classification-merge.js tests/classification-merge.test.js
git commit -m "feat: add DeepSeek classification fallback"
```

---

### Task 4: Eight core material slots and unclassified-question materials

**Files:**
- Create: `src/material-store.js`
- Create: `tests/material-store.test.js`
- Modify: `index.html:167-185`
- Modify: `main.js:45-211`
- Modify: `style.css:73-77`

**Interfaces:**
- Produces: `getCoreMaterial(materials, motherId)`, `getQuestionMaterial(materials, questionId)`, `upsertCoreMaterial(materials, input)`, `upsertQuestionMaterial(materials, input)`, `resolveMaterialForQuestion(materials, question)`.
- `resolveMaterialForQuestion` returns `{ material, bindingType: 'mother-core'|'question-specific' }` or `null`.

- [ ] **Step 1: Write failing uniqueness and resolution tests**

```js
test('upsert replaces the one core material for a mother topic', () => {
  const first = upsertCoreMaterial([], { id: 'a', motherId: 'M1', story: 'first' });
  const second = upsertCoreMaterial(first, { id: 'b', motherId: 'M1', story: 'second' });
  assert.equal(second.length, 1);
  assert.equal(second[0].story, 'second');
});

test('classified and unclassified questions resolve their unique material', () => {
  const materials = [
    { id: 'core', type: 'mother-core', motherId: 'M1', story: 'core story' },
    { id: 'special', type: 'question-specific', questionId: 'q2', story: 'special story' }
  ];
  assert.equal(resolveMaterialForQuestion(materials, { id: 'q1', motherId: 'M1' }).material.id, 'core');
  assert.equal(resolveMaterialForQuestion(materials, { id: 'q2', motherId: null }).material.id, 'special');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/material-store.test.js`

Expected: FAIL because the material-store module is absent.

- [ ] **Step 3: Implement immutable material upserts and resolution**

Preserve old material objects unchanged. New upserts extend fields with `type`, binding ID, and timestamps. Replacing a slot creates/updates exactly one record for that binding and does not touch unrelated materials.

- [ ] **Step 4: Render eight fixed slots and reuse the editor**

Replace the free-form “add material” entry point with eight compact slot cards. An empty slot opens the existing editor with `type: 'mother-core'` and its `motherId`; a filled slot opens it for editing/replacement. Add a small section listing current-season unclassified questions and their dedicated-material status. Their buttons open the same editor with `type: 'question-specific'` and `questionId`.

Keep title, tags, story, search compatibility, and old material rendering. Remove the practice-page manual material choice only when a bank question is selected; retain it for legacy free-form practice.

- [ ] **Step 5: Run tests/build and commit**

Run: `npm test && npm run build`

Expected: tests pass and build exits 0.

```bash
git add src/material-store.js tests/material-store.test.js index.html main.js style.css
git commit -m "feat: bind one material to each mother topic"
```

---

### Task 5: Three-paragraph adaptation and one saved answer per question

**Files:**
- Create: `src/saved-answer-store.js`
- Create: `tests/saved-answer-store.test.js`
- Modify: `api/generate.js:179-end`
- Modify: `index.html:27-85`
- Modify: `main.js:260-276,717-723,797-end`
- Modify: `style.css:19-76`

**Interfaces:**
- Produces: `getSavedAnswer(state, questionId)`, `saveAnswer(state, answer)`, `isMaterialNewer(answer, material)`.
- Adaptation request includes `{ task: 'adapt-answer', questionId, topic, cues, motherLabel, personalMaterial }`.
- Saved answer shape matches the spec and is stored under bank schema v2.

- [ ] **Step 1: Write failing saved-answer tests**

```js
test('saving the same question replaces only its current answer', () => {
  const once = saveAnswer({}, { questionId: 'q1', content: 'one', updatedAt: '2026-01-01' });
  const twice = saveAnswer(once, { questionId: 'q1', content: 'two', updatedAt: '2026-01-02' });
  assert.equal(Object.keys(twice).length, 1);
  assert.equal(getSavedAnswer(twice, 'q1').content, 'two');
});

test('detects material edits after answer generation', () => {
  assert.equal(isMaterialNewer({ materialUpdatedAt: '2026-01-01' }, { updatedAt: '2026-01-02' }), true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/saved-answer-store.test.js`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement saved-answer helpers**

Use a question-ID keyed object. Return new objects on save. Compare parseable ISO timestamps; missing material timestamps do not produce a stale warning.

- [ ] **Step 4: Add the adaptation API prompt**

Add `adapt-answer` to supported tasks. Require topic and a valid personal material. Prompt DeepSeek to output exactly three plain-text paragraphs: paraphrased opening/transition, selectively emphasized story body, and feeling/impact conclusion. Explicitly forbid invented facts and markdown headings. Keep SSE streaming so current rendering behavior remains intact.

- [ ] **Step 5: Auto-resolve material and add save controls**

Track `selectedQuestionId`. `openInPractice` resolves the unique material, shows only mother label/material title, loads the saved answer if present, and directs missing bindings to the existing editor. Add an editable answer surface plus `保存答案`; preserve clean `latestAnswer` for reading/copying. If a saved answer exists before regeneration, ask for overwrite confirmation. Persist only after explicit save.

- [ ] **Step 6: Add stale-material notice, verify, and commit**

Show `素材已更新，可重新生成适配答案` when `isMaterialNewer` is true; never delete the old answer.

Run: `npm test && npm run build`

Expected: all tests pass and build exits 0.

```bash
git add src/saved-answer-store.js tests/saved-answer-store.test.js api/generate.js index.html main.js style.css
git commit -m "feat: save one adapted answer per question"
```

---

### Task 6: Source-material highlighting and template-aware review

**Files:**
- Create: `src/material-highlighter.js`
- Create: `tests/material-highlighter.test.js`
- Modify: `api/generate.js` speaking-review prompt and payload parsing
- Modify: `main.js:359-370` and saved-answer rendering from Task 5
- Modify: `style.css` answer/highlight rules

**Interfaces:**
- Produces: `findReusedRanges(materialText, answerText): Array<{ start, end }>` and `renderHighlightedAnswer(container, answerText, ranges, sourceLabel)`.
- Review request extends the existing payload with `questionMotherId` and `sourceMaterial`.

- [ ] **Step 1: Write failing range-matching tests**

```js
test('highlights meaningful repeated phrases but ignores common short text', () => {
  const material = 'I went fishing with my grandfather beside a quiet lake. It was a sunny morning.';
  const answer = 'I would like to talk about my grandfather. I went fishing with my grandfather beside a quiet lake, and the trip changed me.';
  const ranges = findReusedRanges(material, answer);
  assert.equal(answer.slice(ranges[0].start, ranges[0].end), 'I went fishing with my grandfather beside a quiet lake');
  assert.equal(ranges.some(range => answer.slice(range.start, range.end) === 'I would'), false);
});

test('ranges do not overlap and survive punctuation/case differences', () => {
  const ranges = findReusedRanges('A Quiet Lake near HOME', 'I visited a quiet lake near home, last year.');
  assert.deepEqual(ranges, [{ start: 10, end: 32 }]);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/material-highlighter.test.js`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement deterministic non-overlapping highlighting**

Normalize English tokens while retaining original answer offsets. Find maximal common token sequences of at least five meaningful words, reject stopword-only spans, prefer longer spans, and remove overlaps. Render with DOM text nodes and `<mark class="material-reuse">`; never inject answer text through `innerHTML`. Put `title="来自核心素材"` or `title="来自本题素材"` on each mark.

- [ ] **Step 4: Add edit/review mode behavior**

Show marks only in saved-answer review mode. Switching to edit mode shows plain text. After save, recompute ranges from current material and clean answer text. Reading and copy operations continue using `latestAnswer`, never marked HTML.

- [ ] **Step 5: Extend speaking review safely**

Send the resolved source material with the transcript. Update the system prompt: reuse of facts and isolated keywords is normal; only mention memorization when long wording and sequence are unusually close; do not output a percentage. Preserve the existing four Chinese section headings so the current review renderer remains compatible.

- [ ] **Step 6: Run full verification and commit**

Run: `npm test`

Expected: all domain tests PASS.

Run: `npm run build`

Expected: Vite build exits 0 with no missing imports.

Perform browser smoke checks at desktop and 390px width:

1. Select a season, import duplicate and new questions, and confirm inherited classification.
2. Drag a question, cancel, reopen, and verify no persisted move.
3. Drag again, confirm, refresh, and verify persistence.
4. Prepare one core material and one unclassified-question material; verify unique resolution.
5. Generate, edit, save, refresh, and reopen one answer.
6. Verify meaningful reused text is highlighted and copied text is clean.
7. Record/transcribe/review once and verify existing controls still work.
8. Temporarily omit `DEEPSEEK_API_KEY` and verify local classification remains usable.

```bash
git add src/material-highlighter.js tests/material-highlighter.test.js api/generate.js main.js style.css
git commit -m "feat: highlight material reuse in saved answers"
```

