import { LEGACY_TO_MOTHER_ID, normalizePrompt } from './mother-topics.js';

const DEFAULT_SCHEMA_VERSION = 2;
const FALLBACK_CREATED_AT = '1970-01-01T00:00:00.000Z';

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function createSeasonLabel(seasonId) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(seasonId);
  if (!match) {
    return seasonId || '未命名季度';
  }

  const year = match[1];
  const startMonth = Number(match[2]);
  const endMonth = Math.min(startMonth + 3, 12);
  return `${year} 年 ${startMonth}–${endMonth} 月`;
}

function defaultSeasonStatus(seasonId, activeSeasonId) {
  if (seasonId === activeSeasonId) {
    return 'current';
  }

  if (!activeSeasonId) {
    return 'archived';
  }

  return seasonId > activeSeasonId ? 'upcoming' : 'archived';
}

function ensureSeason(seasons, seasonId, activeSeasonId) {
  if (!seasonId) {
    return seasons;
  }

  if (seasons.some((season) => season.id === seasonId)) {
    return seasons.map((season) =>
      season.id === seasonId
        ? {
            ...season,
            label: season.label || createSeasonLabel(seasonId),
            status: season.status || defaultSeasonStatus(seasonId, activeSeasonId),
            createdAt: normalizeCreatedAt(season.createdAt, `${seasonId}T00:00:00.000Z`),
          }
        : season
    );
  }

  return [
    ...seasons,
    {
      id: seasonId,
      label: createSeasonLabel(seasonId),
      status: defaultSeasonStatus(seasonId, activeSeasonId),
      createdAt: `${seasonId}T00:00:00.000Z`,
    },
  ];
}

function normalizeCreatedAt(value, fallback = FALLBACK_CREATED_AT) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return fallback;
}

function sanitizeQuestion(question, defaults = {}) {
  const baseQuestion = question && typeof question === 'object' ? cloneValue(question) : {};
  const prompt = String(baseQuestion.prompt ?? defaults.prompt ?? '').trim();
  const seasonValue = baseQuestion.seasonId ?? baseQuestion.season ?? defaults.seasonId ?? defaults.season;
  const seasonId = String(seasonValue ?? '').trim();
  const normalizedPrompt = normalizePrompt(baseQuestion.normalizedPrompt ?? prompt);
  const createdAtFallback = seasonId ? `${seasonId}T00:00:00.000Z` : FALLBACK_CREATED_AT;

  return {
    ...baseQuestion,
    ...defaults,
    id: String(baseQuestion.id ?? defaults.id ?? ''),
    prompt,
    cues: Array.isArray(baseQuestion.cues ?? defaults.cues)
      ? (baseQuestion.cues ?? defaults.cues).map((cue) => String(cue).trim()).filter(Boolean)
      : [],
    tags: Array.isArray(baseQuestion.tags ?? defaults.tags)
      ? (baseQuestion.tags ?? defaults.tags).map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    seasonId,
    motherId: baseQuestion.motherId ?? defaults.motherId ?? null,
    source: String(baseQuestion.source ?? defaults.source ?? 'user'),
    normalizedPrompt,
    createdAt: normalizeCreatedAt(
      baseQuestion.createdAt ?? defaults.createdAt,
      createdAtFallback
    ),
  };
}

