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
const copyBtn = $('#copyBtn');
const recordingSection = $('#recordingSection');
const recordBtn = $('#recordBtn');
const recordingStatus = $('#recordingStatus');
const countdownDisplay = $('#countdownDisplay');
const audioPlayback = $('#audioPlayback');
const transcriptText = $('#transcriptText');
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
let audioUrl = '';

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
    transcriptText.textContent = transcript || '正在聆听你的英文回答…';
    reviewBtn.disabled = !finalTranscript.trim();
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
        finalTranscript = ''; interimTranscript = ''; transcriptText.textContent = '正在聆听你的英文回答…'; reviewPanel.classList.add('hidden'); reviewBtn.disabled = true;
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
    recordBtn.classList.remove('recording'); recordBtn.innerHTML = '<span class="record-indicator"></span>重新开始录音'; recordingStatus.textContent = finalTranscript.trim() ? '录音已保存。现在看看转写，并生成复盘。' : '录音已保存，但没有识别到英文转写。你仍可以回放后再试一次。'; updateTranscript();
}
async function reviewSpeaking() {
    const transcript = finalTranscript.trim();
    if (!transcript) return;
    reviewBtn.disabled = true; reviewLoading.classList.remove('hidden'); reviewPanel.classList.add('hidden'); reviewText.textContent = '';
    try {
        const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'speaking-review', topic: topicInput.value.trim(), transcript, referenceAnswer: latestAnswer }) });
        if (!response.ok) throw new Error(await getErrorMessage(response));
        let review = ''; await readSseStream(response, (content) => { review += content; reviewText.textContent = review; });
        if (!review.trim()) throw new Error('没有生成复盘。'); reviewPanel.classList.remove('hidden');
    } catch (error) { alert(`复盘失败：${error.message}`); } finally { reviewBtn.disabled = !finalTranscript.trim(); reviewLoading.classList.add('hidden'); }
}

function readAloud() {
    if (!latestAnswer) return;
    if (!('speechSynthesis' in window)) { alert('当前浏览器不支持领读。'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); readAloudBtn.textContent = '领读范文'; return; }
    const utterance = new SpeechSynthesisUtterance(latestAnswer); utterance.lang = 'en-GB'; utterance.rate = .88;
    utterance.onend = () => { readAloudBtn.textContent = '领读范文'; };
    readAloudBtn.textContent = '停止领读'; speechSynthesis.speak(utterance);
}

categoryButtons.forEach((button) => button.addEventListener('click', () => applyCategory(button.dataset.category)));
$$('.nav-link').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
materialSelect.addEventListener('change', () => { selectedMaterialId = materialSelect.value; renderMaterials(); });
materialSearch.addEventListener('input', renderMaterialList);
newMaterialBtn.addEventListener('click', () => openEditor()); closeMaterialEditorBtn.addEventListener('click', closeEditor); cancelMaterialBtn.addEventListener('click', closeEditor); saveMaterialBtn.addEventListener('click', saveMaterial);
generateBtn.addEventListener('click', generateAnswer);
recordBtn.addEventListener('click', () => mediaRecorder?.state === 'recording' ? stopRecording() : startRecording());
reviewBtn.addEventListener('click', reviewSpeaking); readAloudBtn.addEventListener('click', readAloud);
copyBtn.addEventListener('click', async () => { if (!latestAnswer) return; try { await navigator.clipboard.writeText(latestAnswer); copyBtn.textContent = '已复制'; setTimeout(() => { copyBtn.textContent = '复制答案'; }, 1300); } catch { alert('复制失败，请手动选择答案。'); } });

loadMaterials(); applyCategory(currentCategory); renderMaterials(); resetTimer();
