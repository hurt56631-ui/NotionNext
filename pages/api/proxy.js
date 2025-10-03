const API_URLS_INTERNAL = [
    'https://api.vvhan.com/api/girl',
    'https://api.vvhan.com/api/video',
    'https://api.vvhan.com/api/dongman',
    'http://api.xingchenfu.xyz/API/hssp.php',
    'http://api.xingchenfu.xyz/API/tianmei.php',
];

const fetchWithTimeout = (url, options, timeout = 8000) =>
    Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), timeout))
    ]);

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const { url: requestedUrl } = req.query;
    let currentApiUrls = requestedUrl ? [decodeURIComponent(requestedUrl)] : [...API_URLS_INTERNAL].sort(() => 0.5 - Math.random());

    for (const apiUrl of currentApiUrls) {
        try {
            console.log(`[Server] 请求 API: ${apiUrl}`);
            const response = await fetchWithTimeout(apiUrl, { method: 'GET', redirect: 'manual' });

            let finalVideoUrl = null;

            if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                finalVideoUrl = response.headers.get('location');
            } else if (response.ok) {
                const ct = response.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const json = await response.json();
                    finalVideoUrl = json.url || json.video || json.data || null;
                } else if (ct.includes('text/html')) {
                    const text = await response.text();
                    const match = text.match(/https?:\/\/[^'" ]+\.(mp4|m3u8)/);
                    if (match) finalVideoUrl = match[0];
                } else if (response.url.match(/\.(mp4|m3u8)$/)) {
                    finalVideoUrl = response.url;
                }
            }

            if (finalVideoUrl) {
                console.log(`[Server] 成功获取视频 URL: ${finalVideoUrl}`);
                return res.status(200).json({ videoUrl: finalVideoUrl });
            }
        } catch (err) {
            console.warn(`[Server] API ${apiUrl} 失败: ${err.message}`);
        }
    }

    return res.status(500).json({ error: '所有视频源都加载失败' });
}
