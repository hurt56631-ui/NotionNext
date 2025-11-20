// pages/api/google-tts.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { text, lang } = req.query;

  if (!text || !lang) {
    return res.status(400).json({ message: 'Missing text or lang parameter' });
  }

  // URL Encode 处理，对应 C# 的 System.Net.WebUtility.UrlEncode
  // C# 代码中提到的特殊处理 text = text.Replace(",", "%2C"); 在 JS encodeURIComponent 中通常包含，但为了保险我们手动处理
  const encodedText = encodeURIComponent(text).replace(/,/g, '%2C');

  const url = `https://www.google.com/async/translate_tts?&ttsp=tl:${lang},txt:${encodedText},spd:1&cs=0&async=_fmt:jspb`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // 完全复刻 C# 代码中的 Headers
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'priority': 'u=1, i',
        'referer': 'https://www.google.com/',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-full-version': '"124.0.6367.208"',
        'sec-ch-ua-full-version-list': '"Chromium";v="124.0.6367.208", "Google Chrome";v="124.0.6367.208", "Not-A.Brand";v="99.0.0.0"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua-platform-version': '"15.0.0"',
        'sec-ch-ua-wow64': '?0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-dos-behavior': 'Embed'
      }
    });

    if (!response.ok) {
      throw new Error(`Google API Error: ${response.status}`);
    }

    let responseBody = await response.text();

    // 对应 C# 的解析逻辑：
    // responseBody = responseBody.Substring(")]}'\n{\"translate_tts\":[\"".Length);
    // responseBody = responseBody.Substring(0, responseBody.Length - "\"]}".Length);
    
    // JS 处理这种非标准 JSON 响应
    const prefix = ")]}'\n";
    if (responseBody.startsWith(prefix)) {
      responseBody = responseBody.slice(prefix.length);
    }

    try {
      // 尝试解析 JSON 提取 base64
      const json = JSON.parse(responseBody);
      // 谷歌返回结构通常是 { translate_tts: ["base64string"] }
      if (json.translate_tts && json.translate_tts.length > 0) {
        const base64Data = json.translate_tts[0];
        const buffer = Buffer.from(base64Data, 'base64');

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(buffer);
      } else {
         throw new Error('Invalid JSON structure from Google');
      }
    } catch (e) {
       // 如果 JSON 解析失败，可能是格式变了，尝试 C# 那种硬切字符串的方法作为 fallback
       // 这里简化处理，直接报错，因为上面的 JSON parse 更稳健
       console.error("Parse Error", e);
       return res.status(500).json({ message: 'Failed to parse Google response' });
    }

  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