function sortQuestionsByCreatedAt(questions) {
  return [...questions].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return String(left.id).localeCompare(String(right.id));
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function defaultQuestionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `question-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeQuestions(questions, defaults = {}) {
  return Array.isArray(questions)
    ? questions
        .map((question) => sanitizeQuestion(question, defaults))
        .filter((question) => question.id && question.prompt)
    : [];
}

function cloneState(state) {
  const base = state && typeof state === 'object' ? state : {};

  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    seasons: Array.isArray(base.seasons) ? base.seasons.map((season) => cloneValue(season)) : [],
    activeSeasonId: base.activeSeasonId ?? null,
    userQuestions: sanitizeQuestions(base.userQuestions),
    classificationOverrides:
      base.classificationOverrides && typeof base.classificationOverrides === 'object'
        ? cloneValue(base.classificationOverrides)
        : {},
    savedAnswers:
      base.savedAnswers && typeof base.savedAnswers === 'object' ? cloneValue(base.savedAnswers) : {},
    ...(Array.isArray(base.questions) ? { questions: sanitizeQuestions(base.questions) } : {}),
    ...(hasOwn(base, 'legacy') ? { legacy: cloneValue(base.legacy) } : {}),
  };
}

function getMergedQuestions(state) {
  if (Array.isArray(state.questions)) {
    return sanitizeQuestions(state.questions);
  }

  return sanitizeQuestions(state.userQuestions);
}

export function createEmptyBankState() {
  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    seasons: [],
    activeSeasonId: null,
    userQuestions: [],
    classificationOverrides: {},
    savedAnswers: {},
  };
}

export function migrateLegacyBank(raw) {
  const original = raw && typeof raw === 'object' ? cloneValue(raw) : null;
  const emptyState = createEmptyBankState();

  if (!raw || typeof raw !== 'object') {
    return {
      ...emptyState,
      legacy: original,
    };
  }

  const legacyAssignments =
    raw.assignments && typeof raw.assignments === 'object' ? raw.assignments : {};
  const legacyQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  const userQuestions = legacyQuestions
    .map((question) =>
      sanitizeQuestion(question, {
        seasonId: question?.season || 'legacy',
        motherId: LEGACY_TO_MOTHER_ID[legacyAssignments[question?.id]] ?? null,
        source: 'user',
        createdAt: normalizeCreatedAt(
          question?.createdAt ?? question?.importedAt,
          question?.season ? `${question.season}T00:00:00.000Z` : FALLBACK_CREATED_AT
        ),
      })
    )
    .filter((question) => question.id && question.prompt);

  const activeSeasonId = userQuestions.at(-1)?.seasonId ?? null;
  const seasons = userQuestions.reduce(
    (allSeasons, question) => ensureSeason(allSeasons, question.seasonId, activeSeasonId),
    []
  );

  return {
    ...emptyState,
    seasons,
    activeSeasonId,
    userQuestions,
    legacy: original,
  };
}

export function mergeOfficialQuestions(state, officialQuestions) {
  const nextState = cloneState(state);
  const official = sanitizeQuestions(officialQuestions, { source: 'official' });
  const mergedQuestions = [
    ...official.map((question) => ({
      ...question,
      motherId: hasOwn(nextState.classificationOverrides, question.id)
        ? nextState.classificationOverrides[question.id]
        : question.motherId,
    })),
    ...nextState.userQuestions,
  ];
  const allSeasons = [...nextState.seasons];

  official.forEach((question) => {
    const refreshedSeasons = ensureSeason(
      allSeasons,
      question.seasonId,
      nextState.activeSeasonId ?? question.seasonId
    );
    allSeasons.splice(0, allSeasons.length, ...refreshedSeasons);
  });

  return {
    ...nextState,
    seasons: allSeasons,
    questions: sortQuestionsByCreatedAt(mergedQuestions),
  };
}

export function importSeasonQuestions(state, items, seasonId, createId = defaultQuestionId) {
  const nextState = cloneState(state);
  const targetSeasonId = String(seasonId ?? '').trim();
  const existingQuestions = getMergedQuestions(nextState);
  const importedQuestions = [];
  const normalizedBySeason = new Set(
    existingQuestions.map((question) => `${question.seasonId}::${question.normalizedPrompt}`)
  );

  (Array.isArray(items) ? items : []).forEach((item) => {
    const prompt = String(item?.prompt ?? '').trim();
    const normalized = normalizePrompt(prompt);

    if (!prompt || !normalized) {
      return;
    }

    const duplicateKey = `${targetSeasonId}::${normalized}`;
    if (normalizedBySeason.has(duplicateKey)) {
      return;
    }

    normalizedBySeason.add(duplicateKey);
    const matchingHistory = sortQuestionsByCreatedAt(existingQuestions).filter(
      (question) => question.normalizedPrompt === normalized
    );
    const inheritedMotherId = matchingHistory.at(-1)?.motherId ?? null;

    importedQuestions.push(
      sanitizeQuestion(item, {
        id: createId(),
        seasonId: targetSeasonId,
        motherId: inheritedMotherId,
        source: 'user',
      })
    );
  });

  return {
    ...nextState,
    activeSeasonId: targetSeasonId || nextState.activeSeasonId,
    seasons: ensureSeason(
      nextState.seasons,
      targetSeasonId,
      targetSeasonId || nextState.activeSeasonId
    ),
    userQuestions: [...nextState.userQuestions, ...importedQuestions],
    ...(Array.isArray(nextState.questions)
      ? { questions: [...nextState.questions, ...importedQuestions] }
      : {}),
  };
}

export function serializeBankState(state) {
  const nextState = cloneState(state);

  return cloneValue({
    ...nextState,
    ...(Array.isArray(nextState.questions)
      ? { questions: sanitizeQuestions(nextState.questions) }
      : {}),
  });
}
