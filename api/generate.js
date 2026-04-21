export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    const { topic, keywords } = req.body;
  
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
  
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are an expert IELTS examiner and tutor. Your task is to write a Band 8.0+ model answer for IELTS Speaking Part 2 based on the user's topic and keywords.
              
  Requirements:
  1. Length: Approximately 250-300 words (takes about 2 minutes to speak out loud).
  2. Tone: Natural, conversational, yet sophisticated. Use native-like idiomatic expressions and discourse markers (e.g., "Well, to be honest," "Moving on to," "What struck me most was...").
  3. Structure: A clear introduction, logically sequenced body based on the cues, and a solid concluding sentence.
  4. Output ONLY the spoken text. Do not include any structural commentary, tips, or intro/outro remarks from you.`
            },
            {
              role: 'user',
              content: `Topic: ${topic}\nKeywords: ${keywords || 'None provided, please improvise creatively.'}`
            }
          ],
          temperature: 0.7, // 0.7 能保持逻辑性的同时增加一些语言的自然灵活性
        })
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error?.message || 'DeepSeek API error');
      }
  
      const generatedText = data.choices[0].message.content;
      
      // 返回给前端
      res.status(200).json({ text: generatedText });
  
    } catch (error) {
      console.error('Server Error:', error);
      res.status(500).json({ error: 'Internal Server Error while communicating with DeepSeek.' });
    }
  }