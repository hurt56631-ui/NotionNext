// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流 + 边播边缓存 + 交互优化
// 版本：3.1 (手势修复 & 交互增强版)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaPlay, FaForward } from 'react-icons/fa';

// --- 功能：从 localStorage 读取用户偏好 ---
const getInitialState = (key, defaultValue) => {
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    const storedValue = localStorage.getItem(key);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
};

// 1. API 列表
const DEFAULT_APIS = [...new Set([
    // 确保有视频和图片源
    'http://api.xingchenfu.xyz/API/hssp.php', 'http://api.xingchenfu.xyz/API/wmsc.php',
    'http://api.xingchenfu.xyz/API/tianmei.php', 'http://api.xingchenfu.xyz/API/cdxl.php',
    'http://api.xingchenfu.xyz/API/yzxl.php', 'https://v2.xxapi.cn/api/meinv?return=302',
    'https://api.jkyai.top/API/jxhssp.php', 'https://api.btstu.cn/sjbz/api.php',
    'https://www.dmoe.cc/random.php', 'http://api.xingchenfu.xyz/API/youhuotu.php'
])];

// --- 外部 TXT 视频列表地址 ---
const TXT_VIDEO_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 2. 页面切换动画
const variants = {
    enter: (direction) => ({ y: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, y: '0%', opacity: 1 },
    exit: (direction) => ({ zIndex: 0, y: direction < 0 ? '100%' : '-100%', opacity: 0 })
};

// 主组件
export default function VerticalShortVideoPlayer({
    apiList = DEFAULT_APIS,
    cacheSize = 10,
    preloadThreshold = 4
}) {
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    const [isMuted, setIsMuted] = useState(() => getInitialState('player_isMuted', true));
    const [autoPlayNext, setAutoPlayNext] = useState(() => getInitialState('player_autoPlayNext', true));
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [apiStatus, setApiStatus] = useState(() => apiList.reduce((acc, api) => ({ ...acc, [api]: { failures: 0 } }), {}));
    const [showControls, setShowControls] = useState(false);
    const [isFastForwarding, setIsFastForwarding] = useState(false);
    const [showSkipButton, setShowSkipButton] = useState(false);

    // --- ✅ 修复：为“跟手”动画和SSR安全，重新引入 motion values 和 windowHeight state ---
    const [windowHeight, setWindowHeight] = useState(0);
    const dragY = useMotionValue(0);
    const scale = useTransform(dragY, [0, windowHeight || 1000], [1, 0.85]);

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const skipButtonTimer = useRef(null);
    const longPressTimer = useRef(null); // 用于长按检测

    // ✅ 修复：在客户端安全地获取窗口高度
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setWindowHeight(window.innerHeight);
        }
    }, []);

    // 保持 v3.0 稳定的 API 黑名单逻辑
    const getRandomAPI = useCallback(() => {
        const availableApis = apiList.filter(api => (apiStatus[api]?.failures || 0) < 3);
        let selectedApi = availableApis.length > 0
            ? availableApis[Math.floor(Math.random() * availableApis.length)]
            : apiList[Math.floor(Math.random() * apiList.length)];
        if (availableApis.length === 0) {
            setApiStatus(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: { failures: 0 } }), {}));
        }
        return { url: `${selectedApi}${selectedApi.includes('?') ? '&' : '?'}t=${Date.now()}`, originalUrl: selectedApi };
    }, [apiList, apiStatus]);

    const getMediaType = (url, headers) => {
        const contentType = headers?.get('Content-Type');
        if (contentType) {
            if (contentType.startsWith('image/')) return 'image';
            if (contentType.startsWith('video/')) return 'video';
        }
        return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) ? 'image' : 'video';
    };

    const fetchMedia = useCallback(async () => {
        const { url: apiUrl, originalUrl } = getRandomAPI();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('API响应失败');
            const finalUrl = response.url;
            const contentTypeHeader = response.headers.get('Content-Type');
            if (contentTypeHeader && (contentTypeHeader.includes('text/html') || contentTypeHeader.includes('application/json'))) return null;
            const type = getMediaType(finalUrl, response.headers);
            setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: 0 } }));
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        } catch (error) {
            setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: (prev[originalUrl]?.failures || 0) + 1 } }));
            return null;
        }
    }, [getRandomAPI, apiStatus]);

    const fillMediaQueue = useCallback(async () => {
        const needed = cacheSize - (mediaQueue.length - page);
        if (needed <= 0) return;
        const promises = Array.from({ length: needed }, fetchMedia);
        const results = await Promise.all(promises);
        const newMedia = results.filter(Boolean);
        if (newMedia.length > 0) setMediaQueue(prev => [...prev, ...newMedia]);
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0 || newPage >= mediaQueue.length) {
            if (newDirection > 0) fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
        dragY.set(0); // 重置“跟手”动画
    }, [page, mediaQueue.length, fillMediaQueue, dragY]);

    useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'auto'; }; }, []);

    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(TXT_VIDEO_LIST_URL);
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(Boolean).map(u => u.trim());
                    const initialMedia = urls.map(url => ({ id: `txt-${Math.random()}`, url, type: getMediaType(url) }));
                    setMediaQueue(initialMedia.sort(() => Math.random() - 0.5));
                }
            } catch (error) { console.error("加载TXT列表失败:", error); }
            await fillMediaQueue();
            setIsLoading(false);
        };
        initializeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mediaQueue[page]) return;
        const currentItem = mediaQueue[page];
        Object.values(mediaRefs.current).forEach(el => { if (el?.tagName === 'VIDEO' && !el.paused) el.pause(); });
        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true);
                setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(() => console.warn('自动播放被阻止'));
            } else { setIsLoading(false); }
        }
        if (mediaQueue.length - page <= preloadThreshold) fillMediaQueue();
    }, [page, mediaQueue, preloadThreshold, fillMediaQueue]);

    useEffect(() => {
        if (isLoading) {
            skipButtonTimer.current = setTimeout(() => setShowSkipButton(true), 3000);
        } else {
            clearTimeout(skipButtonTimer.current);
            setShowSkipButton(false);
        }
        return () => clearTimeout(skipButtonTimer.current);
    }, [isLoading]);

    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，自动切换。`);
        if (mediaQueue[page]?.id === id) paginate(1);
        setMediaQueue(prev => prev.filter(item => item.id !== id));
    };

    const handleTogglePlay = () => {
        const videoEl = mediaRefs.current[mediaQueue[page]?.id];
        if (videoEl?.tagName !== 'VIDEO') return;
        if (videoEl.paused) {
            videoEl.play();
            setIsPaused(false);
        } else {
            videoEl.pause();
            setIsPaused(true);
        }
    };
    
    // --- ✅ 修复：重构手势处理 ---
    // 1. 单击和长按处理
    const handlePointerDown = (e) => {
        // 只在屏幕右半边检测长按
        if (e.clientX > window.innerWidth / 2) {
            longPressTimer.current = setTimeout(() => {
                const videoEl = mediaRefs.current[mediaQueue[page]?.id];
                if (videoEl?.tagName === 'VIDEO' && !videoEl.paused) {
                    videoEl.playbackRate = 2.0;
                    setIsFastForwarding(true);
                }
            }, 300); // 300ms 算作长按
        }
    };

    const handlePointerUp = () => {
        clearTimeout(longPressTimer.current);
        if (isFastForwarding) {
            const videoEl = mediaRefs.current[mediaQueue[page]?.id];
            if (videoEl?.tagName === 'VIDEO') {
                videoEl.playbackRate = 1.0;
            }
            setIsFastForwarding(false);
        }
    };
    
    // 2. 滑动处理 (使用简洁可靠的 useDrag)
    const bind = useDrag(({ down, last, movement: [, my], velocity: [, vy], tap }) => {
        if (tap) {
            handleTogglePlay();
            setShowControls(s => !s);
            return;
        }
        if (down) {
            dragY.set(my);
        } else if (last) {
            if (Math.abs(my) > windowHeight / 4.5 || vy > 0.5) {
                paginate(my < 0 ? 1 : -1);
            } else {
                motion.animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 40 });
            }
        }
    }, { filterTaps: true, taps: true });

    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative select-none touch-pan-y overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp} // 鼠标移出也要取消快进
            {...bind()}
        >
            <AnimatePresence initial={false} custom={direction}>
                {currentMedia && (
                     <motion.div
                        key={page} custom={direction} variants={variants}
                        initial="enter" animate="center" exit="exit"
                        transition={{ y: { type: 'spring', stiffness: 350, damping: 40 }, opacity: { duration: 0.2 } }}
                        className="absolute inset-0 w-full h-full"
                        style={{ y: dragY, scale }} // 应用“跟手”动画
                     >
                        {currentMedia.type === 'video' ? (
                            <video
                                key={currentMedia.id} // 强制重渲染
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={currentMedia.url}
                                className="w-full h-full object-cover"
                                playsInline muted={isMuted} loop={!autoPlayNext}
                                referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)} onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : (
                            <img
                                key={currentMedia.id} // 强制重渲染
                                src={currentMedia.url}
                                className="w-full h-full object-cover"
                                alt="media" referrerPolicy="no-referrer"
                                onLoad={() => setIsLoading(false)}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        )}
                     </motion.div>
                )}
            </AnimatePresence>

            {isLoading && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-20">
                    <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin pointer-events-none"></div>
                    {showSkipButton && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); paginate(1); }}
                            className="mt-8 px-4 py-2 text-white bg-white/20 rounded-lg backdrop-blur-sm"
                        >
                            跳过
                        </button>
                    )}
                </div>
            )}
            
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                        <FaPlay className="text-white/80 text-7xl drop-shadow-lg" />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {isFastForwarding && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 p-3 bg-black/50 rounded-lg text-white z-20 pointer-events-none">
                    <FaForward />
                    <span>2.0x</span>
                </div>
            )}

            {/* ✅ 优化：底部控制栏，移除刷新按钮 */}
            <motion.div
                className="absolute bottom-5 w-full z-30 flex items-center justify-center"
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-center gap-4 p-2 bg-black/50 rounded-full backdrop-blur-sm">
                    <button onClick={() => setIsMuted(m => !m)} className="p-3 text-white">
                        {isMuted ? <FaVolumeMute size={20}/> : <FaVolumeUp size={20}/>}
                    </button>
                     <button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-3 text-white text-sm font-semibold">
                        {autoPlayNext ? '连播' : '单集'}
                    </button>
                     <button onClick={() => paginate(1)} className="p-3 text-white">
                         <FaForward size={18}/>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
