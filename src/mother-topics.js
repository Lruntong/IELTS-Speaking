const TOPICS = [
  {
    id: 'M1',
    label: '人物－长辈',
    legacyId: 'elder-person',
    en: 'Elder Person',
    description: '长辈、老师、前辈',
    keywords: ['elder', 'old person', 'grandparent', 'teacher', 'mentor', 'senior', '长辈', '老师', '前辈'],
  },
  {
    id: 'M2',
    label: '人物－同辈',
    legacyId: 'peer-person',
    en: 'Peer Person',
    description: '朋友、同学、同龄人',
    keywords: ['friend', 'classmate', 'peer', 'colleague', '同学', '朋友', '同龄人'],
  },
  {
    id: 'M3',
    label: '物品－旧物',
    legacyId: 'old-object',
    en: 'Old Object',
    description: '旧物品、礼物、纪念品',
    keywords: ['old object', 'gift', 'kept', 'memory', '纪念品', '礼物', '旧物'],
  },
  {
    id: 'M4',
    label: '物品－虚拟技能',
    legacyId: 'virtual-object',
    en: 'Virtual Object or Skill',
    description: '应用、网站、数字工具、技能',
    keywords: ['app', 'website', 'skill', 'digital', 'online', '应用', '网站', '技能'],
  },
  {
    id: 'M5',
    label: '地点－自然',
    legacyId: 'nature-place',
    en: 'Nature Place',
    description: '户外与自然环境',
    keywords: ['park', 'lake', 'mountain', 'beach', 'natural place', '自然', '户外'],
  },
  {
    id: 'M6',
    label: '地点－室内',
    legacyId: 'indoor-place',
    en: 'Indoor Place',
    description: '室内空间',
    keywords: ['room', 'library', 'cafe', 'indoors', '室内', '房间'],
  },
  {
    id: 'M7',
    label: '经历－成功',
    legacyId: 'success-experience',
    en: 'Success Experience',
    description: '成就、第一次成功',
    keywords: ['success', 'achievement', 'proud', 'won', '成功', '成就'],
  },
  {
    id: 'M8',
    label: '经历－挫折',
    legacyId: 'setback-experience',
    en: 'Setback Experience',
    description: '失败、困难、低谷',
    keywords: ['failure', 'mistake', 'setback', 'difficult', '失败', '困难', '挫折'],
  },
];

function freezeTopic(topic) {
  return Object.freeze({
    ...topic,
    keywords: Object.freeze([...topic.keywords]),
  });
}

export const MOTHER_TOPICS = Object.freeze(TOPICS.map(freezeTopic));

export const LEGACY_TO_MOTHER_ID = Object.freeze(
  Object.fromEntries(MOTHER_TOPICS.map((topic) => [topic.legacyId, topic.id]))
);

const APOSTROPHE_PATTERN = /[\u2018\u2019\u02bc\u2032\u2035\u0060\u00b4\uff07]/gu;
const PUNCTUATION_PATTERN = /[\u2010-\u2015\u2212\u2043\u2053\u3001\u3002\u300c\u300d\u300e\u300f\u3010\u3011\u3014\u3015!"#$%&()*+,./:;<=>?@[\\\]^_{|}~]/gu;

export function getMotherTopic(id) {
  return MOTHER_TOPICS.find((topic) => topic.id === id) || null;
}

export function normalizePrompt(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(APOSTROPHE_PATTERN, "'")
    .replace(PUNCTUATION_PATTERN, ' ')
    .replace(/'+/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+|'+$/g, '')
    .toLowerCase();
}
