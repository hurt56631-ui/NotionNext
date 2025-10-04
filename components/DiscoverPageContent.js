// pages/DiscoverPageContent.js

import React, { useState } from 'react';
import { LayoutBase } from '@/themes/heo'; // 假设你的基础布局组件在这里
import { Loader2, Link, PlayCircle } from 'lucide-react'; // 引入一些图标

// 视频播放器组件
const VideoPlayer = ({ embedData }) => {
    if (!embedData) return null;

    if (embedData.status === 'ok' && embedData.mode === 'embed') {
        return (
            <div className="aspect-w-16 aspect-h-9 w-full bg-black rounded-lg overflow-hidden shadow-2xl">
                {/* 
                  使用 dangerouslySetInnerHTML 来渲染从 API 获取的 HTML 字符串 (iframe)
                  注意：在生产环境中，需要确保 API 返回的 HTML 是可信的，以防止 XSS 攻击。
                  我们的 API 只返回官方 oEmbed 的 HTML，所以是安全的。
                */}
                <div dangerouslySetInnerHTML={{ __html: embedData.html }} />
            </div>
        );
    }

    if (embedData.status === 'fail') {
        return (
            <div className="text-center p-8 bg-red-50 text-red-700 rounded-lg">
                <p>链接解析失败...</p>
                <p className="text-sm mt-2">可能是私密视频或平台不支持的链接。</p>
                <a href={embedData.open} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-blue-600 hover:underline">
                    尝试直接打开
                </a>
            </div>
        );
    }

    return null;
};

// 动态页面主组件
const DiscoverPage = () => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [embedData, setEmbedData] = useState(null);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url.trim()) {
            setError('链接不能为空');
            return;
        }
        
        setIsLoading(true);
        setEmbedData(null);
        setError('');

        try {
            // 调用我们刚刚创建的后端 API
            const res = await fetch(`/api/resolve?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            
            // 将 API 返回的数据设置到 state 中
            setEmbedData(data);

        } catch (err) {
            setError('发生网络错误，请稍后再试。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LayoutBase>
            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-center mb-6">分享你的精彩瞬间</h1>
                
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-8">
                    <div className="relative flex-grow">
                        <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="粘贴 YouTube, TikTok 视频链接..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            disabled={isLoading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="flex-shrink-0 w-24 h-[50px] bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold hover:bg-blue-700 transition active:scale-95 disabled:bg-gray-400"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={24} /> : '发布'}
                    </button>
                </form>

                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <div className="mt-6">
                    {/* 如果没有视频数据，显示一个占位提示 */}
                    {!embedData && !isLoading && (
                         <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-lg">
                             <PlayCircle className="mx-auto text-gray-400" size={48} />
                             <p className="mt-4 text-gray-500">在这里预览你的视频</p>
                         </div>
                    )}
                    
                    {/* 播放器组件 */}
                    <VideoPlayer embedData={embedData} />
                </div>
            </div>
        </LayoutBase>
    );
};

export default DiscoverPage;
