// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化
// 版本：2.2 (修复“有声无画”问题)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaPlay, FaForward } from 'react-icons/fa';

// 功能：从 localStorage 读取用户偏好
const getInitialState = (key, defaultValue) => {
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    const storedValue = localStorage.getItem(key);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
};

// 1. API 列表
const DEFAULT_APIS = [...new Set([
    // 视频 API
    'http://api.xingchenfu.xyz/API/hssp.php', 'http://api.xingchenfu.xyz/API/wmsc.php',
    'http://api.xingchenfu.xyz/API/tianmei.php', 'http://api.xingchenfu.xyz/API/cdxl.php',
    'http://api.xingchenfu.xyz/API/yzxl.php', 'http://api.xingchenfu.xyz/API/rwsp.php',
    'http://api.xingchenfu.xyz/API/nvda.php', 'http://api.xingchenfu.xyz/API/bsxl.php',
    'http://api.xingchenfu.xyz/API/zzxjj.php', 'http://api.xingchenfu.xyz/API/qttj.php',
    'http://api.xingchenfu.xyz/API/xqtj.php', 'http://api.xingchenfu.xyz/API/sktj.php',
    'http://api.xingchenfu.xyz/API/cossp.php', 'http://api.xingchenfu.xyz/API/xiaohulu.php',
    'https://v2.xxapi.cn/api/meinv?return=302', 'https://api.jkyai.top/API/jxhssp.php',
    // 图片 API
    'https://api.btstu.cn/sjbz/api.php', 'https://www.dmoe.cc/random.php',
    'http://api.xingchenfu.xyz/API/youhuotu.php', 'http://api.xingchenfu.xyz/API/hstp.php'
])];

