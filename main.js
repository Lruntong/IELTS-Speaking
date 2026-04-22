/**
 * IELTS Speaking App - Main Logic (Streaming Version)
 */

const generateBtn = document.getElementById('generateBtn');
const topicInput = document.getElementById('topic');
const themeDots = document.querySelectorAll('.theme-dot');
const keywordsLabel = document.getElementById('keywordsLabel');
const categoryButtons = document.querySelectorAll('.category-btn');
const structuredKeywords = document.getElementById('structuredKeywords');
const loadingDiv = document.getElementById('loading');
const resultSection = document.getElementById('resultSection');
const resultText = document.getElementById('resultText');
const highlightBtn = document.getElementById('highlightBtn');
const clearHighlightBtn = document.getElementById('clearHighlightBtn');
const mockModeBtn = document.getElementById('mockModeBtn');
const mockModal = document.getElementById('mockModal');
const closeMockModalBtn = document.getElementById('closeMockModalBtn');
const mockBulletList = document.getElementById('mockBulletList');
const countdownDisplay = document.getElementById('countdownDisplay');
const startTimerBtn = document.getElementById('startTimerBtn');
const THEME_STORAGE_KEY = 'ielts-app-theme';

const categoryConfig = {
    person: {
        label: '人物关键词 / 提示信息',
        fields: [
            { key: 'identity', label: '身份（关系/职业）', placeholder: '例如：大学同学 / 英语老师' },
            { key: 'appearance', label: '外貌', placeholder: '例如：高个子、短发、眼睛圆圆、笑容亲切' },
            { key: 'personality', label: '性格', placeholder: '例如：乐观、耐心、幽默' },
            { key: 'story', label: '事迹', placeholder: '例如：做过的一件让你印象深刻的事' },
            { key: 'comment', label: '评价', placeholder: '例如：我欣赏这个人，因为...' }
        ]
    },
    object: {
        label: '物品关键词 / 提示信息',
        fields: [
            { key: 'appearance', label: '外观', placeholder: '例如：颜色、大小、材质' },
            { key: 'function', label: '功能', placeholder: '例如：主要用途、解决了什么问题' },
            { key: 'acquire', label: '获得时间/原因', placeholder: '例如：什么时候得到、为什么买它' },
            { key: 'usage', label: '使用频率/评价', placeholder: '例如：多久用一次、整体感受' }
        ]
    },
    place: {
        label: '地点关键词 / 提示信息',
        fields: [
            { key: 'location', label: '位置', placeholder: '例如：城市、国家、具体区域' },
            { key: 'environment', label: '环境', placeholder: '例如：安静、热闹、自然风景秀丽' },
            { key: 'time', label: '经历时间', placeholder: '例如：去年寒假' },
            { key: 'feeling', label: '感受', placeholder: '例如：放松、惊喜、印象深刻' }
        ]
    },
    experience: {
        label: '经历关键词 / 提示信息',
        fields: [
            { key: 'time', label: '时间', placeholder: '例如：毕业前夕' },
            { key: 'place', label: '地点', placeholder: '例如：城市公园' },
            { key: 'participants', label: '参与者', placeholder: '例如：最好的朋友' },
            { key: 'cause', label: '起因', placeholder: '例如：公园有很美的樱花' },
            { key: 'process', label: '经过', placeholder: '例如：我们一边走一边聊天' },
            { key: 'result', label: '结果', placeholder: '例如：我们聊了很久，直到太阳下山' },
            { key: 'feeling', label: '感受', placeholder: '例如：我很开心，因为...' }
        ]
    }
};

let currentCategory = 'person';
const keywordsByCategory = {};
let latestGeneratedResponse = '';
let renderedResultRaw = '';
let timerSeconds = 120;
let timerId = null;

Object.keys(categoryConfig).forEach((category) => {
    keywordsByCategory[category] = {};
    categoryConfig[category].fields.forEach((field) => {
        keywordsByCategory[category][field.key] = '';
    });
});

