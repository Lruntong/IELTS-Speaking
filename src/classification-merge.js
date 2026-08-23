import { MOTHER_TOPICS } from './mother-topics.js';

const VALID_MOTHER_IDS = new Set(MOTHER_TOPICS.map((topic) => topic.id));

function normalizeMotherId(value) {
  return VALID_MOTHER_IDS.has(value) ? value : null;
}

export function mergeClassificationResults(
  questions,
  inherited,
  remote,
  localClassifier
) {
  const knownQuestions = Array.isArray(questions) ? questions : [];
  const inheritedMap =
    inherited && typeof inherited === 'object' && !Array.isArray(inherited)
      ? inherited
      : {};
  const remoteList = Array.isArray(remote) ? remote : [];
  const classifyLocally =
    typeof localClassifier === 'function' ? localClassifier : () => null;

  const remoteMap = new Map();
  const knownIds = new Set(knownQuestions.map((question) => question?.id).filter(Boolean));

  remoteList.forEach((item) => {
    if (!knownIds.has(item?.id) || remoteMap.has(item?.id)) {
      return;
    }

    const motherId = normalizeMotherId(item?.motherId);
    if (!motherId) {
      return;
    }

    remoteMap.set(item.id, motherId);
  });

  return Object.fromEntries(
    knownQuestions.map((question) => {
      const inheritedMotherId = normalizeMotherId(inheritedMap[question.id]);
      if (inheritedMotherId) {
        return [question.id, inheritedMotherId];
      }

      const remoteMotherId = remoteMap.get(question.id);
      if (remoteMotherId) {
        return [question.id, remoteMotherId];
      }

      const localMotherId = normalizeMotherId(classifyLocally(question));
      return [question.id, localMotherId];
    })
  );
}
