const NUMBERED_CARD = /^\s*(?:\d{1,3}[.)、]|[(（]\d{1,3}[)）])\s*(.+)$/u;
const PROMPT_START = /^(?:describe|talk about|tell me about)\b/i;
const CUE_HEADER = /^(?:you should say|please say|you can say)\s*:?\s*$/i;
const CUE_PREFIX = /^\s*[-*•–—]\s*/u;
const EXPLAIN_PREFIX = /^(?:and\s+)?explain\s+/i;

function createCard(prompt, cues = []) {
  return {
    prompt: String(prompt || '').trim(),
    cues: cues.map((cue) => String(cue).trim()).filter(Boolean),
    tags: [],
    season: '',
  };
}

function stripCardNumber(line) {
  return String(line || '').match(NUMBERED_CARD)?.[1]?.trim() || String(line || '').trim();
}

function isCueLine(line, cueMode) {
  return cueMode || CUE_PREFIX.test(line) || EXPLAIN_PREFIX.test(line);
}

function stripCueSyntax(line) {
  return String(line || '')
    .replace(CUE_PREFIX, '')
    .replace(EXPLAIN_PREFIX, '')
    .trim();
}

export function parseTextImport(text) {
  const cards = [];
  let current = null;
  let cueMode = false;

  const finishCurrent = () => {
    if (current?.prompt) {
      cards.push(createCard(current.prompt, current.cues));
    }
    current = null;
    cueMode = false;
  };

  String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      finishCurrent();
      return;
    }

    if (line.startsWith('#')) {
      return;
    }

    const numbered = line.match(NUMBERED_CARD);
    const content = numbered?.[1]?.trim() || line;
    const startsPrompt = PROMPT_START.test(content);

    if (line.includes('|')) {
      finishCurrent();
      const parts = stripCardNumber(line).split('|').map((part) => part.trim()).filter(Boolean);
      const prompt = parts.shift() || '';
      if (prompt) {
        cards.push(createCard(prompt, parts));
      }
      return;
    }

    if (CUE_HEADER.test(content)) {
      cueMode = Boolean(current);
      return;
    }

    if (!current || startsPrompt) {
      if (current) {
        finishCurrent();
      }
      current = { prompt: content, cues: [] };
      return;
    }

    if (isCueLine(line, cueMode)) {
      const cue = stripCueSyntax(content);
      if (cue) {
        current.cues.push(cue);
      }
      return;
    }

    finishCurrent();
    current = { prompt: stripCardNumber(line), cues: [] };
  });

  finishCurrent();
  return cards;
}