function persistCurrentCategoryInputs() {
    if (!structuredKeywords) return;
    const inputs = structuredKeywords.querySelectorAll('[data-field-key]');
    inputs.forEach((inputEl) => {
        const fieldKey = inputEl.dataset.fieldKey;
        if (!fieldKey) return;
        keywordsByCategory[currentCategory][fieldKey] = inputEl.value.trim();
    });
}

function applyCategory(category) {
    const config = categoryConfig[category];
    if (!config || !structuredKeywords) return;

    keywordsLabel.textContent = config.label;
    structuredKeywords.innerHTML = '';

    config.fields.forEach((field) => {
        const fieldWrap = document.createElement('div');
        fieldWrap.className = 'structured-field';

        const label = document.createElement('label');
        label.className = 'structured-label';
        label.htmlFor = `${category}-${field.key}`;
        label.textContent = field.label;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `${category}-${field.key}`;
        input.className = 'structured-input';
        input.placeholder = field.placeholder;
        input.dataset.fieldKey = field.key;
        input.value = keywordsByCategory[category][field.key] || '';
        input.addEventListener('input', () => {
            keywordsByCategory[category][field.key] = input.value;
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !generateBtn.disabled) {
                generateBtn.click();
            }
        });

        fieldWrap.appendChild(label);
        fieldWrap.appendChild(input);
        structuredKeywords.appendChild(fieldWrap);
    });

    categoryButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
}

function formatTime(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function resetTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    timerSeconds = 120;
    countdownDisplay.innerText = formatTime(timerSeconds);
    startTimerBtn.innerText = '开始计时';
    startTimerBtn.disabled = false;
}

function startCountdown() {
    if (timerId) return;
    startTimerBtn.innerText = '计时中...';
    timerId = setInterval(() => {
        timerSeconds -= 1;
        countdownDisplay.innerText = formatTime(timerSeconds);
        if (timerSeconds <= 0) {
            clearInterval(timerId);
            timerId = null;
            startTimerBtn.innerText = '时间到，可重新开始';
            alert('2 分钟已到，完成一次模考练习！');
        }
    }, 1000);
}

function extractBulletPoints(content) {
    const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*•\d\.\)\s]+/, '').trim())
        .filter(Boolean);

    const points = lines.slice(0, 8);
    return points.length >= 6 ? points : lines;
}

function renderMockBullets(points) {
    mockBulletList.innerHTML = '';
    points.forEach((point) => {
        const li = document.createElement('li');
        li.innerText = point;
        mockBulletList.appendChild(li);
    });
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatGeneratedText(rawText) {
    let formatted = escapeHtml(rawText);
    return formatted.replace(/\n/g, '<br>');
}

function renderStyledResult(rawText) {
    resultText.innerHTML = formatGeneratedText(rawText);
}

function clearAllHighlights() {
    const highlights = resultText.querySelectorAll('mark.user-highlight');
    highlights.forEach((mark) => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
    });
}

function highlightSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        alert('请先选中你想高亮的内容。');
        return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed || !resultText.contains(range.commonAncestorContainer)) {
        alert('请在答案区域内选中内容后再高亮。');
        return;
    }

    const mark = document.createElement('mark');
    mark.className = 'user-highlight';
    try {
        range.surroundContents(mark);
    } catch (error) {
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
    }

    selection.removeAllRanges();
}

categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const nextCategory = btn.dataset.category;
        if (!nextCategory || nextCategory === currentCategory) return;

        persistCurrentCategoryInputs();
        currentCategory = nextCategory;
        applyCategory(currentCategory);
    });
});

applyCategory(currentCategory);

