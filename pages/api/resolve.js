// pages/api/resolve.js

// 这是一个简化的链接解析器，实现了 Embed-first 策略
// 它会优先尝试使用 oEmbed 获取官方的嵌入式播放器 HTML

// 定义我们支持的平台及其 oEmbed API 端点
const PROVIDERS = [
    {
        // YouTube 链接规则: 匹配 youtube.com 或 youtu.be
        test: /youtube\.com|youtu\.be/,
        // oEmbed API 地址
        oembed: 'https://www.youtube.com/oembed?url='
    },
    {
        // TikTok 链接规则: 匹配 tiktok.com
        test: /tiktok\.com/,
        oembed: 'https://www.tiktok.com/oembed?url='
    },
    {
        // Vimeo 链接规则: 匹配 vimeo.com
        test: /vimeo\.com/,
        oembed: 'https://vimeo.com/api/oembed.json?url='
    },
    // 未来可以在这里添加更多平台, 如 Facebook, Twitter 等
];

export default async function handler(req, res) {
    // 1. 从请求中获取 URL 参数
    const { url } = req.query;

    // 如果没有提供 URL，返回 400 错误
    if (!url) {
        return res.status(400).json({ status: 'fail', reason: 'URL is required' });
    }

    try {
        // 2. 验证 URL 格式是否合法
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname.replace(/^www\./, '');

        // 3. 查找支持的平台
        const provider = PROVIDERS.find(p => p.test(host));

        // 4. 如果找到了支持的平台，并且它有 oEmbed API
        if (provider && provider.oembed) {
            try {
                // 构造完整的 oEmbed 请求 URL
                const oembedUrl = `${provider.oembed}${encodeURIComponent(url)}&format=json`;

                // 发起网络请求获取 oEmbed 数据
                const oembedRes = await fetch(oembedUrl, {
                    // 设置一个超时，防止请求卡死
                    signal: AbortSignal.timeout(5000), 
                });

                // 如果请求成功
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    
                    // 如果返回的数据中包含 html 字段 (即 iframe 代码)
                    if (data.html) {
                        // 成功！返回一个包含官方播放器 HTML 的 JSON
                        return res.status(200).json({
                            status: 'ok',
                            mode: 'embed', // 模式：嵌入式
                            html: data.html, // 播放器 HTML 代码
                        });
                    }
                }
            } catch (error) {
                // 如果 oEmbed 请求失败 (例如超时、网络错误、视频不存在等)，
                // 我们会忽略这个错误，然后继续执行下面的“回退方案”
                console.error(`oEmbed request failed for ${url}:`, error.name);
            }
        }

        // 5. 回退方案：如果以上所有方法都失败
        // (例如，平台不支持 oEmbed，或者链接是私密的)
        return res.status(404).json({
            status: 'fail',
            reason: 'unsupported_or_private_link', // 原因：不支持的链接或私密链接
            open: url, // 建议前端直接打开的原始链接
        });

    } catch (e) {
        // 如果 URL 本身格式就有问题 (e.g., "abcde")
        return res.status(400).json({ status: 'fail', reason: 'Invalid URL format' });
    }
}
