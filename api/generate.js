const categoryLabels = {
    person: '人物',
    object: '物品',
    place: '地点',
    experience: '经历'
};

function cleanText(value, limit = 1200) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: '只支持 POST 请求。' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
        return res.status(500).json({ error: '服务尚未配置模型密钥，请联系管理员。' });
    }

    const body = req.body || {};
    const supportedTasks = ['model-answer', 'memory-outline', 'speaking-review'];
    const task = supportedTasks.includes(body.task) ? body.task : 'model-answer';
    const topic = cleanText(body.topic, 500);
    const keywords = cleanText(body.keywords);
    const transcript = cleanText(body.transcript, 6000);
    const referenceAnswer = cleanText(body.referenceAnswer, 3000);
    const category = categoryLabels[body.category] || '未分类';

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
                'Authorization': `Bearer ${apiKey?.trim()}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
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

        // 设置 SSE 响应头
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