// 外部 TXT 视频列表地址
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
    preloadThreshold = 4,
    useProxy = false,
    proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    
    // 状态管理
    const [isMuted, setIsMuted] = useState(() => getInitialState('player_isMuted', true));
    const [autoPlayNext, setAutoPlayNext] = useState(() => getInitialState('player_autoPlayNext', true));
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [apiStatus, setApiStatus] = useState(() => apiList.reduce((acc, api) => ({ ...acc, [api]: { failures: 0 } }), {}));
    const [showControls, setShowControls] = useState(true);

    const [windowHeight, setWindowHeight] = useState(0);
    const dragY = useMotionValue(0);
    const scale = useTransform(dragY, [0, windowHeight || 1000], [1, 0.85]);

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const preloadTriggered = useRef(new Set());

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setWindowHeight(window.innerHeight);
        }
    }, []);

    const getRandomAPI = useCallback(() => {
        const availableApis = apiList.filter(api => (apiStatus[api]?.failures || 0) < 3);
        let selectedApi;
        if (availableApis.length === 0) {
            console.warn("所有API均暂时失效，将重置失败计数并重试。");
            setApiStatus(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: { failures: 0 } }), {}));
            selectedApi = apiList[Math.floor(Math.random() * apiList.length)];
        } else {
            selectedApi = availableApis[Math.floor(Math.random() * availableApis.length)];
        }
        return { url: `${selectedApi}${selectedApi.includes('?') ? '&' : '?'}t=${Date.now()}`, originalUrl: selectedApi };
    }, [apiList, apiStatus]);
    
    const buildSrc = useCallback((url) => (useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url), [useProxy, proxyPath]);

    const getMediaType = (url, headers) => {
        const contentType = headers?.get('Content-Type');
        if (contentType) {
            if (contentType.startsWith('image/')) return 'image';
            if (contentType.startsWith('video/')) return 'video';
        }
        if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return 'image';
        return 'video';
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
            if (apiStatus[originalUrl]?.failures > 0) {
                setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: 0 } }));
            }
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        } catch (error) {
            console.error(`API [${originalUrl}] 请求失败:`, error.name === 'AbortError' ? '请求超时' : error.message);
            setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: (prev[originalUrl]?.failures || 0) + 1 } }));
            return null;
        }
    }, [getRandomAPI, apiStatus]);
    
    const fillMediaQueue = useCallback(async () => {
        const needed = cacheSize - (mediaQueue.length - page);
        if (needed <= 0) return;
        const promises = Array.from({ length: needed }, () => fetchMedia());
        const results = await Promise.all(promises);
        const newMedia = results.filter(Boolean);
        if (newMedia.length > 0) {
            setMediaQueue(prev => [...prev, ...newMedia]);
        }
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            let initialMedia = [];
            try {
                const response = await fetch(TXT_VIDEO_LIST_URL);
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(url => url.trim().match(/\.(mp4|webm|jpg|jpeg|png|gif|webp)$/i));
                    initialMedia = urls.map(url => ({
                        id: `txt-${Math.random()}`, url: url.trim(), type: getMediaType(url.trim())
                    }));
                    initialMedia.sort(() => Math.random() - 0.5);
                }
            } catch (error) {
                console.error("加载TXT视频列表失败:", error);
            }
            setMediaQueue(initialMedia);
            await fillMediaQueue();
            setIsLoading(false);
        };
        initializeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { localStorage.setItem('player_isMuted', JSON.stringify(isMuted)); }, [isMuted]);
    useEffect(() => { localStorage.setItem('player_autoPlayNext', JSON.stringify(autoPlayNext)); }, [autoPlayNext]);
    
    useEffect(() => {
        const activeIds = new Set(mediaQueue.slice(Math.max(0, page - 2), page + cacheSize).map(m => m.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!activeIds.has(id)) delete mediaRefs.current[id];
        });
    }, [page, mediaQueue, cacheSize]);

    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0 || newPage >= mediaQueue.length) {
            if (newDirection > 0) fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
        dragY.set(0);
    }, [page, mediaQueue.length, fillMediaQueue, dragY]);

    useEffect(() => {
        if (!mediaQueue[page]) {
            fillMediaQueue();
            return;
        }
        const currentItem = mediaQueue[page];
        
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl?.tagName === 'VIDEO' && !mediaEl.paused) mediaEl.pause();
        });

        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true);
                setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(e => console.warn('自动播放失败，等待用户交互。', e));
            } else {
                setIsLoading(false);
            }
        }

        let imageTimeoutId = null;
        if (currentItem.type === 'image' && autoPlayNext) {
            imageTimeoutId = setTimeout(() => paginate(1), 5000);
        }

        if (mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }
        
        return () => { if (imageTimeoutId) clearTimeout(imageTimeoutId); };
    }, [page, mediaQueue, autoPlayNext, preloadThreshold, fillMediaQueue, paginate]);
    
    const bind = useDrag(({ down, last, movement: [, my], velocity: [, vy], direction: [, dy], tap }) => {
        if (tap || !windowHeight) return;

        if (down) {
            dragY.set(my);
        } else {
            if (last && (Math.abs(my) > windowHeight / 4.5 || (vy > 0.5 && dy !== 0))) {
                paginate(my < 0 ? 1 : -1);
            } else {
                motion.animate(dragY, 0, { type: 'spring', stiffness: 300, damping: 30 });
            }
        }
    }, { axis: 'y', filterTaps: true, taps: true });
    
    const handleTogglePlay = (e) => {
        e.stopPropagation();
        const currentItem = mediaQueue[page];
        if (!currentItem || currentItem.type !== 'video') return;
        const videoEl = mediaRefs.current[currentItem.id];
        if (videoEl) {
            if (videoEl.paused) {
                videoEl.play(); setIsPaused(false);
            } else {
                videoEl.pause(); setIsPaused(true);
            }
        }
    };

    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，将自动切换。`);
        const currentPageId = mediaQueue[page]?.id;
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        if (id === currentPageId) paginate(1);
    };
    
    const handleTimeUpdate = (e) => {
        const video = e.target;
        const currentId = mediaQueue[page]?.id;
        if (!video.duration || !currentId || preloadTriggered.current.has(currentId)) return;
        if ((video.currentTime / video.duration) > 0.6) {
            if (mediaQueue.length - page <= preloadThreshold) fillMediaQueue();
            preloadTriggered.current.add(currentId);
        }
    };

    const displayControls = useCallback(() => {
        setShowControls(true);
        clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }, []);

    useEffect(() => {
        displayControls();
        return () => clearTimeout(controlsTimer.current);
    }, [page, displayControls]);

    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative overflow-hidden select-none touch-action-pan-y" 
            {...bind()}
            onClick={displayControls}
            onContextMenu={(e) => e.preventDefault()}
        >
            <AnimatePresence initial={false} custom={direction}>
                {currentMedia && (
                     <motion.div
                        key={page}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ y: { type: 'spring', stiffness: 350, damping: 40 }, opacity: { duration: 0.2 } }}
                        className="absolute inset-0 w-full h-full"
                        style={{ y: dragY, scale }}
                        onClick={handleTogglePlay}
                     >
                        {/* ✅ 修复：给 video 和 img 标签添加独立的 key，强制 React 重新创建元素，避免渲染 bug */}
                        {currentMedia.type === 'video' ? (
                            <video
                                key={currentMedia.id}
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black"
                                playsInline muted={isMuted} loop={!autoPlayNext}
                                referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)} onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                                onTimeUpdate={handleTimeUpdate}
                            />
                        ) : (
                            <img
                                key={currentMedia.id}
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black"
                                alt="media content" referrerPolicy="no-referrer"
                                onLoad={() => setIsLoading(false)}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        )}
                     </motion.div>
                )}
            </AnimatePresence>

            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-white/80 border-solid border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                        <FaPlay className="text-white/80 text-7xl drop-shadow-lg" />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/60 to-transparent z-30 flex items-center justify-center gap-5"
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={() => setIsMuted(m => !m)} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform hover:scale-110">
                    {isMuted ? <FaVolumeMute size={22}/> : <FaVolumeUp size={22}/>}
                </button>
                 <button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-3 rounded-full bg-black/50 text-white backdrop-blur-sm text-sm font-semibold transition-transform hover:scale-110">
                    {autoPlayNext ? '自动连播' : '关闭连播'}
                </button>
                 <button onClick={() => paginate(1)} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform hover:scale-110">
                     <FaForward size={18}/>
                </button>
            </motion.div>

            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 pointer-events-none">
                {mediaQueue.slice(0, 10).map((_, i) => (
                    <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${page === i ? 'bg-white scale-150' : 'bg-white/60'}`}
                    />
                ))}
            </div>
        </div>
    );
                }
