import { OFFICIAL_QUESTION_BANK } from './data/question-bank.js';
import { classifyQuestionLocally } from './src/local-classifier.js';
import { MOTHER_TOPICS, getMotherTopic } from './src/mother-topics.js';
import {
    createEmptyBankState,
    importSeasonQuestions,
    mergeOfficialQuestions,
    migrateLegacyBank,
    serializeBankState
} from './src/question-bank-store.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const generateBtn = $('#generateBtn');
const topicInput = $('#topic');
const categoryButtons = $$('.category-btn');
const keywordsLabel = $('#keywordsLabel');
const structuredKeywords = $('#structuredKeywords');
const materialSelect = $('#materialSelect');
const selectedMaterialInfo = $('#selectedMaterialInfo');
const materialCount = $('#materialCount');
const resultSection = $('#resultSection');
const resultText = $('#resultText');
const answerEmpty = $('#answerEmpty');
const loading = $('#loading');
const readAloudBtn = $('#readAloudBtn');
const readSentenceBtn = $('#readSentenceBtn');
const readingStatus = $('#readingStatus');
const voiceOptions = $$('.voice-option');
const copyBtn = $('#copyBtn');
const recordingSection = $('#recordingSection');
const recordBtn = $('#recordBtn');
const recordingStatus = $('#recordingStatus');
const countdownDisplay = $('#countdownDisplay');
const audioPlayback = $('#audioPlayback');
const transcriptEditor = $('#transcriptEditor');
const transcriptHint = $('#transcriptHint');
const confirmTranscriptBtn = $('#confirmTranscriptBtn');
const reviewBtn = $('#reviewBtn');
const reviewLoading = $('#reviewLoading');
const reviewPanel = $('#reviewPanel');
const reviewText = $('#reviewText');
const materialList = $('#materialList');
const materialSearch = $('#materialSearch');
const materialEditor = $('#materialEditor');
const materialTitle = $('#materialTitle');
const materialTags = $('#materialTags');
const materialStory = $('#materialStory');
const saveMaterialBtn = $('#saveMaterialBtn');
const newMaterialBtn = $('#newMaterialBtn');
const closeMaterialEditorBtn = $('#closeMaterialEditorBtn');
const cancelMaterialBtn = $('#cancelMaterialBtn');
const librarySummary = $('#librarySummary');

const MATERIAL_STORAGE_KEY = 'ielts-personal-materials-v2';
const categoryConfig = {
    person: { label: '补充这个人的细节', fields: [['identity', '关系/身份', '例如：大学同学、英语老师'], ['personality', '性格', '例如：乐观、耐心、幽默'], ['story', '难忘的事', '例如：他帮我度过低谷']] },
    object: { label: '补充这个物品的细节', fields: [['appearance', '外观', '例如：旧相机、银色机身'], ['function', '用途', '例如：记录旅行'], ['meaning', '对你的意义', '例如：爷爷送给我的礼物']] },
    place: { label: '补充这个地点的细节', fields: [['location', '在哪里', '例如：城市郊外的湖边'], ['environment', '环境', '例如：安静，有很多树'], ['feeling', '你的感受', '例如：让我放松下来']] },
    experience: { label: '补充本次经历的细节', fields: [['time', '什么时候', '例如：去年夏天'], ['participants', '和谁', '例如：和我爷爷'], ['turningPoint', '转折/细节', '例如：突然下起小雨'], ['feeling', '最后感受', '例如：比预想更难忘']] }
};

let currentCategory = 'person';
let keywordsByCategory = {};
let materials = [];
let selectedMaterialId = '';
let editingMaterialId = '';
let latestAnswer = '';
let timerSeconds = 120;
let timerId = null;
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recognition = null;
let finalTranscript = '';
let interimTranscript = '';
let confirmedTranscript = '';
let audioUrl = '';
let selectedAccent = localStorage.getItem('ielts-reading-accent') || 'en-GB';
let selectedRate = Number(localStorage.getItem('ielts-reading-rate') || '0.9');
let sentenceIndex = 0;

Object.entries(categoryConfig).forEach(([category, config]) => {
    keywordsByCategory[category] = Object.fromEntries(config.fields.map(([key]) => [key, '']));
});

function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTime(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function persistMaterials() {
    localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(materials));
}

function loadMaterials() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MATERIAL_STORAGE_KEY) || '[]');
        materials = Array.isArray(parsed) ? parsed.filter((material) => material?.id && material?.title && material?.story) : [];
    } catch {
        materials = [];
    }
}

function selectedMaterial() {
    return materials.find((material) => material.id === selectedMaterialId) || null;
}

function renderMaterialSelect() {
    const current = selectedMaterial();
    materialSelect.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '暂不使用素材库';
    materialSelect.appendChild(empty);
    materials.forEach((material) => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = material.title;
        materialSelect.appendChild(option);
    });
    materialSelect.value = current?.id || '';
    selectedMaterialInfo.textContent = current
        ? `正在使用「${current.title}」${current.tags?.length ? ` · ${current.tags.join(' · ')}` : ''}`
        : materials.length ? '从素材库选择故事，答案会优先使用真实细节。' : '还没有素材？去“我的素材库”保存第一段真实经历。';
    materialCount.textContent = materials.length;
}

function renderMaterialList() {
    const query = materialSearch.value.trim().toLocaleLowerCase();
    const filtered = materials.filter((material) => [material.title, material.story, ...(material.tags || [])].join(' ').toLocaleLowerCase().includes(query));
    materialList.innerHTML = '';
    librarySummary.textContent = `${materials.length} 条真实素材${query ? ` · 找到 ${filtered.length} 条` : ''}`;

    if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'material-empty';
        empty.textContent = materials.length ? '没有找到匹配的素材。' : '从一个你亲身经历过的故事开始。它可以在很多题目中反复复用。';
        materialList.appendChild(empty);
        return;
    }

    filtered.forEach((material) => {
        const card = document.createElement('article');
        card.className = `material-card${material.id === selectedMaterialId ? ' active' : ''}`;
        const title = document.createElement('h3');
        title.textContent = material.title;
        const story = document.createElement('p');
        story.className = 'material-story-preview';
        story.textContent = material.story;
        const tags = document.createElement('p');
        tags.className = 'material-tags';
        tags.textContent = (material.tags || []).map((tag) => `#${tag}`).join(' ') || '未分类';
        const actions = document.createElement('div');
        actions.className = 'material-card-actions';
        const use = document.createElement('button');
        use.type = 'button'; use.className = 'material-use-btn'; use.textContent = material.id === selectedMaterialId ? '正在用于练习' : '用这条练习';
        use.addEventListener('click', () => { selectedMaterialId = material.id; renderMaterials(); switchView('practiceView'); });
        const edit = document.createElement('button');
        edit.type = 'button'; edit.textContent = '编辑';
        edit.addEventListener('click', () => openEditor(material));
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'material-delete-btn'; remove.textContent = '删除';
        remove.addEventListener('click', () => {
            if (!window.confirm(`确定删除「${material.title}」吗？`)) return;
            materials = materials.filter((item) => item.id !== material.id);
            if (selectedMaterialId === material.id) selectedMaterialId = '';
            persistMaterials(); renderMaterials();
        });
        actions.append(use, edit, remove);
        card.append(title, story, tags, actions);
        materialList.appendChild(card);
    });
}