function applyTheme(themeName) {
    document.body.dataset.theme = themeName;
    themeDots.forEach((dot) => {
        dot.classList.toggle('active', dot.dataset.theme === themeName);
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'moss-green';
    applyTheme(savedTheme);
}

themeDots.forEach((dot) => {
    dot.addEventListener('click', () => {
        const themeName = dot.dataset.theme || 'moss-green';
        applyTheme(themeName);
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
    });
});

initTheme();

generateBtn.addEventListener('click', async () => {
    const topic = topicInput.value.trim();
    persistCurrentCategoryInputs();
    const currentFields = keywordsByCategory[currentCategory];
    const activeFieldConfig = categoryConfig[currentCategory].fields;
    const keywords = activeFieldConfig
        .map((field) => {
            const value = (currentFields[field.key] || '').trim();
            return value ? `${field.label}: ${value}` : '';
        })
        .filter(Boolean)
        .join('; ');

    if (!topic) {
        alert('Please enter a topic first!');
        return;
    }

    // 1. 切换 UI 状态
    generateBtn.disabled = true;
    loadingDiv.classList.remove('hidden');
    resultSection.classList.add('hidden');
    resultText.innerHTML = ''; // 清空上次的内容
    latestGeneratedResponse = '';
    renderedResultRaw = '';
    mockModeBtn.disabled = true;

    try {
        // 2. 发起请求
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic,
                keywords,
                category: currentCategory,
                structuredKeywords: currentFields
            }),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        // 3. 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 隐藏加载提示，显示结果区域（此时内容还在陆续产生）
        loadingDiv.classList.add('hidden');
        resultSection.classList.remove('hidden');

        let isFirstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            // 处理 SSE 数据格式 (data: {"choices":[...]})
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                
                if (trimmedLine.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmedLine.substring(6);
                        const data = JSON.parse(jsonStr);
                        const content = data.choices[0].delta?.content || '';
                        
                        // 实时追加文字
                        renderedResultRaw += content;
                        renderStyledResult(renderedResultRaw);
                        latestGeneratedResponse += content;

                        // 自动滚动到底部，提升用户体验
                        if (isFirstChunk) {
                            resultSection.scrollIntoView({ behavior: 'smooth' });
                            isFirstChunk = false;
                        }
                    } catch (e) {
                        console.error('Error parsing chunk:', e);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Something went wrong: ' + error.message);
        loadingDiv.classList.add('hidden');
    } finally {
        generateBtn.disabled = false;
        mockModeBtn.disabled = !latestGeneratedResponse.trim();
    }
});

highlightBtn.addEventListener('click', () => {
    highlightSelectedText();
});

clearHighlightBtn.addEventListener('click', () => {
    clearAllHighlights();
});

mockModeBtn.addEventListener('click', async () => {
    if (!latestGeneratedResponse.trim()) {
        alert('请先生成一篇范文，再进入模考模式。');
        return;
    }

    mockModeBtn.disabled = true;
    const originalText = mockModeBtn.innerText;
    mockModeBtn.innerText = '提炼关键词中...';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic: '我正在准备雅思口语part2，将下方范文提炼为 6-8 个英文关键词bullet points来帮助我记忆这段文本，关键词包含这段文本中的重要结构。请注意每个bullet point不超过10个单词，不要包含**或者类似的符号。',
                keywords: latestGeneratedResponse,
                category: 'mock',
            }),
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let mockContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                if (trimmedLine.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(trimmedLine.substring(6));
                        mockContent += data.choices[0].delta?.content || '';
                    } catch (e) {
                        console.error('Error parsing mock chunk:', e);
                    }
                }
            }
        }

        const points = extractBulletPoints(mockContent);
        if (!points.length) {
            throw new Error('No mock bullet points generated');
        }

        renderMockBullets(points);
        resetTimer();
        mockModal.classList.remove('hidden');
    } catch (error) {
        console.error('Mock mode error:', error);
        alert('进入模考模式失败：' + error.message);
    } finally {
        mockModeBtn.disabled = false;
        mockModeBtn.innerText = originalText;
    }
});

startTimerBtn.addEventListener('click', () => {
    if (timerSeconds <= 0) {
        resetTimer();
    }
    startCountdown();
});

closeMockModalBtn.addEventListener('click', () => {
    mockModal.classList.add('hidden');
    resetTimer();
});

mockModal.addEventListener('click', (e) => {
    if (e.target === mockModal) {
        mockModal.classList.add('hidden');
        resetTimer();
    }
});

// 辅助功能：按 Enter 键触发生成
topicInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !generateBtn.disabled) {
        generateBtn.click();
    }
});