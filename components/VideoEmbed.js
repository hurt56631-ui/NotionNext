// components/VideoEmbed.js
import React from 'react';
import ReactPlayer from 'react-player';

/**
 * VideoEmbed - 一个简单安全、响应式的 react-player 封装
 * 已根据 react-player v3 迁移指南进行修正
 */
export default function VideoEmbed({
  url,
  controls = true,
  // 【已移除】'light' 属性在 v3 中有重大变更，为避免冲突，暂时移除。
  // light = false, 
  playing = false,
  muted = false,
  aspectRatio = '56.25%', // 16:9
  className = '',
  style = {}
}) {
  const wrapperStyle = {
    position: 'relative',
    paddingTop: aspectRatio,
    width: '100%',
    ...style,
  };

  const playerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
  };

  return (
    <div className={`video-embed-wrapper ${className}`} style={wrapperStyle} aria-label="视频播放器">
      <ReactPlayer
        className="react-player"
        url={url}
        width="100%"
        height="100%"
        style={playerStyle}
        controls={controls}
        // 【已移除】不再传递 light 属性，让播放器使用 v3 的默认行为。
        // light={light}
        playing={playing}
        muted={muted}
        config={{
          youtube: { playerVars: { modestbranding: 1, rel: 0, showinfo: 0 } },
          vimeo: { playerOptions: { byline: false, title: false } },
        }}
      />
    </div>
  );
}
