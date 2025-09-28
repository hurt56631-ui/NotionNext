// components/VideoEmbed.js
import React from 'react';
// 【已修改】将 'react-player/lazy' 改为 'react-player' 以适配 v3 版本
import ReactPlayer from 'react-player';

/**
 * VideoEmbed - 一个简单安全、响应式的 react-player 封装
 */
export default function VideoEmbed({
  url,
  controls = true,
  light = false,
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
        light={light}
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
