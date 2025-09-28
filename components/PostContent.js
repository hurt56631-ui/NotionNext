// components/PostContent.js (最终版，智能转换 TikTok 链接)

import React, { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const VideoEmbed = dynamic(() => import('./VideoEmbed'), { ssr: false });

// 【修改】解析函数现在会返回视频的类型和 ID
const parseVideoInfo = (text = '') => {
  if (!text) return null;
  const lines = text.split('\n');
  for (const line of lines) {
    const url = line.trim();
    const urlRegex = /(https?:\/\/[^\s<>"'()]+)/;
    const match = url.match(urlRegex);

    if (match) {
      const potentialUrl = match[0];

      // 1. 检查是否为 TikTok 链接
      const tiktokMatch = potentialUrl.match(/tiktok\.com\/.*\/video\/(\d+)/);
      if (tiktokMatch && tiktokMatch[1]) {
        return { type: 'tiktok', url: potentialUrl, videoId: tiktokMatch[1] };
      }

      // 2. 检查是否为 YouTube 链接
      const youtubeMatch = potentialUrl.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (youtubeMatch && youtubeMatch[1]) {
        return { type: 'youtube', url: potentialUrl, videoId: youtubeMatch[1] };
      }

      // 3. 检查其他普通视频平台
      const otherVideoPatterns = [ /vimeo\.com/, /bilibili\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/ ];
      if (otherVideoPatterns.some(p => p.test(potentialUrl))) {
        return { type: 'other', url: potentialUrl };
      }
    }
  }
  return null;
};


export default function PostContent({ post, preview = false }) {
  // 【修改】使用新的、更强大的解析函数
  const videoInfo = useMemo(() => parseVideoInfo(post.content), [post.content]);

  // 判断内容是否为用户直接粘贴的 TikTok 嵌入代码
  const isPastedTikTokEmbed = post.content?.includes('class="tiktok-embed"');

  // 【核心逻辑】判断是否需要加载 TikTok 的官方脚本
  const needsTikTokScript = videoInfo?.type === 'tiktok' || isPastedTikTokEmbed;

  // 处理 TikTok 脚本加载的 Effect
  useEffect(() => {
    if (needsTikTokScript && typeof window !== 'undefined') {
      if (!document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.tiktok.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [needsTikTokScript]);

  // 1. 如果是 TikTok 链接 或 嵌入代码，统一处理
  if (needsTikTokScript) {
    // 动态生成 TikTok 嵌入式 HTML
    const tiktokEmbedHtml = isPastedTikTokEmbed ? post.content : `
      <blockquote class="tiktok-embed" cite="${videoInfo.url}" data-video-id="${videoInfo.videoId}" style="max-width: 605px; min-width: 325px;">
        <section></section>
      </blockquote>
    `;

    // 在详情页直接渲染
    if (!preview) {
        return <div dangerouslySetInnerHTML={{ __html: tiktokEmbedHtml }} />;
    }
    // 在列表页，显示一个可点击的占位符
    return (
        <Link href={`/community/${post.id}`} passHref>
            <a className="block p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center text-gray-600 dark:text-gray-300">
                包含一个 TikTok 视频，点击查看
            </a>
        </Link>
    )
  }

  // ===== 以下是处理 YouTube 和其他平台链接的逻辑 =====

  // 2. 详情页逻辑 (非 TikTok)
  if (!preview) {
    return videoInfo?.url ? <VideoEmbed url={videoInfo.url} /> : (
      <div className="prose dark:prose-invert max-w-none">
        {(post.content || '').split('\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    );
  }

  // 3. 列表页预览逻辑 (非 TikTok)
  if (videoInfo?.type === 'youtube') {
    return (
      <Link href={`/community/${post.id}`} passHref>
        <a className="block relative w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden group mt-2">
          <img src={`https://i.ytimg.com/vi/${videoInfo.videoId}/hqdefault.jpg`} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30"><i className="fas fa-play text-white text-4xl" /></div>
        </a>
      </Link>
    );
  }
  
  if (videoInfo?.type === 'other') {
     return (
      <Link href={`/community/${post.id}`} passHref>
        <a className="block relative w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden group mt-2">
           <div className="w-full h-full flex items-center justify-center"><span className="text-gray-500 dark:text-gray-400">观看视频</span></div>
           <div className="absolute inset-0 flex items-center justify-center bg-black/30"><i className="fas fa-play text-white text-4xl" /></div>
        </a>
      </Link>
    );
  }

  // 4. 如果没有任何视频，显示纯文本摘要
  return (
    <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">
      {post.content}
    </p>
  );
}
