export function resetBankQuestionPracticeContext(state = {}) {
  return {
    ...state,
    topic: String(state.topic ?? ''),
    practiceQuestionId: '',
    selectedMaterialId: '',
    latestAnswer: '',
    answerText: '',
    resultVisible: false,
    recordingVisible: false,
    finalTranscript: '',
    interimTranscript: '',
    confirmedTranscript: '',
    transcriptText: '',
    reviewText: '',
    reviewVisible: false,
    savedAnswerStatus: '',
  };
}
