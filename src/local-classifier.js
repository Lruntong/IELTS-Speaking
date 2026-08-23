import { MOTHER_TOPICS, getMotherTopic, normalizePrompt } from './mother-topics.js';

const PHRASE_SCORE = 6;
const TOKEN_SCORE = 2;
const TIE_BREAKER_WEIGHT = 0.2;
const MIN_SIMILARITY_LENGTH = 4;
const TIE_EPSILON = 1e-9;

const EXTRA_CUES = Object.freeze({
  M1: ['elderly person', 'older person', 'old person', 'grandparent', 'grandfather', 'grandmother'],
  M2: ['close friend', 'best friend', 'helpful friend', 'school friend'],
  M3: ['kept for a long time', 'kept for years', 'souvenir', 'memorabilia'],
  M4: ['use every day', 'use daily', 'mobile app', 'website', 'digital tool'],
  M5: ['beautiful lake', 'scenic lake', 'natural place', 'outdoor place'],
  M6: ['relaxing room', 'indoor place', 'place indoors', 'room where you relax'],
  M7: ['achievement', 'achieved', 'proud of', 'success story'],
  M8: ['failed', 'failure', 'difficult experience', 'setback', 'mistake'],
});

const TOPIC_CUES = Object.freeze(
  Object.fromEntries(
    MOTHER_TOPICS.map((topic) => [
      topic.id,
      buildCueSet(topic.id, [...topic.keywords, ...(EXTRA_CUES[topic.id] || [])]),
    ])
  )
);

function buildCueSet(topicId, cues) {
  const topic = getMotherTopic(topicId);
  const additions = topic?.label ? [topic.label, topic.en, topic.description] : [];
  return [...new Set([...cues, ...additions].map(normalizePrompt).filter(Boolean))];
}

function tokenize(value) {
  return normalizePrompt(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

function levenshtein(left, right) {
  if (left === right) {
    return 0;
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function normalizedSimilarity(left, right) {
  if (!left || !right) {
    return 0;
  }

  const longest = Math.max(left.length, right.length);
  if (!longest) {
    return 0;
  }

  return 1 - levenshtein(left, right) / longest;
}

function scoreTopic(promptText, promptTokens, topicId) {
  const cues = TOPIC_CUES[topicId] || [];
  let baseScore = 0;
  let bestSimilarity = 0;

  cues.forEach((cue) => {
    const cueTokens = cue.split(' ').filter(Boolean);
    if (cueTokens.length > 1 && promptText.includes(cue)) {
      baseScore += PHRASE_SCORE + cueTokens.length - 1;
    }

    cueTokens.forEach((cueToken) => {
      if (promptTokens.includes(cueToken)) {
        baseScore += TOKEN_SCORE;
      }

      if (
        cueToken.length >= MIN_SIMILARITY_LENGTH &&
        !promptTokens.includes(cueToken)
      ) {
        promptTokens.forEach((promptToken) => {
          if (promptToken.length < MIN_SIMILARITY_LENGTH) {
            return;
          }

          bestSimilarity = Math.max(bestSimilarity, normalizedSimilarity(promptToken, cueToken));
        });
      }
    });
  });

  return {
    baseScore,
    totalScore: baseScore + bestSimilarity * TIE_BREAKER_WEIGHT,
  };
}

export function classifyQuestionLocally(question) {
  const promptText = normalizePrompt(question?.prompt ?? '');
  if (!promptText) {
    return null;
  }

  const promptTokens = tokenize(promptText);
  const ranked = MOTHER_TOPICS.map((topic) => ({
    topicId: topic.id,
    ...scoreTopic(promptText, promptTokens, topic.id),
  })).sort((left, right) => right.totalScore - left.totalScore);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.baseScore === 0) {
    return null;
  }

  if (second && Math.abs(best.totalScore - second.totalScore) <= TIE_EPSILON) {
    return null;
  }

  return getMotherTopic(best.topicId)?.id ?? null;
}
