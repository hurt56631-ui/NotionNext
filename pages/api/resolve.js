// pages/api/resolve.js (已修复对不带 https:// 链接的处理)

const PROVIDERS = [
    { test: /youtube\.com|youtu\.be/, oembed: 'https://www.youtube.com/oembed?url=' },
    { test: /tiktok\.com/, oembed: 'https://www.tiktok.com/oembed?url=' },
    { test: /vimeo\.com/, oembed: 'https://vimeo.com/api/oembed.json?url=' },
];

export default async function handler(req, res) {
    let { url } = req.query;

    if (!url) {
        return res.status(400).json({ status: 'fail', reason: 'URL is required' });
    }

    // ✅ 修复：智能添加协议头
    // 如果 URL 不以 http:// 或 https:// 开头，则默认添加 https://
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    try {
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, '');
        const provider = PROVIDERS.find(p => p.test(host));

        if (provider && provider.oembed) {
            try {
                const oembedUrl = `${provider.oembed}${encodeURIComponent(url)}&format=json`;
                const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });

                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    if (data.html) {
                        return res.status(200).json({ status: 'ok', mode: 'embed', html: data.html });
                    }
                }
                 // 如果 oEmbed API 返回了错误（例如 404 Not Found），我们在这里处理
                 const errorText = await oembedRes.text();
                 console.error(`oEmbed API for ${url} returned status ${oembedRes.status}: ${errorText}`);

            } catch (error) {
                console.error(`oEmbed request failed for ${url}:`, error.name);
            }
        }
        
        // 只有当所有尝试都失败后，才返回“不支持”
        return res.status(404).json({
            status: 'fail',
            reason: 'unsupported_or_private_link',
            open: url,
        });

    } catch (e) {
        return res.status(400).json({ status: 'fail', reason: 'Invalid URL format' });
    }
}
