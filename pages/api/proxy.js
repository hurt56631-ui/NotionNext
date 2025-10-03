// pages/api/proxy.js

export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(targetUrl);
    // 简单的URL格式验证
    if (!decodedUrl.startsWith('http')) {
        throw new Error('Invalid URL format');
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL parameter' });
  }

  try {
    // 使用 fetch 发起请求
    // { cache: 'no-store' } 确保每次都是新的请求
    const response = await fetch(decodedUrl, { 
      headers: {
        // 模拟一个浏览器User-Agent，有些API可能会检查这个
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': decodedUrl // 有些视频API会检查来源
      },
      redirect: 'follow', // 告诉 fetch 自动处理301/302重定向
      cache: 'no-store'
    });

    // 如果第三方API返回错误
    if (!response.ok) {
      throw new Error(`Failed to fetch from target URL: ${response.statusText}`);
    }

    // 将视频流（ReadableStream）直接 pipe 到响应中
    // 这是最高效的方式，服务器不需要把整个视频下载完再发送
    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    // 对于Vercel等环境，使用流的方式返回
    if (response.body) {
        // Node.js 18+ and Vercel support piping ReadableStream directly
        response.body.pipe(res);
    } else {
        // Fallback for environments that don't support stream piping
        const buffer = await response.arrayBuffer();
        res.status(200).send(Buffer.from(buffer));
    }

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(502).json({ error: 'Proxy request failed', details: error.message });
  }
}

// 如果你的Next.js版本支持，可以导出一个config来关闭bodyParser
// 因为我们在处理流，不需要Next.js预先解析请求体
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // 关闭响应大小限制
  },
};