function renderMaterials() {
    renderMaterialSelect();
    renderMaterialList();
}

function resetEditor() {
    editingMaterialId = '';
    materialTitle.value = ''; materialTags.value = ''; materialStory.value = '';
    $('#editorTitle').textContent = '新建一条素材';
    saveMaterialBtn.innerHTML = '保存素材 <span>→</span>';
}

function openEditor(material = null) {
    materialEditor.classList.remove('hidden');
    if (material) {
        editingMaterialId = material.id;
        materialTitle.value = material.title;
        materialTags.value = (material.tags || []).join('，');
        materialStory.value = material.story;
        $('#editorTitle').textContent = '编辑这条素材';
        saveMaterialBtn.innerHTML = '保存修改 <span>→</span>';
    } else {
        resetEditor();
    }
    materialEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() { materialEditor.classList.add('hidden'); resetEditor(); }

function saveMaterial() {
    const title = materialTitle.value.trim();
    const story = materialStory.value.trim();
    const tags = [...new Set(materialTags.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
    if (!title || !story) { alert('请填写素材名称和真实细节。'); return; }
    if (editingMaterialId) {
        materials = materials.map((material) => material.id === editingMaterialId ? { ...material, title, story, tags, updatedAt: new Date().toISOString() } : material);
    } else {
        const id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        materials.unshift({ id, title, story, tags, createdAt: new Date().toISOString() });
        selectedMaterialId = id;
    }
    persistMaterials(); renderMaterials(); closeEditor();
}

function applyCategory(category) {
    const config = categoryConfig[category];
    currentCategory = category;
    keywordsLabel.firstChild.textContent = config.label;
    structuredKeywords.innerHTML = '';
    config.fields.forEach(([key, label, placeholder]) => {
        const field = document.createElement('div'); field.className = 'structured-field';
        const fieldLabel = document.createElement('label'); fieldLabel.className = 'structured-label'; fieldLabel.textContent = label;
        const input = document.createElement('input'); input.className = 'structured-input'; input.type = 'text'; input.placeholder = placeholder; input.value = keywordsByCategory[category][key] || '';
        input.addEventListener('input', () => { keywordsByCategory[category][key] = input.value; });
        field.append(fieldLabel, input); structuredKeywords.appendChild(field);
    });
    categoryButtons.forEach((button) => button.classList.toggle('active', button.dataset.category === category));
}

function switchView(viewId) {
    $$('.view-section').forEach((view) => view.classList.toggle('hidden', view.id !== viewId));
    $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === viewId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function getErrorMessage(response) {
    try { return (await response.json()).error || `服务器返回 ${response.status}`; } catch { return `服务器返回 ${response.status}`; }
}

async function readSseStream(response, onContent) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('浏览器不支持流式响应。');
    const decoder = new TextDecoder(); let buffer = '';
    const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') return;
        try { onContent(JSON.parse(trimmed.slice(5).trim()).choices?.[0]?.delta?.content || ''); } catch (error) { console.error('流式响应解析失败：', error); }
    };
    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''; lines.forEach(processLine);
        if (done) break;
    }
    if (buffer.trim()) processLine(buffer);
}

function keywordText() {
    return categoryConfig[currentCategory].fields.map(([key, label]) => keywordsByCategory[currentCategory][key]?.trim() ? `${label}: ${keywordsByCategory[currentCategory][key].trim()}` : '').filter(Boolean).join('; ');
}

async function generateAnswer() {
    const topic = topicInput.value.trim();
    if (!topic) { alert('请先填写一道雅思 Part 2 题目。'); topicInput.focus(); return; }
    generateBtn.disabled = true; loading.classList.remove('hidden'); latestAnswer = ''; resultText.innerHTML = ''; resultSection.classList.remove('hidden'); answerEmpty.classList.add('hidden');
    try {
        const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'model-answer', topic, category: currentCategory, keywords: keywordText(), structuredKeywords: keywordsByCategory[currentCategory], personalMaterial: selectedMaterial() }) });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        await readSseStream(response, (content) => { latestAnswer += content; resultText.innerHTML = escapeHtml(latestAnswer).replace(/\n/g, '<br>'); });
        if (!latestAnswer.trim()) throw new Error('没有生成答案，请重试。');
        sentenceIndex = 0;
        updateReadingControls();
        recordingSection.classList.remove('hidden');
    } catch (error) {
        resultSection.classList.add('hidden'); answerEmpty.classList.remove('hidden'); alert(`生成失败：${error.message}`);
    } finally { generateBtn.disabled = false; loading.classList.add('hidden'); }
}

