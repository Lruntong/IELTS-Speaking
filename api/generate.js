const categoryLabels = {
    person: '人物',
    object: '物品',
    place: '地点',
    experience: '经历'
};

// 硬编码的 8 个母题格子：无论用户导入哪一季的题库，这套格子永远不变。
// AI 的 slot-recommend 任务只生成“推荐映射”，从不改变分组；分组由用户拖拽决定。
const motherSlots = [
    { id: 'elder-person', label: '人物长辈', desc: '长辈、老师、前辈等年长或资深的人（grandparent, teacher, mentor, older relative）' },
    { id: 'peer-person', label: '人物同辈', desc: '朋友、同学、室友、同龄人（friend, classmate, roommate, peer）' },
    { id: 'old-object', label: '旧物', desc: '旧物品、礼物、纪念品、长期保留的物件（old object, gift, keepsake, heirloom）' },
    { id: 'virtual-object', label: '虚拟物', desc: '应用、网站、线上服务、虚拟物品（app, website, online game, digital item）' },
    { id: 'nature-place', label: '自然地点', desc: '户外与自然环境（park, seaside, mountain, lake, garden）' },
    { id: 'indoor-place', label: '室内地点', desc: '室内空间（library, cafe, museum, room, shop）' },
    { id: 'success-experience', label: '成功经历', desc: '成就、第一次成功、值得骄傲的事（achievement, award, first success）' },
    { id: 'setback-experience', label: '挫折经历', desc: '失败、困难、低谷与克服过程（failure, challenge, difficult time）' }
];
const motherSlotIds = new Set(motherSlots.map((slot) => slot.id));

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

// AI 智能聚类：只做“推荐映射”，不改分组。
// 返回每条题目推荐的固定格子 id + 简短理由；非法 id / 非法格子会被过滤。
async function handleSlotRecommend(res, apiKey, questions) {
    const validQuestions = (Array.isArray(questions) ? questions : [])
        .map((question) => ({
            id: cleanText(question?.id, 64),
            prompt: cleanText(question?.prompt, 500),
            cues: Array.isArray(question?.cues) ? question.cues.map((cue) => cleanText(cue, 80)).filter(Boolean).slice(0, 4) : [],
            tags: Array.isArray(question?.tags) ? question.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 6) : [],
            season: cleanText(question?.season, 30)
        }))
        .filter((question) => question.id && question.prompt)
        .slice(0, 25);

    if (!validQuestions.length) {
        return res.status(400).json({ error: '没有可推荐的题目，请先导入题库。' });
    }

    const slotLines = motherSlots.map((slot) => `- ${slot.id} ${slot.label}：${slot.desc}`).join('\n');
    const questionList = JSON.stringify(validQuestions.map(({ id, prompt, cues, tags, season }) => ({ id, prompt, cues, tags, season })));

    const systemMessage = 'You are a precise IELTS Speaking Part 2 topic-mapping assistant. The 8 mother-topic slots are fixed and never change. Always reply with valid JSON only.';
    const userMessage = `雅思口语 Part 2 题库固定使用以下 8 个母题格子，它们不随题库季节变化：

${slotLines}

规则：
1. 判断依据是题干的主题对象：涉及人，先判断长辈还是同辈；涉及地点，先判断自然还是室内；涉及物品，先判断旧物还是虚拟物；涉及经历，先判断成功还是挫折。
2. 每道题只推荐一个最合适的格子；你的输出只是建议，不会移动或改变任何题目。
3. reason 用简体中文写 10-25 字，并引用题干关键词说明依据。
4. 只输出 JSON（不要 markdown 代码块），格式为：
{"recommendations":[{"id":"题目id","slot":"格子id","reason":"理由"}]}

题目列表：
${questionList}`;

    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey?.trim()}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.2,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek slot-recommend error:', response.status, errorText);
            return res.status(response.status).json({ error: '模型服务暂时不可用，请稍后重试。' });
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
            parsed = JSON.parse(content);
        } catch {
            const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            try { parsed = JSON.parse(cleaned); } catch { parsed = null; }
        }

        const rawList = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
        const knownIds = new Set(validQuestions.map((question) => question.id));
        const seen = new Set();
        const recommendations = rawList
            .map((item) => ({
                id: String(item?.id || '').trim(),
                slot: String(item?.slot || '').trim(),
                reason: cleanText(item?.reason, 80)
            }))
            .filter((item) => {
                if (!knownIds.has(item.id) || !motherSlotIds.has(item.slot) || seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });

        return res.json({ recommendations });
    } catch (error) {
        console.error('Slot recommend request failed:', error);
        return res.status(500).json({ error: '推荐服务出现异常，请稍后重试。' });
    }
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
    const supportedTasks = ['model-answer', 'memory-outline', 'speaking-review', 'slot-recommend'];
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

    if (task === 'slot-recommend') {
        return handleSlotRecommend(res, apiKey, body.questions);
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
