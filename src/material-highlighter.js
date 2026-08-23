const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for',
  'from', 'had', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'is', 'it',
  'its', 'me', 'my', 'near', 'of', 'on', 'or', 'our', 'she', 'that', 'the',
  'their', 'them', 'there', 'they', 'this', 'to', 'was', 'we', 'were', 'with',
  'would', 'you', 'your',
]);

const MIN_MATCH_TOKENS = 5;

function tokenizeEnglish(text) {
  const tokens = [];
  const matcher = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
  let match = matcher.exec(text || '');

  while (match) {
    tokens.push({
      value: match[0].toLocaleLowerCase('en-US'),
      start: match.index,
      end: match.index + match[0].length,
    });
    match = matcher.exec(text || '');
  }

  return tokens;
}

function hasMeaningfulWord(tokens) {
  return tokens.some((token) => !STOPWORDS.has(token.value));
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function normalizedRanges(ranges, answerLength) {
  const sorted = (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      start: Math.max(0, Math.min(answerLength, Number(range?.start) || 0)),
      end: Math.max(0, Math.min(answerLength, Number(range?.end) || 0)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const selected = [];
  for (const range of sorted) {
    if (!selected.some((existing) => overlaps(existing, range))) {
      selected.push(range);
    }
  }

  return selected.sort((a, b) => a.start - b.start);
}

export function findReusedRanges(materialText, answerText) {
  const materialTokens = tokenizeEnglish(materialText);
  const answerTokens = tokenizeEnglish(answerText);
  const candidates = [];

  for (let answerIndex = 0; answerIndex < answerTokens.length; answerIndex += 1) {
    for (let materialIndex = 0; materialIndex < materialTokens.length; materialIndex += 1) {
      if (answerTokens[answerIndex].value !== materialTokens[materialIndex].value) {
        continue;
      }

      let length = 0;
      while (
        answerTokens[answerIndex + length]
        && materialTokens[materialIndex + length]
        && answerTokens[answerIndex + length].value === materialTokens[materialIndex + length].value
      ) {
        length += 1;
      }

      const answerSlice = answerTokens.slice(answerIndex, answerIndex + length);
      if (length >= MIN_MATCH_TOKENS && hasMeaningfulWord(answerSlice)) {
        candidates.push({
          start: answerSlice[0].start,
          end: answerSlice.at(-1).end,
          tokenLength: length,
        });
      }
    }
  }

  const selected = [];
  for (const candidate of candidates.sort((a, b) => b.tokenLength - a.tokenLength || a.start - b.start)) {
    if (!selected.some((range) => overlaps(range, candidate))) {
      selected.push({ start: candidate.start, end: candidate.end });
    }
  }

  return selected.sort((a, b) => a.start - b.start);
}

export function renderHighlightedAnswer(container, answerText, ranges, sourceLabel = 'mother-core', documentRef = null) {
  if (!container) {
    return;
  }

  const text = String(answerText || '');
  const doc = documentRef || container.ownerDocument || document;
  const title = sourceLabel === 'question' || sourceLabel === 'question-specific'
    ? '来自本题素材'
    : '来自核心素材';
  const children = [];
  let cursor = 0;

  for (const range of normalizedRanges(ranges, text.length)) {
    if (range.start > cursor) {
      children.push(doc.createTextNode(text.slice(cursor, range.start)));
    }

    const mark = doc.createElement('mark');
    mark.className = 'material-reuse';
    mark.title = title;
    mark.appendChild(doc.createTextNode(text.slice(range.start, range.end)));
    children.push(mark);
    cursor = range.end;
  }

  if (cursor < text.length || !children.length) {
    children.push(doc.createTextNode(text.slice(cursor)));
  }

  if (typeof container.replaceChildren === 'function') {
    container.replaceChildren(...children);
    return;
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  children.forEach((child) => container.appendChild(child));
}
