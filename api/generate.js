export default async function handler(req, res) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    if (req.method !== 'POST') return res.status(405).end();

    console.log("--- Starting API Request ---"); // 日志1

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
                    { role: 'system', content: `You are an expert IELTS examiner and tutor. Your task is to write a Band 8.0+ model answer for IELTS Speaking Part 2 based on the user's topic and keywords.
          Requirements:
          1. Length: Approximately 180-220 words (takes about 1.5 minutes to speak out loud).
          2. Tone: Natural, conversational, yet sophisticated. Use native-like idiomatic expressions and discourse markers (e.g., "Well, to be honest," "Moving on to," "What struck me most was...").
          3. Structure: A clear introduction, logically sequenced body based on the cues, and a solid concluding sentence.
          4. Output ONLY the spoken text. Do not include any structural commentary, tips, or intro/outro remarks from you.` },
                    { role: 'user', content: `Topic: ${req.body.topic}\nKeywords: ${req.body.keywords || 'None provided, please improvise creatively.'}` }
                ],
                stream: true,
                temperature: 0.7
            })
        });

        console.log("Response Status:", response.status); // 日志2：看这里是否显示 200

        if (!response.ok) {
            const errorText = await response.text();
            console.error("DeepSeek API Error Payload:", errorText); // 日志3：看这里具体的报错内容
            return res.status(response.status).send(errorText);
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log("--- Stream Finished ---"); // 日志4
                break;
            }
            const chunk = decoder.decode(value);
            console.log("Chunk received!"); // 日志5
            res.write(chunk);
        }
        res.end();

    } catch (error) {
        console.error('Fetch Fatal Error:', error); // 日志6：网络不通会跳到这里
        res.status(500).end();
    }
}