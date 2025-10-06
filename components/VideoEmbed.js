// /components/VideoEmbed.js (最终修复版 - 使用 react-player)

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player/lazy'; // 使用 lazy import 以获得最佳性能

const VideoEmbed = ({ url }) => {
  // ✅ 关键修复 1: 解决 Next.js 中的 "Hydration Mismatch" 问题
  // react-player 在服务器端和客户端渲染的内容不同，会导致 Next.js 报错。
  // 我们需要确保它只在客户端被渲染。
  const [hasWindow, setHasWindow] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasWindow(true);
    }
  }, []);

  if (!url) {
    return null;
  }

  return (
    // ✅ 关键修复 2: 使用一个 wrapper div 来控制视频的宽高比，使其响应式
    <div className="relative" style={{ paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
      {hasWindow && (
        <ReactPlayer
          className="absolute top-0 left-0"
          url={url} // ✅ 直接把从 Firestore 读取的 URL (无论是 TikTok, YouTube 还是 .mp4) 传给它
          controls={true} // 显示播放控件
          width="100%"
          height="100%"
          // 增加一些常用配置
          config={{
            youtube: {
              playerVars: { showinfo: 1 }
            },
            facebook: {
              appId: '12345' // 如果需要，可以替换成你的 Facebook App ID
            }
          }}
        />
      )}
    </div>
  );
};

export default VideoEmbed;
