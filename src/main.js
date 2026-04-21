document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const topicInput = document.getElementById('topic');
  const keywordsInput = document.getElementById('keywords');
  const loadingDiv = document.getElementById('loading');
  const resultArea = document.getElementById('resultArea');
  const resultText = document.getElementById('resultText');

  generateBtn.addEventListener('click', async () => {
    const topic = topicInput.value.trim();
    const keywords = keywordsInput.value.trim();

    if (!topic) {
      alert('Please enter a topic!');
      return;
    }

    // UI 状态切换
    generateBtn.disabled = true;
    loadingDiv.classList.remove('hidden');
    resultArea.classList.add('hidden');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, keywords }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate');
      }

      resultText.textContent = data.text;
      resultArea.classList.remove('hidden');
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong: ' + error.message);
    } finally {
      generateBtn.disabled = false;
      loadingDiv.classList.add('hidden');
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resultText.textContent)
      .then(() => alert('Text copied to clipboard!'))
      .catch(err => console.error('Failed to copy text: ', err));
  });
});