// lib/aiUtils.js

// --- TTS 功能 ---
const ttsCache = new Map();

export const preloadTTS = async (text) => {
  if (!text || ttsCache.has(text)) return;
  try {
    // 你可以根据需要调整这里的TTS API参数
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TTS API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) {
    console.error(`预加载TTS "${text}" 失败:`, error);
  }
};

export const playCachedTTS = (text) => {
  if (ttsCache.has(text)) {
    ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error));
  } else {
    preloadTTS(text).then(() => {
      if (ttsCache.has(text)) {
        ttsCache.get(text).play().catch(error => console.error("TTS playback failed:", error));
      }
    });
  }
};


// --- AI 翻译功能 ---
export const callAIHelper = async (prompt, textToTranslate, apiKey, apiEndpoint, model) => {
  if (!apiKey || !apiEndpoint) {
    throw new Error("请在设置中配置AI翻译接口地址和密钥。");
  }
  const fullPrompt = `${prompt}\n\n以下是需要翻译的文本：\n"""\n${textToTranslate}\n"""`;
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: fullPrompt }]
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AI接口请求失败: ${response.status} ${errorBody}`);
    }
    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    // 如果返回格式不符合预期，返回原始数据以供调试
    return JSON.stringify(data);
  } catch (error) {
    console.error("调用AI翻译失败:", error);
    throw error;
  }
};

export const parseSingleTranslation = (text) => {
  // 优化后的解析，更健壮
  const translationMatch = text.match(/\*\*(.*?)\*\*/s);
  const backTranslationMatch = text.match(/回译[:：\s]*(.*)/is);

  if (translationMatch && backTranslationMatch) {
    return {
      translation: translationMatch[1].trim(),
      backTranslation: backTranslationMatch[1].trim()
    };
  }

  // 如果严格格式匹配失败，尝试一个更宽松的备用方案
  const lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length > 0) {
      return {
          translation: lines[0].replace(/\*\*/g, '').trim(),
          backTranslation: lines.length > 1 ? lines[1].replace(/回译[:：\s]*/, '').trim() : "解析回译失败"
      }
  }

  return { translation: text, backTranslation: "解析失败" };
};
