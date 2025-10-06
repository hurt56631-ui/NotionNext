// /components/VideoEmbed.js

import React, { useEffect } from 'react';

const VideoEmbed = ({ url }) => {
  // 如果没有 URL，直接返回 null，不渲染任何东西
  if (!url) return null;

  // --- 智能判断链接类型 ---
  const isTikTok = url.includes('tiktok.com');
  const isDouyin = url.includes('douyin.com');

  // --- TikTok 脚本加载逻辑 ---
  useEffect(() => {
    // 这个 effect 只针对 TikTok 生效
    if (!isTikTok) return;
    
    // 检查脚本是否已存在，避免重复加载
    const scriptId = 'tiktok-embed-script';
    if (document.getElementById(scriptId)) {
      return;
    }

    // 创建脚本标签
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    // 组件卸载时无需移除脚本，让它一直保留
    // return () => { document.body.removeChild(script); };

  }, [isTikTok]); // 依赖项是 isTikTok，确保只在需要时运行一次

  
  // --- 抖音 (Douyin) 渲染逻辑 ---
  if (isDouyin) {
    const match = url.match(/video\/(\d+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
      return <p style={{ color: 'red', textAlign: 'center' }}>无效的抖音链接</p>;
    }

    const embedUrl = `https://www.douyin.com/embed/${videoId}`;

    // ✅ 优化：使用响应式容器包裹 iframe，适配手机和电脑
    return (
      <div style={styles.responsiveContainer}>
        <iframe
          src={embedUrl}
          style={styles.iframe}
          allow="autoplay; fullscreen"
          allowFullScreen
          title="Douyin Video Player"
        ></iframe>
      </div>
    );
  }

  // --- TikTok 渲染逻辑 ---
  if (isTikTok) {
    const match = url.match(/video\/(\d+)/);
    const videoId = match ? match[1] : null;

    if (!videoId) {
      return <p style={{ color: 'red', textAlign: 'center' }}>无效的 TikTok 链接</p>;
    }

    // ✅ SSR 兼容性处理：
    // 在服务器端渲染时 (typeof window === 'undefined')，我们只渲染一个简单的链接。
    // 因为 blockquote + script 的方式严重依赖客户端 JavaScript。
    // 这可以防止 NotionNext 在构建时出现 hydration 报错。
    if (typeof window === 'undefined') {
        return <a href={url} target="_blank" rel="noopener noreferrer">在 TikTok 上观看视频</a>;
    }

    return (
      <blockquote
        className="tiktok-embed"
        cite={url}
        data-video-id={videoId}
        style={styles.tiktokBlockquote}
      >
        <section></section>
      </blockquote>
    );
  }

  // 如果两种链接都不是，不渲染任何内容
  return null;
};

// --- 统一的样式对象 ---
const styles = {
  // ✅ 新增：用于包裹 iframe 的响应式容器
  responsiveContainer: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    paddingTop: '135%', // 抖音视频大致比例，可微调
    margin: '20px auto',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  tiktokBlockquote: {
    maxWidth: '605px',
    minWidth: '325px',
    margin: '20px auto',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
  }
};

export default VideoEmbed;
