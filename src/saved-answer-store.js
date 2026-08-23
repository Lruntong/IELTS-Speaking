function normalizeSavedAnswers(state) {
  return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
}

function normalizeTimestamp(value, fallback = null) {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function materialTimestamp(material) {
  return normalizeTimestamp(material?.updatedAt ?? material?.createdAt, null);
}

export function getSavedAnswer(state, questionId) {
  const id = String(questionId ?? '').trim();
  if (!id) {
    return null;
  }

  return normalizeSavedAnswers(state)[id] || null;
}

export function saveAnswer(state, answer) {
  const questionId = String(answer?.questionId ?? '').trim();
  if (!questionId) {
    return normalizeSavedAnswers(state);
  }

  const updatedAt = normalizeTimestamp(answer?.updatedAt, new Date().toISOString());
  return {
    ...normalizeSavedAnswers(state),
    [questionId]: {
      ...answer,
      questionId,
      updatedAt,
    },
  };
}

export function isMaterialNewer(answer, material) {
  const answerMaterialAt = normalizeTimestamp(answer?.materialUpdatedAt, null);
  const currentMaterialAt = materialTimestamp(material);
  if (!answerMaterialAt || !currentMaterialAt) {
    return false;
  }

  return new Date(currentMaterialAt).getTime() > new Date(answerMaterialAt).getTime();
}
