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

/* ================= 题库 · 固定 8 个母题格子 ================= */
// 母题格子是硬编码的：无论用户导入哪一季的题库，界面永远显示这 8 个格子。
// AI 聚类（/api/generate 的 slot-recommend）只生成“推荐映射”并以「AI建议」展示，从不改变分组。
const MOTHER_SLOTS = [
    { id: 'elder-person', label: '人物长辈', en: 'Elder & Mentor', desc: '长辈、老师、前辈' },
    { id: 'peer-person', label: '人物同辈', en: 'Peer & Friend', desc: '朋友、同学、同龄人' },
    { id: 'old-object', label: '旧物', en: 'Old Object', desc: '旧物品、礼物、纪念品' },
    { id: 'virtual-object', label: '虚拟物', en: 'Virtual & Digital', desc: '应用、网站、虚拟物品' },
    { id: 'nature-place', label: '自然地点', en: 'Natural Place', desc: '户外与自然环境' },
    { id: 'indoor-place', label: '室内地点', en: 'Indoor Place', desc: '室内空间' },
    { id: 'success-experience', label: '成功经历', en: 'Success', desc: '成就、第一次成功' },
    { id: 'setback-experience', label: '挫折经历', en: 'Setback', desc: '失败、困难、低谷' }
];
const SLOT_TO_CATEGORY = { 'elder-person': 'person', 'peer-person': 'person', 'old-object': 'object', 'virtual-object': 'object', 'nature-place': 'place', 'indoor-place': 'place', 'success-experience': 'experience', 'setback-experience': 'experience' };
const BANK_STORAGE_KEY = 'ielts-question-bank-v1';
const bank = { questions: [], assignments: {}, suggestions: {} };

const bankSeason = $('#bankSeason');
const bankText = $('#bankText');
const bankFile = $('#bankFile');
const importStatus = $('#importStatus');
const bankSummary = $('#bankSummary');
const bankCount = $('#bankCount');
const recommendBtn = $('#recommendBtn');
const recommendStatus = $('#recommendStatus');
const slotGrid = $('#slotGrid');
const poolCell = $('#poolCell');
const poolList = $('#poolList');
const poolCount = $('#poolCount');

function slotById(id) { return MOTHER_SLOTS.find((slot) => slot.id === id) || null; }
function makeQuestionId() { return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

function loadBank() {
    try {
        const parsed = JSON.parse(localStorage.getItem(BANK_STORAGE_KEY) || 'null');
        if (!parsed || !Array.isArray(parsed.questions)) return;
        bank.questions = parsed.questions.filter((question) => question && question.id && question.prompt);
        bank.assignments = parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {};
        bank.suggestions = parsed.suggestions && typeof parsed.suggestions === 'object' ? parsed.suggestions : {};
    } catch { /* 保持空题库 */ }
}

function persistBank() { localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(bank)); }

function parseTextImport(text) {
    return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
            return { prompt: parts.shift() || '', cues: parts };
        }).filter((item) => item.prompt);
}

function parseCsvLine(line) {
    const cells = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') { current += '"'; i += 1; } else inQuotes = false;
            } else current += char;
        } else if (char === '"') inQuotes = true;
        else if (char === ',') { cells.push(current); current = ''; }
        else current += char;
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
        const cues = cuesIdx >= 0 ? cells[cuesIdx].split('|').map((cue) => cue.trim()).filter(Boolean) : [];
        const tags = tagsIdx >= 0 ? cells[tagsIdx].split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) : [];
        const season = seasonIdx >= 0 ? cells[seasonIdx] : '';
        items.push({ prompt: cells[promptIdx], cues, tags, season });
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