function resetTimer() { clearInterval(timerId); timerId = null; timerSeconds = 120; countdownDisplay.textContent = formatTime(timerSeconds); }
function startTimer() {
    clearInterval(timerId); timerSeconds = 120; countdownDisplay.textContent = formatTime(timerSeconds);
    timerId = window.setInterval(() => {
        timerSeconds -= 1; countdownDisplay.textContent = formatTime(Math.max(timerSeconds, 0));
        if (timerSeconds <= 0) { recordingStatus.textContent = '两分钟到了，正在结束录音。'; stopRecording(); }
    }, 1000);
}
function updateTranscript() {
    const transcript = `${finalTranscript}${interimTranscript ? ` ${interimTranscript}` : ''}`.trim();
    transcriptEditor.value = transcript;
    const isRecording = mediaRecorder?.state === 'recording';
    confirmTranscriptBtn.disabled = isRecording || !transcript;
    reviewBtn.disabled = true;
    confirmedTranscript = '';
    transcriptHint.textContent = isRecording
        ? '这是浏览器的原始识别结果，录音结束后请核对、修改并确认。'
        : transcript ? '请核对姓名、专有名词和关键表达；只有确认后的文字会用于复盘。' : '没有识别到英文内容。你可以回放录音后重新录制。';
}
function setupSpeechRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { recordingStatus.textContent = '当前浏览器不支持实时转写；录音仍可保存回放。建议使用 Chrome。'; return; }
    recognition = new Recognition(); recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onresult = (event) => {
        interimTranscript = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const text = event.results[index][0].transcript;
            if (event.results[index].isFinal) finalTranscript += `${text} `; else interimTranscript += text;
        }
        updateTranscript();
    };
    recognition.onerror = (event) => { if (event.error !== 'aborted') recordingStatus.textContent = '转写暂时中断了，但录音仍会继续保存。'; };
    recognition.onend = () => { if (mediaRecorder?.state === 'recording') { try { recognition.start(); } catch {} } };
    try { recognition.start(); } catch {}
}
async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { alert('当前浏览器不支持录音。请使用最新版 Chrome 并允许麦克风权限。'); return; }
    try {
        if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = ''; audioPlayback.classList.add('hidden');
        finalTranscript = ''; interimTranscript = ''; confirmedTranscript = '';
        transcriptEditor.value = ''; transcriptEditor.disabled = true;
        transcriptHint.textContent = '正在识别英文内容；结束后请先检查转写。';
        confirmTranscriptBtn.disabled = true; reviewPanel.classList.add('hidden'); reviewBtn.disabled = true;
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); audioChunks = [];
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.push(event.data); };
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            audioUrl = URL.createObjectURL(audioBlob); audioPlayback.src = audioUrl; audioPlayback.classList.remove('hidden');
        };
        mediaRecorder.start(); setupSpeechRecognition(); startTimer();
        recordBtn.classList.add('recording'); recordBtn.innerHTML = '<span class="record-indicator"></span>结束录音'; recordingStatus.textContent = '正在录音。专注表达，不需要逐字背诵。';
    } catch (error) { console.error(error); alert('无法开启麦克风。请检查浏览器的麦克风权限。'); }
}
function stopRecording() {
    clearInterval(timerId); timerId = null;
    if (recognition) { recognition.onend = null; try { recognition.stop(); } catch {} recognition = null; }
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    mediaStream?.getTracks().forEach((track) => track.stop()); mediaStream = null;
    transcriptEditor.disabled = false;
    recordBtn.classList.remove('recording'); recordBtn.innerHTML = '<span class="record-indicator"></span>重新开始录音'; recordingStatus.textContent = finalTranscript.trim() ? '录音已保存。请先检查转写，再生成复盘。' : '录音已保存，但没有识别到英文转写。你仍可以回放后再试一次。'; updateTranscript();
}

function confirmTranscript() {
    const transcript = transcriptEditor.value.trim();
    if (!transcript) { alert('请先填写或修正英文转写。'); return; }
    confirmedTranscript = transcript;
    transcriptHint.textContent = '已确认：本次复盘只会使用这份已确认的转写文本。';
    confirmTranscriptBtn.textContent = '已确认，可再次修改';
    reviewBtn.disabled = false;
}

function invalidateConfirmedTranscript() {
    if (!transcriptEditor.value.trim()) confirmTranscriptBtn.disabled = true;
    else confirmTranscriptBtn.disabled = false;
    if (!confirmedTranscript) return;
    confirmedTranscript = '';
    confirmTranscriptBtn.textContent = '确认转写';
    reviewBtn.disabled = true;
    transcriptHint.textContent = '转写已修改，请再次确认后再生成复盘。';
}

async function reviewSpeaking() {
    const transcript = confirmedTranscript.trim();
    if (!transcript) return;
    reviewBtn.disabled = true; reviewLoading.classList.remove('hidden'); reviewPanel.classList.add('hidden'); reviewText.textContent = '';
    try {
        const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'speaking-review', topic: topicInput.value.trim(), transcript, referenceAnswer: latestAnswer }) });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        let review = ''; await readSseStream(response, (content) => { review += content; reviewText.textContent = review; });
        if (!review.trim()) throw new Error('没有生成复盘。'); reviewPanel.classList.remove('hidden');
    } catch (error) { alert(`复盘失败：${error.message}`); } finally { reviewBtn.disabled = !confirmedTranscript.trim(); reviewLoading.classList.add('hidden'); }
}

function updateReadingControls() {
    voiceOptions.forEach((option) => {
        const selected = option.dataset.accent ? option.dataset.accent === selectedAccent : Number(option.dataset.rate) === selectedRate;
        option.classList.toggle('active', selected);
    });
    readingStatus.textContent = `当前设置：${selectedAccent === 'en-GB' ? '英音' : '美音'} · ${selectedRate < 0.85 ? '慢速' : '自然语速'}。`;
}

function availableVoice() {
    const voices = speechSynthesis.getVoices();
    const exactVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(selectedAccent.toLowerCase()));
    const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (!exactVoice) readingStatus.textContent = `当前设备没有可用的${selectedAccent === 'en-GB' ? '英音' : '美音'}声音，已使用可用英语声音。`;
    return exactVoice || englishVoice || null;
}

function stopReading() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    readAloudBtn.textContent = '全文领读';
}

function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持领读。'); return; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedAccent;
    utterance.rate = selectedRate;
    const voice = availableVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => { readAloudBtn.textContent = '全文领读'; onEnd?.(); };
    speechSynthesis.speak(utterance);
}

function readAloud() {
    if (!latestAnswer) return;
    if (speechSynthesis.speaking) { stopReading(); return; }
    readAloudBtn.textContent = '停止领读';
    readingStatus.textContent = '正在全文领读。你可以跟读，也可以切换到逐句领读。';
    speak(latestAnswer, () => { updateReadingControls(); });
}

function splitSentences(text) {
    return text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
}

function readNextSentence() {
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持领读。'); return; }
    const sentences = splitSentences(latestAnswer);
    if (!sentences.length) return;
    if (speechSynthesis.speaking) stopReading();
    const current = sentenceIndex % sentences.length;
    sentenceIndex = (current + 1) % sentences.length;
    readingStatus.textContent = `正在领读第 ${current + 1} / ${sentences.length} 句。点击“逐句领读”继续下一句。`;
    speak(sentences[current], () => {});
}

/* ================= 题库 · 按季预览 + 确认式分类 ================= */
const TOPIC_TO_CATEGORY = Object.freeze({
    'elder-person': 'person',
    'peer-person': 'person',
    'old-object': 'object',
    'virtual-object': 'object',
    'nature-place': 'place',
    'indoor-place': 'place',
    'success-experience': 'experience',
    'setback-experience': 'experience'
});
const BANK_STORAGE_KEY = 'ielts-question-bank-v1';
const localClassificationCache = new Map();

