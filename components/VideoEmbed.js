// components/VideoEmbed.js
import React from 'react';
import ReactPlayer from 'react-player';

/**
 * VideoEmbed - 一个安全、响应式的 react-player 封装
 * 适用于 react-player v2.10.1
 */
export default function VideoEmbed({
  url,
  controls = true,
  light = false, // v2.10.1 支持 light 属性，如果需要封面图可以开启
  playing = false, // 默认不自动播放
  muted = false,
  aspectRatio = '56.25%', // 16:9 视频的典型宽高比
  className = '',
  style = {},
  // 【新增】可以接受更多的 ReactPlayer props
  ...playerProps 
}) {
  const wrapperStyle = {
    position: 'relative',
    paddingTop: aspectRatio, // 控制视频的宽高比
    width: '100%',
    height: 0, // padding-top 会撑开高度
    ...style,
  };

  const playerInternalStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
  };

  // 检查 URL 是否有效，防止 ReactPlayer 渲染无效内容
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return <div className={`video-embed-wrapper ${className}`} style={{ ...wrapperStyle, paddingTop: 0, height: 'auto', minHeight: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', color: '#888' }}>
              <p>无效的视频链接</p>
           </div>;
  }

  return (
    <div className={`video-embed-wrapper ${className}`} style={wrapperStyle} aria-label="视频播放器">
      <ReactPlayer
        className="react-player"
        url={url}
        width="100%"
        height="100%"
        style={playerInternalStyle}
        controls={controls}
        light={light} // v2.10.1 支持 light 属性
        playing={playing}
        muted={muted}
        config={{
          youtube: { playerVars: { modestbranding: 1, rel: 0, showinfo: 0 } }, // 移除相关视频，简化品牌信息
          vimeo: { playerOptions: { byline: false, title: false } }, // 移除标题和作者信息
          facebook: { appId: 'YOUR_FACEBOOK_APP_ID' } // 如果有 Facebook 视频，可能需要提供 App ID
        }}
        // 将所有其他传入的 props 传递给 ReactPlayer
        {...playerProps}
      />
    </div>
  );
                                                                      }
