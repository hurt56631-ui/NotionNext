// themes/heo/components/VerticalShortVideoPlayer.jsx
// 新版本：适配返回 JSON 的新版 proxy API

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';

const API_ENDPOINT = '/api/proxy'; // 我们的后端API地址
const CACHE_SIZE = 5; // 同时缓存/预加载的视频数量
const PRELOAD_THRESHOLD = 2; // 当剩余视频少于这个数时，触发新的加载

export default function VerticalShortVideoPlayer() {
  const [videos, setVideos] = useState([]); // 存储已获取的视频URL: [{id, url}]
  const [index, setIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const videoRefs = useRef([]);
  const isFetching = useRef(false); // 防止并发请求

  // 核心函数：从后端获取一批新的视频URL
  const fetchVideoUrls = useCallback(async (count) => {
    if (isFetching.current) return;
    isFetching.current = true;
    setError(null);

    const promises = Array(count).fill(0).map(() => 
        fetch(API_ENDPOINT).then(res => {
            if (!res.ok) throw new Error(`API error: ${res.statusText}`);
            return res.json();
        })
    );

    try {
      const results = await Promise.all(promises);
      const newVideos = results
        .filter(data => data && data.videoUrl)
        .map(data => ({ id: Date.now() + Math.random(), url: data.videoUrl }));

      if (newVideos.length > 0) {
        setVideos(prev => [...prev, ...newVideos]);
      } else {
        throw new Error("未能获取到任何有效的视频URL");
      }
    } catch (e) {
      console.error("获取视频URL失败:", e);
      setError(e.message);
    } finally {
      isFetching.current = false;
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchVideoUrls(CACHE_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 播放控制与预加载触发
  useEffect(() => {
    if (videos.length === 0) return;

    videoRefs.current.forEach((video, i) => {
      if (video) {
        if (i === index) {
          setIsLoading(true);
          video.play().catch(e => console.warn('自动播放被阻止:', e));
        } else {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    // 当需要时，预加载更多视频
    if (videos.length - index <= PRELOAD_THRESHOLD) {
      fetchVideoUrls(CACHE_SIZE);
    }
  }, [index, videos, fetchVideoUrls]);

  const bind = useDrag(/* ... 手势代码和之前一样 ... */);
  // ... (省略bind手势代码，和之前版本保持一致)
  const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
    if (!last || videos.length === 0) return;
    if (my < -80 || (vy > 0.6 && dy < 0)) {
      setIndex(i => Math.min(i + 1, videos.length - 1));
    } else if (my > 80 || (vy > 0.6 && dy > 0)) {
      setIndex(i => Math.max(0, i - 1));
    }
  }, { axis: 'y', pointer: { touch: true } });


  if (error && videos.length === 0) {
    return <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white/80"><p>加载视频失败</p><p className="text-sm mt-2">{error}</p><button onClick={() => fetchVideoUrls(CACHE_SIZE)} className="mt-4 px-4 py-2 bg-gray-700 rounded">重试</button></div>
  }

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden touch-action-pan-y" {...bind()}>
      <AnimatePresence initial={false}>
          {/* ... (省略渲染部分代码，和之前版本保持一致，但src直接使用video.url) ... */}
          <motion.div
            key={index}
            className="absolute inset-0 w-full h-full"
            initial={{ y: '0%' }}
            animate={{ y: `-${index * 100}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {videos.map((video, i) => (
              <div key={video.id} className="w-full h-full absolute" style={{ top: `${i * 100}%` }}>
                <video
                  ref={el => videoRefs.current[i] = el}
                  src={video.url} // 直接使用获取到的URL
                  className="w-full h-full object-contain bg-black"
                  playsInline muted={isMuted} controls={false} loop
                  onCanPlay={() => { if (i === index) setIsLoading(false); }}
                  onWaiting={() => { if (i === index) setIsLoading(true); }}
                  onEnded={() => { if (autoPlayNext && index < videos.length - 1) setIndex(i => i + 1); }}
                />
                {index === i && (
                  <div className="absolute inset-0 flex items-center justify-center p-4 z-10 pointer-events-none">
                    {isLoading && <div className="text-white/80 text-lg">加载中...</div>}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
      </AnimatePresence>

      {/* ... (省略UI控制按钮和指示器代码，和之前版本保持一致) ... */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
        <button onClick={() => setIsMuted(m => !m)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">{isMuted ? '静音' : '取消静音'}</button>
        <button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">{autoPlayNext ? '连播: 开' : '连播: 关'}</button>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {videos.slice(0, 10).map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === i ? 'bg-white scale-150' : 'bg-white/50'}`}/>)}
      </div>
    </div>
  );
}