let questionBankState = createEmptyBankState();
let classificationDraft = null;
let initialClassificationDraft = null;
let selectedClassificationTopicId = MOTHER_TOPICS[0]?.id || 'M1';
let classificationDrag = null;

const bankSeason = $('#bankSeason');
const bankText = $('#bankText');
const bankFile = $('#bankFile');
const importStatus = $('#importStatus');
const bankSummary = $('#bankSummary');
const bankCount = $('#bankCount');
const recommendStatus = $('#recommendStatus');
const seasonSelect = $('#seasonSelect');
const openImportModalBtn = $('#openImportModalBtn');
const slotGrid = $('#slotGrid');
const poolCell = $('#poolCell');
const poolList = $('#poolList');
const poolCount = $('#poolCount');
const classificationDialog = $('#classificationDialog');
const closeClassificationDialogBtn = $('#closeClassificationDialogBtn');
const cancelClassificationBtn = $('#cancelClassificationBtn');
const confirmClassificationBtn = $('#confirmClassificationBtn');
const dialogImportStep = $('#dialogImportStep');
const dialogPreviewStep = $('#dialogPreviewStep');
const topicNav = $('#topicNav');
const selectedTopicTitle = $('#selectedTopicTitle');
const selectedTopicDesc = $('#selectedTopicDesc');
const dialogDraftStatus = $('#dialogDraftStatus');
const topicQuestionList = $('#topicQuestionList');
const dialogPoolList = $('#dialogPoolList');
const dialogPoolCount = $('#dialogPoolCount');

function makeQuestionId() {
    return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function topicSortValue(topicId) {
    return MOTHER_TOPICS.findIndex((topic) => topic.id === topicId);
}

function sortSeasons(seasons) {
    return [...seasons].sort((left, right) => String(right.id).localeCompare(String(left.id)));
}

function getLocalClassification(question) {
    if (!question?.id) {
        return classifyQuestionLocally(question);
    }

    if (!localClassificationCache.has(question.id)) {
        localClassificationCache.set(question.id, classifyQuestionLocally(question));
    }

    return localClassificationCache.get(question.id) || null;
}

function persistBank() {
    const serialized = serializeBankState(questionBankState);
    delete serialized.questions;
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(serialized));
}

function normalizeLoadedBank(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return createEmptyBankState();
    }

    if (parsed.schemaVersion === 2 || Array.isArray(parsed.userQuestions)) {
        const serialized = serializeBankState(parsed);
        delete serialized.questions;
        return {
            ...createEmptyBankState(),
            ...serialized
        };
    }

    return migrateLegacyBank(parsed);
}

function currentBankView() {
    return mergeOfficialQuestions(questionBankState, OFFICIAL_QUESTION_BANK);
}

function syncActiveSeason(shouldPersist = true) {
    const viewState = currentBankView();
    const seasons = sortSeasons(viewState.seasons);
    const available = seasons.map((season) => season.id);
    const nextSeasonId = available.includes(questionBankState.activeSeasonId)
        ? questionBankState.activeSeasonId
        : (available[0] || null);

    if (questionBankState.activeSeasonId !== nextSeasonId) {
        questionBankState = {
            ...questionBankState,
            activeSeasonId: nextSeasonId
        };
        if (shouldPersist) {
            persistBank();
        }
    }

    return currentBankView();
}

function getActiveSeason(viewState = currentBankView()) {
    return viewState.seasons.find((season) => season.id === questionBankState.activeSeasonId) || null;
}

function getActiveSeasonQuestions(viewState = currentBankView()) {
    if (!questionBankState.activeSeasonId) {
        return [];
    }

    return viewState.questions.filter((question) => question.seasonId === questionBankState.activeSeasonId);
}

function getBaseQuestion(questionId) {
    return questionBankState.userQuestions.find((question) => question.id === questionId)
        || OFFICIAL_QUESTION_BANK.find((question) => question.id === questionId)
        || null;
}

function getBaseMotherId(questionId) {
    return getBaseQuestion(questionId)?.motherId ?? null;
}

function questionCategory(question) {
    const topic = getMotherTopic(question.motherId || getLocalClassification(question));
    return topic ? TOPIC_TO_CATEGORY[topic.legacyId] : currentCategory;
}

function loadBank() {
    try {
        const parsed = JSON.parse(localStorage.getItem(BANK_STORAGE_KEY) || 'null');
        questionBankState = normalizeLoadedBank(parsed);
    } catch {
        questionBankState = createEmptyBankState();
    }

    syncActiveSeason(false);
}

function parseTextImport(text) {
    return text.split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
            return { prompt: parts.shift() || '', cues: parts, tags: [], season: '' };
        })
        .filter((item) => item.prompt);
}

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
}

function parseCSVImport(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) throw new Error('文件是空的。');
    const header = parseCsvLine(lines[0]).map((name) => name.toLowerCase());
    const column = (names) => header.findIndex((name) => names.includes(name));
    const promptIdx = column(['prompt', 'question', 'title', '题目', '题干']);
    const cuesIdx = column(['cue_points', 'cues', 'cue', 'points', '要点']);
    const tagsIdx = column(['tags', 'tag', '标签']);
    const seasonIdx = column(['season', '季', '季节']);
    if (promptIdx === -1) throw new Error('CSV 缺少题目列（prompt / question / title / 题目）。');

    const items = [];
    lines.slice(1).forEach((line) => {
        const cells = parseCsvLine(line);
        if (!cells[promptIdx]) return;
        items.push({
            prompt: cells[promptIdx],
            cues: cuesIdx >= 0 ? cells[cuesIdx].split('|').map((cue) => cue.trim()).filter(Boolean) : [],
            tags: tagsIdx >= 0 ? cells[tagsIdx].split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) : [],
            season: seasonIdx >= 0 ? cells[seasonIdx] : ''
        });
    });

    if (!items.length) throw new Error('没有读到任何题目行。');
    return items;
}

function parseJSONImport(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data?.questions || data?.data || null;
    if (!Array.isArray(list)) throw new Error('JSON 应为题目数组，或包含 questions 字段。');

    const items = list.map((item) => {
        const rawCues = item?.cue_points || item?.cues || item?.cue || item?.要点 || [];
        const rawTags = item?.tags || item?.tag || item?.标签 || [];
        return {
            prompt: String(item?.prompt || item?.question || item?.title || item?.题目 || item?.题干 || '').trim(),
            cues: (Array.isArray(rawCues) ? rawCues : String(rawCues || '').split('|')).map((cue) => String(cue).trim()).filter(Boolean),
            tags: (Array.isArray(rawTags) ? rawTags : String(rawTags || '').split(/[,，]/)).map((tag) => String(tag).trim()).filter(Boolean),
            season: String(item?.season || item?.季 || '').trim()
        };
    }).filter((item) => item.prompt);

    if (!items.length) throw new Error('没有读到任何题目。');
    return items;
}

