// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化
// 版本：5.0 (功能完整版 - 多样化点赞、自动跳过、默认有声等)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay, FaForward, FaHeart, FaThumbsUp, FaStar } from 'react-icons/fa';

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
'http://api.xingchenfu.xyz/API/wsb.php', 'http://api.xingchenfu.xyz/API/xgg.php',
 'http://api.xingchenfu.xyz/API/ommn.php',
])];

// --- 外部 TXT 视频列表地址 ---
const TXT_VIDEO_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 2. 页面切换动画
const variants = {
    enter: (direction) => ({ y: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, y: '0%', opacity: 1 },
    exit: (direction) => ({ zIndex: 0, y: direction < 0 ? '100%' : '-100%', opacity: 0 })
};

// ✅ 新增：多样化的点赞图标
const likeIcons = [
    { Icon: FaHeart, color: '#ff0050' },
    { Icon: FaThumbsUp, color: '#00a8ff' },
    { Icon: FaStar, color: '#ffc107' }
];

export default function VerticalShortVideoPlayer({
    apiList = DEFAULT_APIS,
    cacheSize = 9,
    preloadThreshold = 3
}) {
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    const [isMuted, setIsMuted] = useState(() => getInitialState('player_isMuted', false)); // ✅ 改为默认有声
    const [autoPlayNext, setAutoPlayNext] = useState(() => getInitialState('player_autoPlayNext', true));
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [apiStatus, setApiStatus] = useState(() => apiList.reduce((acc, api) => ({ ...acc, [api]: { failures: 0 } }), {}));
    const [showControls, setShowControls] = useState(false);
    const [isFastForwarding, setIsFastForwarding] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [likes, setLikes] = useState([]); // 存储点赞动画

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const autoSkipTimer = useRef(null);
    const lastTapTime = useRef(0);

    const getRandomAPI = useCallback(() => {
        const availableApis = apiList.filter(api => (apiStatus[api]?.failures || 0) < 3);
        let selectedApi = availableApis.length > 0
            ? availableApis[Math.floor(Math.random() * availableApis.length)]
            : apiList[Math.floor(Math.random() * apiList.length)];
        if (availableApis.length === 0) {
            console.warn("所有API暂时失效，将重置计数并重试。");
            setApiStatus(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: { failures: 0 } }), {}));
        }
        return { url: `${selectedApi}${selectedApi.includes('?') ? '&' : '?'}t=${Date.now()}`, originalUrl: selectedApi };
    }, [apiList, apiStatus]);
    
    const buildSrc = (url) => url; // 简化处理，默认不走代理

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
            if (contentTypeHeader && (contentTypeHeader.includes('text/html') || contentTypeHeader.includes('application/json'))) {
                 return null;
            }
            const type = getMediaType(finalUrl, response.headers);
            setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: 0 } }));
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        } catch (error) {
            console.error(`API [${originalUrl}] 请求失败:`, error.message);
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
        if (newMedia.length > 0) {
            setMediaQueue(prev => [...prev, ...newMedia]);
        }
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0 || newPage >= mediaQueue.length) {
            if (newDirection > 0) fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
    }, [page, mediaQueue.length, fillMediaQueue]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const handleContextMenu = (e) => e.preventDefault();
        document.addEventListener('contextmenu', handleContextMenu);
        return () => {
            document.body.style.overflow = 'auto';
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, []);

    useEffect(() => { localStorage.setItem('player_isMuted', JSON.stringify(isMuted)); }, [isMuted]);
    useEffect(() => { localStorage.setItem('player_autoPlayNext', JSON.stringify(autoPlayNext)); }, [autoPlayNext]);

    useEffect(() => {
        const activeIds = new Set(mediaQueue.slice(Math.max(0, page - 3), page + 3).map(m => m.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!activeIds.has(String(id))) { // 确保类型匹配
                delete mediaRefs.current[id];
            }
        });
    }, [page, mediaQueue]);

    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            setShowControls(true);
            try {
                const response = await fetch(TXT_VIDEO_LIST_URL);
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(url => url.trim().match(/\.(mp4|webm)$/));
                    const initialMedia = urls.map(url => ({ id: `txt-${Math.random()}`, url: url.trim(), type: 'video' }));
                    setMediaQueue(initialMedia.sort(() => Math.random() - 0.5));
                }
            } catch (error) { console.error("加载TXT视频列表失败:", error); }
            await fillMediaQueue();
        };
        initializeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    useEffect(() => {
        if (!mediaQueue[page]) return;
        const currentItem = mediaQueue[page];
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl?.tagName === 'VIDEO' && !mediaEl.paused) mediaEl.pause();
        });
        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true); setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(() => console.warn('自动播放被阻止，等待用户交互。'));
            } else {
                setIsLoading(false);
            }
        }
        if (mediaQueue.length - page <= preloadThreshold) fillMediaQueue();
    }, [page, mediaQueue, preloadThreshold, fillMediaQueue]);

    // ✅ 优化：加载超时自动切换
    useEffect(() => {
        clearTimeout(autoSkipTimer.current);
        if (isLoading) {
            autoSkipTimer.current = setTimeout(() => {
                if (isLoading) { // 双重检查，确保在定时器触发时仍然在加载
                    console.warn("加载超时，自动切换到下一个视频。");
                    paginate(1);
                }
            }, 5000); // 5秒超时
        }
        return () => clearTimeout(autoSkipTimer.current);
    }, [isLoading, paginate]);

    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，自动切换。`);
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        if (mediaQueue[page]?.id === id) {
           paginate(1);
        }
    };

    const handleDoubleClick = (e) => {
        const { Icon, color } = likeIcons[Math.floor(Math.random() * likeIcons.length)];
        const newLike = {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
            IconComponent: Icon,
            color: color,
            rotation: (Math.random() - 0.5) * 40 // -20 to 20 degrees
        };
        setLikes(currentLikes => [...currentLikes, newLike]);
        setTimeout(() => {
            setLikes(currentLikes => currentLikes.filter(l => l.id !== newLike.id));
        }, 1200);
    };

    const bind = useDrag(({ down, tap, last, movement: [, my], velocity: [, vy], direction: [, dy], event, initial: [ix], dragging }) => {
        event.stopPropagation();
        const videoEl = mediaRefs.current[mediaQueue[page]?.id];

        if (tap) {
            const now = Date.now();
            if (now - lastTapTime.current < 300) { // 双击
                handleDoubleClick(event);
                lastTapTime.current = 0;
            } else { // 单击
                const currentItem = mediaQueue[page];
                if (videoEl && currentItem.type === 'video') {
                    if (videoEl.paused) {
                        videoEl.play();
                        setIsPaused(false);
                        controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
                    } else {
                        videoEl.pause();
                        setIsPaused(true);
                        clearTimeout(controlsTimer.current);
                    }
                    setShowControls(true);
                }
            }
            lastTapTime.current = now;
            return;
        }

        const isRightSide = ix > window.innerWidth / 2;
        if (down && isRightSide && !dragging && !isFastForwarding && videoEl?.tagName === 'VIDEO') {
            videoEl.playbackRate = 2.0;
            setIsFastForwarding(true);
        }

        if (last) {
            if (isFastForwarding && videoEl?.tagName === 'VIDEO') {
                videoEl.playbackRate = 1.0;
                setIsFastForwarding(false);
            }
            if (Math.abs(my) > window.innerHeight / 4 || (vy > 0.5 && dy !== 0)) {
                paginate(my < 0 ? 1 : -1);
            }
        }
    }, { filterTaps: true, taps: true, threshold: 20 });

    const currentMedia = mediaQueue[page];

    return (
        <div className="w-full h-screen bg-black relative select-none touch-pan-y overflow-hidden" {...bind()}>
            <AnimatePresence>
                {currentMedia && (
                     <motion.div
                        key={page} custom={direction} variants={variants}
                        initial="enter" animate="center" exit="exit"
                        transition={{ y: { type: 'spring', stiffness: 350, damping: 40 }, opacity: { duration: 0.2 } }}
                        className="absolute inset-0 w-full h-full"
                     >
                        {currentMedia.type === 'video' ? (
                            <video
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover"
                                playsInline muted={isMuted} loop={!autoPlayNext} referrerPolicy="no-referrer"
                                onCanPlay={() => {
                                    setIsLoading(false);
                                    if (isInitialLoad) setIsInitialLoad(false);
                                }}
                                onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : (
                            <img
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover"
                                alt="media content" referrerPolicy="no-referrer"
                                onLoad={() => {
                                    setIsLoading(false);
                                    if (isInitialLoad) setIsInitialLoad(false);
                                }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        )}
                     </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {likes.map(({ id, x, y, IconComponent, color, rotation }) => (
                    <motion.div
                        key={id} className="absolute z-40 pointer-events-none"
                        style={{ top: y, left: x, color: color }}
                        initial={{ opacity: 1, scale: 0, x: '-50%', y: '-50%', rotate: 0 }}
                        animate={{ opacity: 0, scale: 2.5, y: '-500%', rotate: rotation }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    >
                        <IconComponent className="text-8xl drop-shadow-lg" />
                    </motion.div>
                ))}
            </AnimatePresence>

            <AnimatePresence>
            {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none z-30">
                    {isInitialLoad ? (
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1, transition: { delay: 0.3 } }}
                            className="text-2xl font-bold text-white tracking-widest drop-shadow-lg"
                        >
                            发现精彩
                        </motion.h1>
                    ) : (
                        <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <FaPlay className="text-white/80 text-7xl drop-shadow-lg" />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {isFastForwarding && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 p-3 bg-black/50 rounded-lg text-white z-20 pointer-events-none">
                    <FaForward /> <span>2.0x</span>
                </div>
            )}

            <motion.div
                className="absolute bottom-5 w-full z-30 flex items-center justify-center"
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
                <div className="flex items-center justify-center gap-5 p-2 bg-black/50 rounded-full backdrop-blur-sm">
                    <button onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }} className="p-3 text-white">
                        {isMuted ? <FaVolumeMute size={20}/> : <FaVolumeUp size={20}/>}
                    </button>
                     <button onClick={(e) => { e.stopPropagation(); setAutoPlayNext(p => !p); }} className="px-4 py-3 text-white text-sm font-semibold">
                        {autoPlayNext ? '连播' : '单集'}
                    </button>
                     <button onClick={(e) => { e.stopPropagation(); window.location.reload(); }} className="p-3 text-white">
                         <FaUndo size={18}/>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
