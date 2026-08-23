import test from 'node:test';
import assert from 'node:assert/strict';

import { resetBankQuestionPracticeContext } from '../src/practice-session-state.js';

test('exiting bank-question context clears saved-answer practice state while preserving typed topic', () => {
  const reset = resetBankQuestionPracticeContext({
    topic: 'Describe a different topic I just typed',
    practiceQuestionId: 'q1',
    selectedMaterialId: 'material-1',
    latestAnswer: 'saved bank answer',
    answerText: 'saved bank answer',
    resultVisible: true,
    recordingVisible: true,
    finalTranscript: 'old transcript',
    interimTranscript: 'old interim',
    confirmedTranscript: 'old confirmed transcript',
    transcriptText: 'old transcript',
    reviewText: 'old review',
    reviewVisible: true,
    savedAnswerStatus: '已保存答案',
  });

  assert.equal(reset.topic, 'Describe a different topic I just typed');
  assert.equal(reset.practiceQuestionId, '');
  assert.equal(reset.selectedMaterialId, '');
  assert.equal(reset.latestAnswer, '');
  assert.equal(reset.answerText, '');
  assert.equal(reset.resultVisible, false);
  assert.equal(reset.recordingVisible, false);
  assert.equal(reset.finalTranscript, '');
  assert.equal(reset.interimTranscript, '');
  assert.equal(reset.confirmedTranscript, '');
  assert.equal(reset.transcriptText, '');
  assert.equal(reset.reviewText, '');
  assert.equal(reset.reviewVisible, false);
  assert.equal(reset.savedAnswerStatus, '');
});