function resolveImportGroups(items, seasonFallback) {
    const targetSeasonId = String(seasonFallback || '').trim();
    const normalizedItems = items
        .map((item) => ({
            ...item,
            prompt: String(item?.prompt || '').trim(),
            season: String(item?.season || '').trim()
        }))
        .filter((item) => item.prompt);

    if (targetSeasonId) {
        return [{ seasonId: targetSeasonId, items: normalizedItems }];
    }

    const grouped = new Map();
    normalizedItems.forEach((item) => {
        if (!item.season) {
            return;
        }

        if (!grouped.has(item.season)) {
            grouped.set(item.season, []);
        }

        grouped.get(item.season).push(item);
    });

    if (grouped.size && [...grouped.values()].every((group) => group.length > 0) && grouped.size === new Set(normalizedItems.map((item) => item.season).filter(Boolean)).size && normalizedItems.every((item) => item.season)) {
        return [...grouped.entries()].map(([seasonId, seasonItems]) => ({ seasonId, items: seasonItems }));
    }

    return [];
}

function importQuestions(items, seasonFallback) {
    const groups = resolveImportGroups(items, seasonFallback);
    if (!groups.length) {
        importStatus.textContent = '请先填写“季节 / 版本”，或在文件里为每道题提供 season 字段。';
        return;
    }

    let nextState = questionBankState;
    let added = 0;
    let submitted = 0;
    groups.forEach(({ seasonId, items: seasonItems }) => {
        submitted += seasonItems.length;
        const before = nextState.userQuestions.length;
        nextState = importSeasonQuestions(nextState, seasonItems, seasonId, makeQuestionId);
        added += nextState.userQuestions.length - before;
    });

    const preferredSeasonId = sortSeasons(groups.map(({ seasonId }) => ({ id: seasonId })))[0]?.id;
    questionBankState = {
        ...nextState,
        activeSeasonId: preferredSeasonId || nextState.activeSeasonId
    };
    syncActiveSeason(false);
    persistBank();
    renderBank();

    const skipped = submitted - added;
    importStatus.textContent = added
        ? `已新增 ${added} 题${skipped ? `，跳过 ${skipped} 条同季重复题` : ''}。打开“手动确认本季分类”即可检查草稿。`
        : skipped
            ? `没有新增：${skipped} 条题目都与同季已有题目重复。`
            : '没有读到可导入的题目。';
}

const SAMPLE_BANK = [
    { prompt: 'Describe an old person you enjoy talking to.', cues: ['who he/she is', 'what you talk about', 'why you enjoy talking to him/her'], season: '2026-09-01' },
    { prompt: 'Describe a friend who helped you in a difficult time.', cues: ['who the friend is', 'what happened', 'how he/she helped you'], season: '2026-09-01' },
    { prompt: 'Describe an object you have kept for a long time.', cues: ['what it is', 'how you got it', 'why you keep it'], season: '2026-09-01' },
    { prompt: 'Describe an app or a website that you use often.', cues: ['what it is', 'how you use it', 'why you like it'], season: '2026-05-08' },
    { prompt: 'Describe a natural place you would like to visit again.', cues: ['where it is', 'what you did there', 'why you want to go back'], season: '2026-05-08' },
    { prompt: 'Describe a room or a place indoors where you like to spend time.', cues: ['where it is', 'what you do there', 'why you like it'], season: '2026-05-08' },
    { prompt: 'Describe a time you achieved something you were proud of.', cues: ['what you achieved', 'how you did it', 'how you felt'], season: '2026-01-01' },
    { prompt: 'Describe a time you failed at something and what you learned from it.', cues: ['what it was', 'why it happened', 'what you learned'], season: '2026-01-01' }
];

function createMetaText(question) {
    const sourceLabel = question.source === 'official' ? '官方' : '自导入';
    const cuesLabel = question.cues?.length ? `${question.cues.length} 个 cue` : null;
    return [question.seasonId, sourceLabel, cuesLabel, ...(question.tags || [])].filter(Boolean).join(' · ');
}

function createQuestionCard(question, { previewOnly = false, draftMotherId = null } = {}) {
    const chip = document.createElement('article');
    chip.className = `question-chip${previewOnly ? ' preview-question-card' : ' draft-question-card'}`;
    chip.dataset.questionId = question.id;

    const row1 = document.createElement('div');
    row1.className = 'question-chip-row';

    const promptButton = document.createElement('button');
    promptButton.type = 'button';
    promptButton.className = 'q-link-button';
    promptButton.textContent = question.prompt;
    promptButton.title = '点击这道题，去练习页生成答案';
    promptButton.addEventListener('click', () => openInPractice(question));

    row1.appendChild(promptButton);

    if (question.source !== 'official') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'q-remove';
        remove.textContent = '×';
        remove.title = '从题库中删除这道题';
        remove.addEventListener('click', () => removeQuestion(question.id));
        row1.appendChild(remove);
    }

    const row2 = document.createElement('div');
    row2.className = 'q-meta-row';
    const meta = document.createElement('p');
    meta.className = 'q-meta';
    meta.textContent = createMetaText(question);
    row2.appendChild(meta);

    if (!previewOnly) {
        const select = document.createElement('select');
        select.className = 'q-assign';
        select.title = '修改当前题目的母题草稿';
        select.innerHTML = '<option value="">未分类</option>';
        MOTHER_TOPICS.forEach((topic) => {
            const option = document.createElement('option');
            option.value = topic.id;
            option.textContent = topic.label;
            select.appendChild(option);
        });
        select.value = draftMotherId || '';
        select.addEventListener('change', () => applyDraftAssignment(question.id, select.value || null));
        row2.appendChild(select);
    }

    chip.append(row1, row2);

    if (!previewOnly) {
        const badges = document.createElement('div');
        badges.className = 'draft-card-badges';

        const confirmedMotherId = question.motherId ?? null;
        if (confirmedMotherId) {
            const confirmedBadge = document.createElement('span');
            confirmedBadge.className = 'q-status-badge';
            confirmedBadge.textContent = `已确认 ${getMotherTopic(confirmedMotherId)?.label || confirmedMotherId}`;
            badges.appendChild(confirmedBadge);
        }

        const localMotherId = !confirmedMotherId ? getLocalClassification(question) : null;
        if (localMotherId) {
            const localBadge = document.createElement('span');
            localBadge.className = 'q-status-badge accent';
            localBadge.textContent = `本地建议 ${getMotherTopic(localMotherId)?.label || localMotherId}`;
            badges.appendChild(localBadge);
        }

        if (badges.childElementCount) {
            chip.appendChild(badges);
        }
    }

    return chip;
}

