import { normalizePrompt } from '../src/mother-topics.js';

const OFFICIAL_SEASON_ID = '2026-05-08';
const CREATED_AT = `${OFFICIAL_SEASON_ID}T00:00:00.000Z`;

function officialQuestion(id, prompt, cues, motherId) {
  return {
    id,
    prompt,
    cues,
    tags: [],
    seasonId: OFFICIAL_SEASON_ID,
    motherId,
    source: 'official',
    normalizedPrompt: normalizePrompt(prompt),
    createdAt: CREATED_AT,
  };
}

export const OFFICIAL_QUESTION_BANK = Object.freeze([
  officialQuestion(
    'official-2026-05-08-m1',
    'Describe an old person you enjoy talking to.',
    ['who he/she is', 'what you talk about', 'why you enjoy talking to him/her'],
    'M1'
  ),
  officialQuestion(
    'official-2026-05-08-m2',
    'Describe a friend who helped you in a difficult time.',
    ['who the friend is', 'what happened', 'how he/she helped you'],
    'M2'
  ),
  officialQuestion(
    'official-2026-05-08-m3',
    'Describe an object you have kept for a long time.',
    ['what it is', 'how you got it', 'why you keep it'],
    'M3'
  ),
  officialQuestion(
    'official-2026-05-08-m4',
    'Describe an app or a website that you use often.',
    ['what it is', 'how you use it', 'why you like it'],
    'M4'
  ),
  officialQuestion(
    'official-2026-05-08-m5',
    'Describe a natural place you would like to visit again.',
    ['where it is', 'what you did there', 'why you want to go back'],
    'M5'
  ),
  officialQuestion(
    'official-2026-05-08-m6',
    'Describe a room or a place indoors where you like to spend time.',
    ['where it is', 'what you do there', 'why you like it'],
    'M6'
  ),
  officialQuestion(
    'official-2026-05-08-m7',
    'Describe a time you achieved something you were proud of.',
    ['what you achieved', 'how you did it', 'how you felt'],
    'M7'
  ),
  officialQuestion(
    'official-2026-05-08-m8',
    'Describe a time you failed at something and what you learned from it.',
    ['what it was', 'why it happened', 'what you learned'],
    'M8'
  ),
]);