function importQuestions(items, seasonFallback) {
    const seen = new Set(bank.questions.map((q) => q.prompt.trim().toLowerCase()));
    let added = 0; let skipped = 0;
    items.forEach((item) => {
        const prompt = String(item.prompt || '').trim();
        if (!prompt) return;
        const key = prompt.toLowerCase();
        if (seen.has(key)) { skipped += 1; return; }
        seen.add(key);
        bank.questions.push({
            id: makeQuestionId(),
            prompt,
            cues: (item.cues || []).map((cue) => String(cue).trim()).filter(Boolean).slice(0, 4),
            tags: (item.tags || []).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6),
            season: String(item.season || seasonFallback || '').trim() || '未注明季节',
            importedAt: Date.now()
        });
        added += 1;
    });
    persistBank();
    renderBank();
    updateRecommendButton();
    importStatus.textContent = added
        ? `已新增 ${added} 题${skipped ? `，跳过 ${skipped} 条重复` : ''}。当前共 ${bank.questions.length} 题。`
        : skipped ? `没有新增：${skipped} 条都与题库中已有题目重复。` : '没有读到可导入的题目。';
}

const SAMPLE_BANK = [
    { prompt: 'Describe an old person you enjoy talking to.', cues: ['who he/she is', 'what you talk about', 'why you enjoy talking to him/her'], season: '2026-09' },
    { prompt: 'Describe a friend who helped you in a difficult time.', cues: ['who the friend is', 'what happened', 'how he/she helped you'], season: '2026-09' },
    { prompt: 'Describe an object you have kept for a long time.', cues: ['what it is', 'how you got it', 'why you keep it'], season: '2026-09' },
    { prompt: 'Describe an app or a website that you use often.', cues: ['what it is', 'how you use it', 'why you like it'], season: '2026-05' },
    { prompt: 'Describe a natural place you would like to visit again.', cues: ['where it is', 'what you did there', 'why you want to go back'], season: '2026-05' },
    { prompt: 'Describe a room or a place indoors where you like to spend time.', cues: ['where it is', 'what you do there', 'why you like it'], season: '2026-05' },
    { prompt: 'Describe a time you achieved something you were proud of.', cues: ['what you achieved', 'how you did it', 'how you felt'], season: '2026-01' },
    { prompt: 'Describe a time you failed at something and what you learned from it.', cues: ['what it was', 'why it happened', 'what you learned'], season: '2026-01' }
];

function assignedSlotCount(slotId) { return bank.questions.filter((q) => bank.assignments[q.id] === slotId).length; }

function questionChip(question) {
    const chip = document.createElement('article');
    chip.className = 'question-chip';
    chip.draggable = true;

    const row1 = document.createElement('div'); row1.className = 'question-chip-row';
    const prompt = document.createElement('p'); prompt.className = 'q-prompt'; prompt.textContent = question.prompt; prompt.title = '点击这道题，去练习页生成答案';
    prompt.addEventListener('click', () => openInPractice(question));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'q-remove'; remove.textContent = '×'; remove.title = '从题库中删除这道题';
    remove.addEventListener('click', () => removeQuestion(question.id));
    row1.append(prompt, remove);

    const row2 = document.createElement('div'); row2.className = 'q-meta-row';
    const meta = document.createElement('p'); meta.className = 'q-meta';
    meta.textContent = [question.season, ...question.tags].filter(Boolean).join(' · ') || '未分类';
    const select = document.createElement('select'); select.className = 'q-assign'; select.title = '分配到固定格子';
    const noneOption = document.createElement('option'); noneOption.value = ''; noneOption.textContent = '未分配';
    select.appendChild(noneOption);
    MOTHER_SLOTS.forEach((slot) => {
        const option = document.createElement('option'); option.value = slot.id; option.textContent = slot.label;
        select.appendChild(option);
    });
    select.value = bank.assignments[question.id] || '';
    select.addEventListener('change', () => assignQuestion(question.id, select.value));
    row2.append(meta, select);

    chip.append(row1, row2);

    const suggestion = bank.suggestions[question.id];
    if (suggestion && slotById(suggestion.slot)) {
        const slot = slotById(suggestion.slot);
        const accepted = bank.assignments[question.id] === suggestion.slot;
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = `q-suggest${accepted ? ' accepted' : ''}`;
        badge.title = `理由：${suggestion.reason || ''}。点击采纳这条建议。`;
        badge.textContent = `AI建议：${slot.label}${accepted ? '（已采纳）' : ` · ${suggestion.reason || ''}`}`;
        badge.addEventListener('click', () => {
            if (bank.assignments[question.id] === suggestion.slot) return;
            assignQuestion(question.id, suggestion.slot);
            recommendStatus.textContent = `已按 AI 建议把题目放入「${slot.label}」。分组由你决定，随时可以拖回或改选。`;
        });
        chip.appendChild(badge);
    }

    chip.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', question.id);
        event.dataTransfer.effectAllowed = 'move';
        chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
        chip.classList.remove('dragging');
        $$('.slot-cell').forEach((cell) => cell.classList.remove('drag-over'));
    });
    return chip;
}

