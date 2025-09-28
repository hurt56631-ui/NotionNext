// components/PostContent.js
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// 动态导入 VideoEmbed，确保只在客户端加载
const VideoEmbed = dynamic(() => import('./VideoEmbed'), { 
  ssr: false, 
  loading: () => <div className="py-6 text-center text-gray-500">视频加载中…</div> 
});

const urlRegex = /(https?:\/\/[^\s<>"']+)/g;

// 视频 host 判定（你可以在这里添加更多平台）
function isVideoUrl(url) {
  const patterns = [
    /youtube\.com|youtu\.be/,
    /vimeo\.com/,
    /facebook\.com|fb\.watch/,
    /tiktok\.com|vm\.tiktok\.com/,
    /twitch\.tv/,
    /dailymotion\.com|dai\.ly/,
    /streamable\.com/,
    /bilibili\.com/, // 例如，添加B站
    /ixigua\.com/, // 例如，添加西瓜视频
  ];
  return patterns.some((r) => r.test(url));
}

// 尝试解析 YouTube ID（用于预览封面）
function getYouTubeId(url = '') {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function PostContent({ content = '', preview = false, previewLink = null }) {
  const [safeIframeHtml, setSafeIframeHtml] = useState(null);

  // 客户端处理 iframe
  useEffect(() => {
    if (typeof window === 'undefined' || !content || !content.includes('<iframe')) {
      setSafeIframeHtml(null);
      return;
    }
    import('dompurify').then((DOMPurifyModule) => {
      const DOMPurify = DOMPurifyModule.default || DOMPurifyModule;
      const clean = DOMPurify.sanitize(content, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'loading'] });
      setSafeIframeHtml(clean);
    });
  }, [content]);

  function parseSegments(text) {
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];
      const idx = match.index;
      if (idx > lastIndex) parts.push({ type: 'text', text: text.slice(lastIndex, idx) });
      parts.push({ type: isVideoUrl(url) ? 'video' : 'link', url });
      lastIndex = idx + url.length;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', text: text.slice(lastIndex) });
    return parts;
  }

  const renderTextWithNewlines = (t, key) => (
    <div key={key} className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: t.replace(/\n/g, '<br />') }} />
  );

  if (safeIframeHtml) {
    return <div className="post-content" dangerouslySetInnerHTML={{ __html: safeIframeHtml }} />;
  }

  const segments = parseSegments(content || '');

  // 如果没有检测到任何链接，直接渲染纯文本，性能更好
  if (segments.length === 1 && segments[0].type === 'text') {
    return renderTextWithNewlines(segments[0].text, 'full-text');
  }

  return (
    <div className="post-content space-y-4">
      {segments.map((seg, idx) => {
        if (seg.type === 'text') return renderTextWithNewlines(seg.text, `t-${idx}`);

        if (seg.type === 'link') {
          return (
            <a key={`l-${idx}`} href={seg.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
              {seg.url}
            </a>
          );
        }

        if (seg.type === 'video') {
          if (preview) {
            const ytId = getYouTubeId(seg.url);
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
            const Wrapper = ({ children }) => previewLink ? <Link href={previewLink} passHref><a>{children}</a></Link> : <a href={seg.url} target="_blank" rel="noopener noreferrer">{children}</a>;
            
            return (
              <Wrapper key={`v-${idx}`}>
                <div className="block overflow-hidden rounded-lg shadow-sm relative group bg-gray-200 dark:bg-gray-800">
                  {thumb ? <img src={thumb} alt="视频预览" className="w-full h-auto object-cover" /> : <div className="w-full aspect-video flex items-center justify-center"><span className="text-gray-500 dark:text-gray-300">视频预览</span></div>}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fas fa-play text-white text-4xl"></i>
                  </div>
                </div>
              </Wrapper>
            );
          } else {
            return <VideoEmbed key={`v-${idx}`} url={seg.url} />;
          }
        }
        return null;
      })}
    </div>
  );
}