function renderSlot(topic, questions) {
    const cell = document.createElement('section');
    cell.className = 'slot-cell';
    cell.setAttribute('aria-label', `${topic.label}格子`);
    const head = document.createElement('div');
    head.className = 'slot-head';
    const titles = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = topic.label;
    const sub = document.createElement('p');
    sub.className = 'slot-en';
    sub.textContent = `${topic.en} · ${topic.description}`;
    titles.append(title, sub);
    const count = document.createElement('span');
    count.className = 'slot-count';
    count.textContent = questions.length;
    head.append(titles, count);

    const list = document.createElement('div');
    list.className = 'slot-list';
    if (!questions.length) {
        const empty = document.createElement('p');
        empty.className = 'slot-empty';
        empty.textContent = '当前季度里还没有确认到这个母题。';
        list.appendChild(empty);
    } else {
        questions.forEach((question) => list.appendChild(createQuestionCard(question, { previewOnly: true })));
    }

    cell.append(head, list);
    slotGrid.appendChild(cell);
}

function renderSeasonSelect(viewState) {
    const seasons = sortSeasons(viewState.seasons);
    seasonSelect.innerHTML = '';
    if (!seasons.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '先导入一个季度';
        seasonSelect.appendChild(option);
        seasonSelect.disabled = true;
        return;
    }

    seasons.forEach((season) => {
        const option = document.createElement('option');
        option.value = season.id;
        option.textContent = `${season.label || season.id} · ${season.id}`;
        seasonSelect.appendChild(option);
    });

    seasonSelect.disabled = false;
    seasonSelect.value = questionBankState.activeSeasonId || seasons[0].id;
}

function renderPreviewBoard(viewState) {
    const seasonQuestions = getActiveSeasonQuestions(viewState);
    slotGrid.innerHTML = '';
    MOTHER_TOPICS.forEach((topic) => {
        renderSlot(
            topic,
            seasonQuestions
                .filter((question) => question.motherId === topic.id)
                .sort((left, right) => left.prompt.localeCompare(right.prompt))
        );
    });

    const unclassified = seasonQuestions
        .filter((question) => !question.motherId)
        .sort((left, right) => left.prompt.localeCompare(right.prompt));
    poolList.innerHTML = '';
    poolCount.textContent = unclassified.length;
    if (!unclassified.length) {
        const empty = document.createElement('p');
        empty.className = 'slot-empty';
        empty.textContent = seasonQuestions.length
            ? '当前季度的题目都已经确认分类。'
            : '这个季度还没有题目。先导入题库或载入示例。';
        poolList.appendChild(empty);
    } else {
        unclassified.forEach((question) => poolList.appendChild(createQuestionCard(question, { previewOnly: true })));
    }
}

function renderBank() {
    const viewState = syncActiveSeason(false);
    const season = getActiveSeason(viewState);
    const seasonQuestions = getActiveSeasonQuestions(viewState);
    const confirmedCount = seasonQuestions.filter((question) => question.motherId).length;

    renderSeasonSelect(viewState);
    renderPreviewBoard(viewState);

    bankSummary.textContent = season
        ? `共 ${viewState.questions.length} 题 · 当前季度 ${season.label || season.id} · 已确认 ${confirmedCount} · 待确认 ${seasonQuestions.length - confirmedCount}`
        : '共 0 题 · 先导入任意一季的题库，再按季度确认母题分类。';
    bankCount.textContent = viewState.questions.length;
    recommendStatus.textContent = seasonQuestions.length
        ? '本地识别会先生成保守草稿；只有在弹窗里点击“确认分类”，本季覆盖结果才会写入题库。'
        : '选择一个季度查看已确认分类；弹窗里的拖拽和下拉都只会改草稿，不会即时保存。';
    openImportModalBtn.disabled = !seasonQuestions.length;
}

function removeQuestion(questionId) {
    const existing = questionBankState.userQuestions.find((question) => question.id === questionId);
    if (!existing) {
        return;
    }

    if (!window.confirm('确定从你的题库中删除这道题吗？')) {
        return;
    }

    questionBankState = {
        ...questionBankState,
        userQuestions: questionBankState.userQuestions.filter((question) => question.id !== questionId),
        classificationOverrides: Object.fromEntries(
            Object.entries(questionBankState.classificationOverrides).filter(([id]) => id !== questionId)
        )
    };
    localClassificationCache.delete(questionId);
    if (classificationDraft) {
        delete classificationDraft[questionId];
        delete initialClassificationDraft?.[questionId];
    }
    persistBank();
    renderBank();
    if (classificationDialog?.open) {
        renderClassificationDialog();
    }
}

function clearBank() {
    if (!questionBankState.userQuestions.length && !Object.keys(questionBankState.classificationOverrides).length) {
        return;
    }

    if (!window.confirm('确定清空你导入的题库与分类覆盖吗？官方示例题仍会保留。')) {
        return;
    }

    questionBankState = createEmptyBankState();
    classificationDraft = null;
    initialClassificationDraft = null;
    localClassificationCache.clear();
    persistBank();
    renderBank();
    importStatus.textContent = '已清空自导入题目与分类覆盖。';
}

function openInPractice(question) {
    topicInput.value = question.prompt;
    applyCategory(questionCategory(question));
    switchView('practiceView');
    topicInput.focus();
}

function createClassificationDraft(questions) {
    return Object.fromEntries(
        questions.map((question) => [question.id, question.motherId ?? getLocalClassification(question) ?? null])
    );
}

function draftQuestionsByTopic(questions, topicId) {
    return questions
        .filter((question) => classificationDraft?.[question.id] === topicId)
        .sort((left, right) => left.prompt.localeCompare(right.prompt));
}

function draftPoolQuestions(questions) {
    return questions
        .filter((question) => !classificationDraft?.[question.id])
        .sort((left, right) => left.prompt.localeCompare(right.prompt));
}

function countDraftChanges() {
    if (!classificationDraft || !initialClassificationDraft) {
        return 0;
    }

    return Object.keys(classificationDraft).filter((questionId) => classificationDraft[questionId] !== initialClassificationDraft[questionId]).length;
}