function makeDroppable(element, slotId) {
    element.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; element.classList.add('drag-over'); });
    element.addEventListener('dragleave', (event) => { if (!element.contains(event.relatedTarget)) element.classList.remove('drag-over'); });
    element.addEventListener('drop', (event) => {
        event.preventDefault();
        element.classList.remove('drag-over');
        const questionId = event.dataTransfer.getData('text/plain');
        if (questionId) assignQuestion(questionId, slotId);
    });
}

function renderSlots() {
    slotGrid.innerHTML = '';
    MOTHER_SLOTS.forEach((slot) => {
        const cell = document.createElement('section');
        cell.className = 'slot-cell';
        cell.dataset.slot = slot.id;
        cell.setAttribute('aria-label', `${slot.label}格子`);
        const head = document.createElement('div'); head.className = 'slot-head';
        const titles = document.createElement('div');
        const title = document.createElement('h3'); title.textContent = slot.label;
        const sub = document.createElement('p'); sub.className = 'slot-en'; sub.textContent = `${slot.en} · ${slot.desc}`;
        titles.append(title, sub);
        const count = document.createElement('span'); count.className = 'slot-count'; count.textContent = assignedSlotCount(slot.id);
        head.append(titles, count);
        const list = document.createElement('div'); list.className = 'slot-list';
        const items = bank.questions.filter((q) => bank.assignments[q.id] === slot.id);
        if (!items.length) { const empty = document.createElement('p'); empty.className = 'slot-empty'; empty.textContent = '空 · 把题目拖进来'; list.appendChild(empty); }
        else items.forEach((q) => list.appendChild(questionChip(q)));
        cell.append(head, list);
        makeDroppable(cell, slot.id);
        slotGrid.appendChild(cell);
    });
}

function renderPool() {
    poolList.innerHTML = '';
    const items = bank.questions.filter((q) => !bank.assignments[q.id]);
    poolCount.textContent = items.length;
    if (!items.length) {
        const empty = document.createElement('p'); empty.className = 'slot-empty';
        empty.textContent = bank.questions.length ? '所有题目都已分配。拖回这里即可取消分配。' : '还没有题目。先导入任意一季的题库，或载入示例。';
        poolList.appendChild(empty);
    } else items.forEach((q) => poolList.appendChild(questionChip(q)));
}

function renderBank() {
    renderSlots();
    renderPool();
    const seasons = [...new Set(bank.questions.map((q) => q.season).filter(Boolean))];
    const assigned = bank.questions.filter((q) => bank.assignments[q.id]).length;
    bankSummary.textContent = `共 ${bank.questions.length} 题 · 已分配 ${assigned} · 待分配 ${bank.questions.length - assigned}${seasons.length ? ` · ${seasons.join(' / ')}` : ''}`;
    bankCount.textContent = bank.questions.length;
}

