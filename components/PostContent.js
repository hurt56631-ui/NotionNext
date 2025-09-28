// components/PostContent.js
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// 动态导入 VideoEmbed 组件
const VideoEmbed = dynamic(() => import('./VideoEmbed'), {
  ssr: false,
  loading: () => <div className="py-6 text-center text-gray-500">视频加载中…</div>
});

// 正则表达式，用于匹配 URL
const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;

// 判断 URL 是否为支持的视频平台
function isVideoUrl(url) {
  const patterns = [
    /youtube\.com|youtu\.be/,
    /vimeo\.com/,
    /facebook\.com|fb\.watch/,
    /tiktok\.com|vm\.tiktok\.com/,
    /twitch\.tv/,
    /dailymotion\.com|dai\.ly/,
    /streamable\.com/,
    /bilibili\.com/,
    /ixigua\.com/,
  ];
  return patterns.some((r) => r.test(url));
}

// 专门为 YouTube 提取视频 ID 以生成缩略图
function getYouTubeId(url = '') {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function PostContent({ content = '', preview = false, previewLink = null }) {
  const [safeIframeHtml, setSafeIframeHtml] = useState(null);

  // 处理用户直接粘贴的 <iframe> 嵌入代码
  useEffect(() => {
    if (typeof window === 'undefined' || !content || !content.includes('<iframe')) {
      setSafeIframeHtml(null);
      return;
    }
    import('dompurify').then((DOMPurifyModule) => {
      const DOMPurify = DOMPurifyModule.default || DOMPurifyModule;
      const clean = DOMPurify.sanitize(content, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'loading'],
      });
      setSafeIframeHtml(clean);
    });
  }, [content]);

  // 如果内容是 iframe，则优先渲染
  if (safeIframeHtml) {
    return <div className="post-content" dangerouslySetInnerHTML={{ __html: safeIframeHtml }} />;
  }

  // 主要的渲染逻辑
  const renderContent = () => {
    // 按换行符分割成段落，并过滤掉空段落
    const paragraphs = (content || '').split('\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 0 && !preview) {
      // 如果没有内容且不是预览模式，显示原始内容以防万一
      return <p>{content}</p>;
    }

    let hasRenderedVideo = false;

    return paragraphs.map((paragraph, pIndex) => {
      // 在每个段落中寻找 URL
      const parts = paragraph.split(urlRegex).filter(part => part);

      // 找到段落中的第一个视频链接
      const videoUrlPart = parts.find(part => urlRegex.test(part) && isVideoUrl(part));

      // ===== 详情页逻辑 (preview = false) =====
      if (videoUrlPart && !preview && !hasRenderedVideo) {
        hasRenderedVideo = true; // 标记已渲染视频，确保只渲染第一个
        return <VideoEmbed key={`video-${pIndex}`} url={videoUrlPart} />;
      }

      // ===== 列表页预览逻辑 (preview = true) =====
      if (videoUrlPart && preview) {
        const ytId = getYouTubeId(videoUrlPart);
        const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
        const Wrapper = ({ children }) =>
          previewLink ? (
            <Link href={previewLink} passHref><a>{children}</a></Link>
          ) : (
            <a href={videoUrlPart} target="_blank" rel="noopener noreferrer">{children}</a>
          );

        return (
          <Wrapper key={`preview-${pIndex}`}>
            <div className="block overflow-hidden rounded-lg shadow-sm relative group bg-gray-200 dark:bg-gray-800">
              {thumb ? (
                <img src={thumb} alt="视频预览" className="w-full h-auto object-cover" />
              ) : (
                <div className="w-full aspect-video flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-300">视频预览</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fas fa-play text-white text-4xl"></i>
              </div>
            </div>
          </Wrapper>
        );
      }

      // ===== 渲染普通文本和链接的段落 =====
      // (如果本段没有视频，或者视频已在详情页渲染过，或者是在预览模式下)
      if (paragraph.trim()) {
        return (
          <p key={`p-${pIndex}`}>
            {parts.map((part, partIndex) => {
              if (urlRegex.test(part)) {
                return (
                  <a key={`a-${partIndex}`} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                    {part}
                  </a>
                );
              }
              return <span key={`s-${partIndex}`}>{part}</span>;
            })}
          </p>
        );
      }
      return null;
    });
  };

  return <div className="post-content space-y-4">{renderContent()}</div>;
}