function isClassificationDraftDirty() {
    return countDraftChanges() > 0;
}

function applyDraftAssignment(questionId, motherId) {
    if (!classificationDraft || (motherId && !getMotherTopic(motherId))) {
        return;
    }

    classificationDraft = {
        ...classificationDraft,
        [questionId]: motherId || null
    };

    if (motherId) {
        selectedClassificationTopicId = motherId;
    }

    renderClassificationDialog();
}

function renderTopicNavigation(questions) {
    topicNav.innerHTML = '';
    MOTHER_TOPICS.forEach((topic) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `topic-nav-btn${selectedClassificationTopicId === topic.id ? ' active' : ''}`;
        button.dataset.topicId = topic.id;
        button.dataset.dropMotherId = topic.id;
        button.innerHTML = `<span>${topic.label}</span><strong>${draftQuestionsByTopic(questions, topic.id).length}</strong>`;
        button.addEventListener('click', () => {
            selectedClassificationTopicId = topic.id;
            renderClassificationDialog();
        });
        topicNav.appendChild(button);
    });
}

function renderClassificationDialog() {
    if (!classificationDialog?.open || !classificationDraft) {
        return;
    }

    const viewState = currentBankView();
    const season = getActiveSeason(viewState);
    const seasonQuestions = getActiveSeasonQuestions(viewState);
    const selectedTopic = getMotherTopic(selectedClassificationTopicId) || MOTHER_TOPICS[0];
    if (selectedTopic) {
        selectedClassificationTopicId = selectedTopic.id;
    }

    const importedCount = seasonQuestions.filter((question) => question.source !== 'official').length;
    const localSuggestedCount = seasonQuestions.filter((question) => !question.motherId && getLocalClassification(question)).length;
    const unclassified = draftPoolQuestions(seasonQuestions);

    dialogImportStep.textContent = season
        ? `${season.label || season.id} · 共 ${seasonQuestions.length} 题 · 自导入 ${importedCount} · 官方 ${seasonQuestions.length - importedCount}`
        : '当前还没有可确认的季度。';
    dialogPreviewStep.textContent = `草稿中已归类 ${seasonQuestions.length - unclassified.length} 题 · 未分类 ${unclassified.length} 题 · 本地建议 ${localSuggestedCount} 题`;
    dialogDraftStatus.textContent = countDraftChanges()
        ? `已修改 ${countDraftChanges()} 题，确认前不会保存。`
        : '还没有改动；现在看到的是当前确认结果加上本地识别草稿。';
    selectedTopicTitle.textContent = selectedTopic?.label || '未选择母题';
    selectedTopicDesc.textContent = selectedTopic
        ? `${selectedTopic.en} · ${selectedTopic.description}`
        : '从左侧选择一个母题查看草稿。';

    renderTopicNavigation(seasonQuestions);

    topicQuestionList.dataset.dropMotherId = selectedTopic?.id || '';
    topicQuestionList.innerHTML = '';
    const topicQuestions = selectedTopic ? draftQuestionsByTopic(seasonQuestions, selectedTopic.id) : [];
    if (!topicQuestions.length) {
        const empty = document.createElement('p');
        empty.className = 'slot-empty';
        empty.textContent = '这个母题下还没有草稿题目。可以把右侧未分类题拖进来，或用下拉切换。';
        topicQuestionList.appendChild(empty);
    } else {
        topicQuestions.forEach((question) => {
            topicQuestionList.appendChild(createQuestionCard(question, { draftMotherId: classificationDraft[question.id] || null }));
        });
    }

    dialogPoolList.dataset.dropMotherId = '';
    dialogPoolList.innerHTML = '';
    dialogPoolCount.textContent = unclassified.length;
    if (!unclassified.length) {
        const empty = document.createElement('p');
        empty.className = 'slot-empty';
        empty.textContent = '这一季的题目都已经放进草稿分组了。';
        dialogPoolList.appendChild(empty);
    } else {
        unclassified.forEach((question) => {
            dialogPoolList.appendChild(createQuestionCard(question, { draftMotherId: null }));
        });
    }
}

function openClassificationDialog() {
    const viewState = syncActiveSeason(false);
    const seasonQuestions = getActiveSeasonQuestions(viewState);
    if (!seasonQuestions.length) {
        return;
    }

    classificationDraft = createClassificationDraft(seasonQuestions);
    initialClassificationDraft = { ...classificationDraft };
    if (!getMotherTopic(selectedClassificationTopicId)) {
        selectedClassificationTopicId = MOTHER_TOPICS[0]?.id || 'M1';
    }

    classificationDialog.showModal();
    renderClassificationDialog();
}

function closeClassificationDialog(forceDiscard = false) {
    if (!classificationDialog?.open) {
        return true;
    }

    if (!forceDiscard && isClassificationDraftDirty() && !window.confirm('当前分类草稿还没有确认，确定要放弃这些更改吗？')) {
        return false;
    }

    classificationDraft = null;
    initialClassificationDraft = null;
    clearClassificationDropTarget();
    classificationDialog.close();
    return true;
}

function confirmClassificationDraft() {
    if (!classificationDraft) {
        return;
    }

    const viewState = currentBankView();
    const seasonQuestions = getActiveSeasonQuestions(viewState);
    const nextOverrides = { ...questionBankState.classificationOverrides };

    seasonQuestions.forEach((question) => {
        const draftMotherId = classificationDraft[question.id] || null;
        const baseMotherId = getBaseMotherId(question.id);
        if (draftMotherId === baseMotherId) {
            delete nextOverrides[question.id];
        } else {
            nextOverrides[question.id] = draftMotherId;
        }
    });

    questionBankState = {
        ...questionBankState,
        classificationOverrides: nextOverrides
    };
    persistBank();
    closeClassificationDialog(true);
    renderBank();
}

function classificationDropElements() {
    return classificationDialog
        ? [...classificationDialog.querySelectorAll('[data-drop-mother-id]')]
        : [];
}

function clearClassificationDropTarget() {
    classificationDropElements().forEach((element) => element.classList.remove('is-drop-target'));
}

function createDragProxy(card) {
    const proxy = card.cloneNode(true);
    proxy.classList.add('drag-proxy');
    proxy.querySelectorAll('button, select').forEach((control) => {
        control.disabled = true;
        control.tabIndex = -1;
    });
    document.body.appendChild(proxy);
    return proxy;
}