function assignQuestion(questionId, slotId) {
    if (!bank.questions.some((q) => q.id === questionId)) return;
    if (slotId && !slotById(slotId)) return;
    if ((bank.assignments[questionId] || '') === slotId) return;
    if (slotId) bank.assignments[questionId] = slotId;
    else delete bank.assignments[questionId];
    persistBank();
    renderBank();
}

function removeQuestion(questionId) {
    bank.questions = bank.questions.filter((q) => q.id !== questionId);
    delete bank.assignments[questionId];
    delete bank.suggestions[questionId];
    persistBank();
    renderBank();
    updateRecommendButton();
}

function clearBank() {
    if (!bank.questions.length) return;
    if (!window.confirm('确定清空整个题库吗？已分配的格子和 AI 建议也会一并清除。')) return;
    bank.questions = []; bank.assignments = {}; bank.suggestions = {};
    persistBank(); renderBank(); updateRecommendButton();
    importStatus.textContent = '题库已清空。';
}

function openInPractice(question) {
    topicInput.value = question.prompt;
    const slotId = bank.assignments[question.id];
    if (slotId && SLOT_TO_CATEGORY[slotId]) applyCategory(SLOT_TO_CATEGORY[slotId]);
    switchView('practiceView');
    topicInput.focus();
}

function updateRecommendButton() {
    const pending = bank.questions.filter((q) => !bank.suggestions[q.id]);
    if (!bank.questions.length) { recommendBtn.disabled = true; recommendBtn.textContent = 'AI 推荐映射（仅建议，不改分组）'; return; }
    recommendBtn.disabled = false;
    recommendBtn.textContent = pending.length
        ? `AI 推荐映射（待推荐 ${pending.length} 题）`
        : `AI 推荐映射（已推荐 ${bank.questions.length} 题，可更新）`;
}

async function recommendAll() {
    const targets = bank.questions.filter((q) => !bank.suggestions[q.id]);
    const questions = targets.length ? targets : bank.questions.slice();
    if (!questions.length) return;
    recommendBtn.disabled = true;
    const batches = [];
    for (let i = 0; i < questions.length; i += 20) batches.push(questions.slice(i, i + 20));
    let failed = false;
    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        recommendStatus.textContent = `正在让 AI 推荐映射… 第 ${index + 1}/${batches.length} 批（仅建议，不改分组）`;
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: 'slot-recommend',
                    questions: batch.map(({ id, prompt, cues, tags, season }) => ({ id, prompt, cues, tags, season }))
                })
            });
            if (!response.ok) throw new Error(await getErrorMessage(response));
            const data = await response.json();
            (data.recommendations || []).forEach((rec) => {
                if (rec.id && rec.slot && slotById(rec.slot)) bank.suggestions[rec.id] = { slot: rec.slot, reason: rec.reason || '', at: Date.now() };
            });
            persistBank();
        } catch (error) {
            failed = true;
            alert(`AI 推荐失败：${error.message}`);
            break;
        }
    }
    recommendStatus.textContent = failed
        ? '推荐中断：已完成的部分建议已保留。'
        : '推荐完成。每道题旁的「AI建议」只是推荐，采纳与否由你决定；分组永远由你拖拽决定。';
    renderBank();
    updateRecommendButton();
}

importTextBtn.addEventListener('click', () => {
    const text = bankText.value.trim();
    if (!text) { importStatus.textContent = '先在上方粘贴题目（每行一题）。'; return; }
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
    } catch (error) { importStatus.textContent = `文件解析失败：${error.message}`; }
    bankFile.value = '';
});
sampleBankBtn.addEventListener('click', () => {
    importQuestions(SAMPLE_BANK, '');
    recommendStatus.textContent = '示例已导入（跨越三个季节）。可以点「AI 推荐映射」看看模型怎么建议。';
});
clearBankBtn.addEventListener('click', clearBank);
recommendBtn.addEventListener('click', recommendAll);

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
