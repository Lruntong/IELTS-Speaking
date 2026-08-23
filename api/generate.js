const categoryLabels = {
    person: '人物',
    object: '物品',
    place: '地点',
    experience: '经历'
};

const VALID_MOTHER_IDS = new Set(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8']);
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

function cleanText(value, limit = 1200) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function chunkItems(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function readDeepSeekModel(envName) {
    return process.env[envName]?.trim() || process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}

function formatStructuredKeywords(structuredKeywords) {
    if (!structuredKeywords || typeof structuredKeywords !== 'object' || Array.isArray(structuredKeywords)) {
        return '';
    }

    return Object.entries(structuredKeywords)
        .map(([key, value]) => `${key}: ${cleanText(value, 300)}`)
        .filter((item) => !item.endsWith(': '))
        .join('\n');
}

function formatPersonalMaterial(personalMaterial) {
    if (!personalMaterial || typeof personalMaterial !== 'object' || Array.isArray(personalMaterial)) {
        return '';
    }

    const title = cleanText(personalMaterial.title, 100);
    const story = cleanText(personalMaterial.story, 1600);
    const tags = Array.isArray(personalMaterial.tags)
        ? personalMaterial.tags.map((tag) => cleanText(tag, 30)).filter(Boolean).slice(0, 8)
        : [];

    if (!title || !story) return '';
    return `Title: ${title}\nTags: ${tags.join(', ') || 'None'}\nStory: ${story}`;
}

function parseJsonContent(content) {
    if (!content) {
        return null;
    }

    try {
        return JSON.parse(content);
    } catch {
        const cleaned = String(content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }
}

function normalizeClassificationQuestions(questions) {
    return (Array.isArray(questions) ? questions : [])
        .map((question) => ({
            id: cleanText(question?.id, 64),
            prompt: cleanText(question?.prompt, 500),
            cues: Array.isArray(question?.cues)
                ? question.cues.map((cue) => cleanText(cue, 80)).filter(Boolean).slice(0, 4)
                : [],
            tags: Array.isArray(question?.tags)
                ? question.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 6)
                : [],
            seasonId: cleanText(question?.seasonId || question?.season, 30)
        }))
        .filter((question) => question.id && question.prompt);
}

function validateClassificationItems(items, knownIds) {
    const seen = new Set();

    return (Array.isArray(items) ? items : [])
        .map((item) => ({
            id: cleanText(item?.id, 64),
            motherId: cleanText(item?.motherId, 8)
        }))
        .filter((item) => {
            if (!knownIds.has(item.id) || !VALID_MOTHER_IDS.has(item.motherId) || seen.has(item.id)) {
                return false;
            }

            seen.add(item.id);
            return true;
        });
}

async function classifyBatch(apiKey, batch) {
    const questionList = JSON.stringify(
        batch.map(({ id, prompt, cues, tags, seasonId }) => ({ id, prompt, cues, tags, seasonId }))
    );
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
            model: readDeepSeekModel('DEEPSEEK_CLASSIFICATION_MODEL'),
            messages: [
                {
                    role: 'system',
                    content: 'You classify IELTS Speaking Part 2 questions into one fixed mother topic. Always return JSON only.'
                },
                {
                    role: 'user',
                    content: `把下面每道雅思口语 Part 2 题目归到固定母题之一，只允许使用 M1, M2, M3, M4, M5, M6, M7, M8。

规则：
1. 每道题最多输出一次。
2. 只输出最合适的 motherId。
3. 不要输出解释、置信度或额外字段。
4. 只输出 JSON，格式必须是：
{"classifications":[{"id":"题目id","motherId":"M1"}]}

题目列表：
${questionList}`
                }
            ],
            temperature: 0.1,
            stream: false,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek mother-classify error:', response.status, errorText);
        return { errorStatus: response.status };
    }

    const data = await response.json();
    const parsed = parseJsonContent(data.choices?.[0]?.message?.content || '');
    if (!parsed || !Array.isArray(parsed.classifications)) {
        throw new Error('Invalid classification payload');
    }

    return {
        classifications: validateClassificationItems(
            parsed.classifications,
            new Set(batch.map((question) => question.id))
        )
    };
}

async function handleMotherClassify(res, apiKey, questions) {
    if (!apiKey) {
        return res.status(503).json({
            error: '分类服务暂时不可用，请先使用本地规则。',
            code: 'classification_unavailable'
        });
    }

    const validQuestions = normalizeClassificationQuestions(questions);
    if (!validQuestions.length) {
        return res.status(400).json({ error: '没有可分类的题目，请先导入题库。' });
    }

    try {
        const classifications = [];
        for (const batch of chunkItems(validQuestions, 20)) {
            const result = await classifyBatch(apiKey, batch);
            if (result.errorStatus) {
                return res.status(result.errorStatus).json({ error: '模型服务暂时不可用，请稍后重试。' });
            }
            classifications.push(...result.classifications);
        }

        return res.json({ classifications, provider: 'deepseek' });
    } catch (error) {
        console.error('Mother classify request failed:', error);
        return res.status(500).json({ error: '分类服务出现异常，请稍后重试。' });
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: '只支持 POST 请求。' });
    }

    const body = req.body || {};
    const supportedTasks = ['model-answer', 'memory-outline', 'speaking-review', 'slot-recommend', 'mother-classify'];
    const task = supportedTasks.includes(body.task) ? body.task : 'model-answer';
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const topic = cleanText(body.topic, 500);
    const keywords = cleanText(body.keywords);
    const transcript = cleanText(body.transcript, 6000);
    const referenceAnswer = cleanText(body.referenceAnswer, 3000);
    const category = categoryLabels[body.category] || '未分类';

    if ((task === 'slot-recommend' || task === 'mother-classify')) {
        return handleMotherClassify(res, apiKey, body.questions);
    }

    if (!apiKey) {
        return res.status(500).json({ error: '服务尚未配置模型密钥，请联系管理员。' });
    }

    if (task === 'model-answer' && !topic) {
        return res.status(400).json({ error: '请填写题目。' });
    }

    if (task === 'memory-outline' && !keywords) {
        return res.status(400).json({ error: '没有可提炼的范文内容。' });
    }

    if (task === 'speaking-review' && !transcript) {
        return res.status(400).json({ error: '请先完成英文转写，再生成复盘。' });
    }

    const structuredKeywords = formatStructuredKeywords(body.structuredKeywords);
    const personalMaterial = formatPersonalMaterial(body.personalMaterial);
    const messages = task === 'memory-outline'
        ? [
            {
                role: 'system',
                content: 'You help IELTS learners memorize their own answer. Return ONLY 6-8 concise English bullet points. Each point must contain at most 10 words, preserve the answer\'s sequence, and contain no markdown styling.'
            },
            { role: 'user', content: `Answer to condense:\n${keywords}` }
        ]
        : task === 'speaking-review'
            ? [
                {
                    role: 'system',
                    content: `You are a supportive IELTS Speaking coach for a learner around Band 6. Review the learner's transcribed Part 2 response. The transcript may contain speech-recognition errors, so do not over-correct isolated words. Give concise, practical feedback in Simplified Chinese. Do NOT give a precise IELTS band score. Output plain text only, using exactly these sections: 做得好的：, 最值得改的一点：, 更自然的说法：, 下次挑战：. Give 1-2 bullets per section. Focus on content coverage, fluency, clarity, grammar, and easy-to-say alternatives.`
                },
                {
                    role: 'user',
                    content: `Question: ${topic || 'Not provided'}\nLearner transcript:\n${transcript}\n\nReference answer for context only (do not ask learner to memorize it):\n${referenceAnswer || 'Not provided'}`
                }
            ]
            : [
                {
                    role: 'system',
                    content: `You are an empathetic IELTS Speaking tutor helping a learner around Band 6 build fluency from real experiences. Write a natural, speakable IELTS Speaking Part 2 model answer based strictly on the learner's details. Do not invent specific facts when details are present. Use clear Band 6.5-7 vocabulary, a few natural discourse markers, and easy-to-reuse sentence patterns. Keep it about 170-200 words. Output ONLY the spoken answer, with no title, score, explanation, or markdown.`
                },
                {
                    role: 'user',
                    content: `Question: ${topic}\nQuestion type: ${category}\nSelected personal material (use its facts and details whenever relevant):\n${personalMaterial || 'No personal material selected.'}\nLearner's free-form notes: ${keywords || 'No notes supplied.'}\nLearner's structured details:\n${structuredKeywords || 'No structured details supplied.'}`
                }
            ];

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: readDeepSeekModel('DEEPSEEK_GENERATION_MODEL'),
                messages,
                stream: true,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API error:', response.status, errorText);
            return res.status(response.status).json({ error: '模型服务暂时不可用，请稍后重试。' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            res.write(chunk);
        }
        res.end();
    } catch (error) {
        console.error('Generate request failed:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: '生成服务出现异常，请稍后重试。' });
        }
        res.end();
    }
}