function updateDragProxyPosition(state, event) {
    if (!state.proxy) {
        return;
    }

    state.proxy.style.left = `${event.clientX - state.offsetX}px`;
    state.proxy.style.top = `${event.clientY - state.offsetY}px`;
}

function resolveClassificationDropTarget(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const dropTarget = element?.closest('[data-drop-mother-id]');
    if (!dropTarget || !classificationDialog.contains(dropTarget)) {
        return null;
    }

    return dropTarget;
}

function startClassificationDrag(state, event) {
    state.started = true;
    state.proxy = createDragProxy(state.card);
    state.card.classList.add('drag-origin');
    updateDragProxyPosition(state, event);
}

function cleanupClassificationDrag() {
    if (!classificationDrag) {
        return;
    }

    classificationDrag.card?.classList.remove('drag-origin');
    classificationDrag.proxy?.remove();
    clearClassificationDropTarget();
    classificationDrag = null;
}

function handleClassificationPointerDown(event) {
    if (!classificationDialog?.open || event.button !== 0 || event.target.closest('select, button')) {
        return;
    }

    const card = event.target.closest('.draft-question-card');
    if (!card) {
        return;
    }

    const rect = card.getBoundingClientRect();
    classificationDrag = {
        questionId: card.dataset.questionId,
        pointerId: event.pointerId,
        card,
        started: false,
        proxy: null,
        dropTarget: null,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
    };
    card.setPointerCapture?.(event.pointerId);
}

function handleClassificationPointerMove(event) {
    if (!classificationDrag || classificationDrag.pointerId !== event.pointerId) {
        return;
    }

    const distance = Math.hypot(event.clientX - classificationDrag.startX, event.clientY - classificationDrag.startY);
    if (!classificationDrag.started && distance < 8) {
        return;
    }

    if (!classificationDrag.started) {
        startClassificationDrag(classificationDrag, event);
    }

    updateDragProxyPosition(classificationDrag, event);
    clearClassificationDropTarget();
    classificationDrag.dropTarget = resolveClassificationDropTarget(event);
    classificationDrag.dropTarget?.classList.add('is-drop-target');
    event.preventDefault();
}

function handleClassificationPointerUp(event) {
    if (!classificationDrag || classificationDrag.pointerId !== event.pointerId) {
        return;
    }

    if (classificationDrag.started && classificationDrag.dropTarget) {
        applyDraftAssignment(
            classificationDrag.questionId,
            classificationDrag.dropTarget.dataset.dropMotherId || null
        );
    }

    cleanupClassificationDrag();
}

function handleClassificationPointerCancel(event) {
    if (!classificationDrag || classificationDrag.pointerId !== event.pointerId) {
        return;
    }

    cleanupClassificationDrag();
}

importTextBtn.addEventListener('click', () => {
    const text = bankText.value.trim();
    if (!text) {
        importStatus.textContent = '先在上方粘贴题目（每行一题）。';
        return;
    }
    importQuestions(parseTextImport(text), bankSeason.value.trim());
    bankText.value = '';
});
importFileBtn.addEventListener('click', () => bankFile.click());
bankFile.addEventListener('change', async () => {
    const file = bankFile.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const items = file.name.toLowerCase().endsWith('.json') ? parseJSONImport(text) : parseCSVImport(text);
        importQuestions(items, bankSeason.value.trim());
    } catch (error) {
        importStatus.textContent = `文件解析失败：${error.message}`;
    }
    bankFile.value = '';
});
sampleBankBtn.addEventListener('click', () => {
    importQuestions(SAMPLE_BANK, '');
    recommendStatus.textContent = '示例已导入到三个季度。切换季度看预览，再打开弹窗确认本季分类。';
});
clearBankBtn.addEventListener('click', clearBank);
seasonSelect.addEventListener('change', () => {
    questionBankState = {
        ...questionBankState,
        activeSeasonId: seasonSelect.value || null
    };
    persistBank();
    renderBank();
});
openImportModalBtn.addEventListener('click', openClassificationDialog);
closeClassificationDialogBtn.addEventListener('click', () => closeClassificationDialog());
cancelClassificationBtn.addEventListener('click', () => closeClassificationDialog());
confirmClassificationBtn.addEventListener('click', confirmClassificationDraft);
classificationDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeClassificationDialog();
});
classificationDialog?.addEventListener('pointerdown', handleClassificationPointerDown);
classificationDialog?.addEventListener('pointermove', handleClassificationPointerMove);
classificationDialog?.addEventListener('pointerup', handleClassificationPointerUp);
classificationDialog?.addEventListener('pointercancel', handleClassificationPointerCancel);

categoryButtons.forEach((button) => button.addEventListener('click', () => applyCategory(button.dataset.category)));
$$('.nav-link').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
materialSelect.addEventListener('change', () => { selectedMaterialId = materialSelect.value; renderMaterials(); });
materialSearch.addEventListener('input', renderMaterialList);
newMaterialBtn.addEventListener('click', () => openEditor()); closeMaterialEditorBtn.addEventListener('click', closeEditor); cancelMaterialBtn.addEventListener('click', closeEditor); saveMaterialBtn.addEventListener('click', saveMaterial);
generateBtn.addEventListener('click', generateAnswer);
recordBtn.addEventListener('click', () => mediaRecorder?.state === 'recording' ? stopRecording() : startRecording());
transcriptEditor.addEventListener('input', invalidateConfirmedTranscript);
confirmTranscriptBtn.addEventListener('click', confirmTranscript);
reviewBtn.addEventListener('click', reviewSpeaking); readAloudBtn.addEventListener('click', readAloud); readSentenceBtn.addEventListener('click', readNextSentence);
voiceOptions.forEach((option) => option.addEventListener('click', () => {
    stopReading();
    if (option.dataset.accent) { selectedAccent = option.dataset.accent; localStorage.setItem('ielts-reading-accent', selectedAccent); }
    if (option.dataset.rate) { selectedRate = Number(option.dataset.rate); localStorage.setItem('ielts-reading-rate', String(selectedRate)); }
    updateReadingControls();
}));
if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', updateReadingControls);
copyBtn.addEventListener('click', async () => { if (!latestAnswer) return; try { await navigator.clipboard.writeText(latestAnswer); copyBtn.textContent = '已复制'; setTimeout(() => { copyBtn.textContent = '复制答案'; }, 1300); } catch { alert('复制失败，请手动选择答案。'); } });

loadMaterials(); applyCategory(currentCategory); renderMaterials(); resetTimer(); updateReadingControls();
makeDroppable(poolCell, '');
loadBank(); renderBank(); updateRecommendButton();
