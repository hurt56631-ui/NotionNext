// themes/heo/components/VerticalShortVideoPlayer.jsx
// 最终毕业版 v1.1 (SSR 修复)：修复了 "window is not defined" 的构建错误

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay, FaForward, FaWifi } from 'react-icons/fa';

// API 列表
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
    'https://api.jkyai.top/API/jxbssp.php', 'https://api.jkyai.top/API/rmtmsp/api.php',
    'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php',
    // 图片 API
    'https://api.btstu.cn/sjbz/api.php',
    'https://www.dmoe.cc/random.php',
    'https://api.lolicon.app/setu/v2?size=regular&r18=0',
    'http://api.xingchenfu.xyz/API/youhuotu.php',
    'http://api.xingchenfu.xyz/API/hstp.php'
])];

const EXTERNAL_API_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 定义页面切换动画
const variants = {
    enter: (direction) => ({ y: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, y: '0%', opacity: 1 },
    exit: (direction) => ({ zIndex: 0, y: direction < 0 ? '100%' : '-100%', opacity: 0 })
};

// 智能重试函数
const fetchWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await fn();
            if (result) return result;
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed. Retrying...`, error);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return null;
};

// 主组件
export default function VerticalShortVideoPlayer({
    cacheSize = 12,
    preloadThreshold = 5,
    useProxy = false,
    proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
    const [apiList, setApiList] = useState(DEFAULT_APIS);
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    
    // --- ✅ 修复：将对 window 对象的访问移至 useEffect ---
    const [windowHeight, setWindowHeight] = useState(1000); // 为服务器端渲染提供一个默认高度

    useEffect(() => {
        // 这个 effect 只会在客户端执行，此时 window 对象是可用的
        setWindowHeight(window.innerHeight);
    }, []); // 空依赖数组确保只运行一次
    
    // 状态管理 (此处的 localStorage 写法是安全的，因为它在 useState 的 lazy initializer 中)
    const [isMuted, setIsMuted] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('short-video-isMuted') === 'true' : true);
    const [autoPlayNext, setAutoPlayNext] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('short-video-autoPlayNext') !== 'false' : true);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    const mediaRefs = useRef({});
    const hideControlsTimeout = useRef(null);
    const dragY = useMotionValue(0);
    // --- ✅ 修复：使用 state 中的 windowHeight 而不是直接访问 window.innerHeight ---
    const scale = useTransform(dragY, [0, windowHeight], [1, 0.8]);

    // 从外部 TXT 加载 API 列表
    useEffect(() => {
        const fetchExternalApis = async () => {
            try {
                const response = await fetch(EXTERNAL_API_LIST_URL);
                if (!response.ok) throw new Error('Network response was not ok');
                const text = await response.text();
                const externalApis = text.split('\n').map(line => line.trim()).filter(Boolean);
                if (externalApis.length > 0) {
                    setApiList(prev => [...new Set([...prev, ...externalApis])]);
                }
            } catch (error) {
                console.error('Failed to fetch external API list, using default list:', error);
            }
        };
        fetchExternalApis();
    }, []);

    // 状态持久化
    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('short-video-isMuted', isMuted); }, [isMuted]);
    useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('short-video-autoPlayNext', autoPlayNext); }, [autoPlayNext]);

    const getRandomAPI = useCallback(() => {
        const raw = apiList[Math.floor(Math.random() * apiList.length)];
        return `${raw}${raw.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }, [apiList]);

    const buildSrc = useCallback((url) => (useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url), [useProxy, proxyPath]);

    const getMediaType = (url, headers) => {
        const contentType = headers.get('Content-Type');
        if (contentType) {
            if (contentType.startsWith('image/')) return 'image';
            if (contentType.startsWith('video/')) return 'video';
        }
        if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return 'image';
        if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return 'video';
        return 'video';
    };

    const fetchMedia = useCallback(async () => {
        const fetchFn = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(getRandomAPI(), { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) return null;
            const finalUrl = response.url;
            const type = getMediaType(finalUrl, response.headers);
            const finalContentType = response.headers.get('Content-Type');
            if (finalContentType && (finalContentType.includes('text/html') || finalContentType.includes('application/json'))) {
                return null;
            }
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        };
        return fetchWithRetry(fetchFn);
    }, [getRandomAPI]);

    const fillMediaQueue = useCallback(async () => {
        const needed = cacheSize - (mediaQueue.length - page);
        if (needed <= 0) return true;
        const promises = Array.from({ length: needed }, fetchMedia);
        const results = await Promise.all(promises);
        const newMedia = results.filter(Boolean);

        if (newMedia.length > 0) {
            setMediaQueue(prev => [...prev, ...newMedia]);
            setFetchError(null);
            return true;
        } else if (mediaQueue.length === 0) {
            setFetchError('无法加载媒体资源，请检查网络连接或刷新重试。');
            return false;
        }
        return mediaQueue.length > 0;
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    const tryFillQueue = useCallback(async () => {
        setIsBuffering(true);
        setFetchError(null);
        await fillMediaQueue();
        setIsBuffering(false);
    }, [fillMediaQueue]);

    useEffect(() => {
        tryFillQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0) return;
        if (newPage >= mediaQueue.length) {
            tryFillQueue();
            return;
        }
        setPage([newPage, newDirection]);
        dragY.set(0);
    }, [page, mediaQueue.length, tryFillQueue, dragY]);

    useEffect(() => {
        const currentQueueIds = new Set(mediaQueue.map(item => item.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!currentQueueIds.has(parseFloat(id))) delete mediaRefs.current[id];
        });
    }, [mediaQueue]);

    useEffect(() => {
        if (mediaQueue.length === 0) return;
        const currentItem = mediaQueue[page];
        if (!currentItem) return;
        
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl && mediaEl.tagName === 'VIDEO' && !mediaEl.paused) mediaEl.pause();
        });

        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true);
                setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(e => console.warn('自动播放可能被浏览器阻止:', e));
            } else if (currentItem.type === 'image') {
                setIsLoading(false);
            }
        }
        
        let imageTimeoutId = null;
        if (currentItem.type === 'image' && autoPlayNext) {
            imageTimeoutId = setTimeout(() => paginate(1), 5000);
        }

        if (mediaQueue.length > 0 && mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }

        return () => { if (imageTimeoutId) clearTimeout(imageTimeoutId); };
    }, [page, mediaQueue, autoPlayNext, preloadThreshold, fillMediaQueue, paginate]);
    
    const bind = useDrag(({ down, last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
        if (down) {
            dragY.set(my);
        } else {
            // --- ✅ 修复：使用 state 中的 windowHeight ---
            if (last && (Math.abs(my) > windowHeight / 4.5 || (vy > 0.5 && dy !== 0))) {
                paginate(my < 0 ? 1 : -1);
            } else {
                motion.animate(dragY, 0, { type: 'spring', stiffness: 300, damping: 30 });
            }
        }
    }, { axis: 'y', filterTaps: true, taps: true });

    const resetHideTimeout = useCallback(() => {
        clearTimeout(hideControlsTimeout.current);
        setShowControls(true);
        hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }, []);

    useEffect(() => {
        resetHideTimeout();
        return () => clearTimeout(hideControlsTimeout.current);
    }, [page, resetHideTimeout]);

    const handleInteraction = () => { resetHideTimeout(); };

    const handleTogglePlay = () => {
        const currentItem = mediaQueue[page];
        if (!currentItem || currentItem.type !== 'video') return;
        const videoEl = mediaRefs.current[currentItem.id];
        if (videoEl) {
            if (videoEl.paused) { videoEl.play(); setIsPaused(false); }
            else { videoEl.pause(); setIsPaused(true); }
        }
    };

    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，将自动跳到下一个。`);
        const currentPageId = mediaQueue[page]?.id;
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        if (id === currentPageId) paginate(1);
    };
    
    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative overflow-hidden select-none" 
            style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}
            {...bind()}
            onClick={handleInteraction}
            onContextMenu={(e) => e.preventDefault()}
        >
            <AnimatePresence initial={false} custom={direction}>
                {currentMedia && (
                     <motion.div
                        key={page} custom={direction} variants={variants}
                        initial="enter" animate="center" exit="exit"
                        transition={{ y: { type: 'spring', stiffness: 350, damping: 40 }, opacity: { duration: 0.2 } }}
                        className="absolute inset-0 w-full h-full"
                        style={{ y: dragY, scale }}
                        onClick={(e) => { e.stopPropagation(); handleInteraction(); handleTogglePlay(); }}
                     >
                        {currentMedia.type === 'video' ? (
                            <video
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black"
                                playsInline muted={isMuted} loop={!autoPlayNext} referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)} onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : (
                            <img
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

            {(isLoading || isBuffering) && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {isBuffering && <p className="text-white mt-4">正在缓冲更多内容...</p>}
                </div>
            )}
            
            {fetchError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-40" onClick={tryFillQueue}>
                    <FaWifi className="text-white/80 text-5xl mb-4" />
                    <p className="text-white text-center mb-4">{fetchError}</p>
                    <button className="px-4 py-2 bg-white/20 text-white rounded-lg">点击重试</button>
                </div>
            )}
            
            {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                     <FaPlay className="text-white/80 text-7xl" />
                </div>
            )}

            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: '0%' }} exit={{ opacity: 0, y: '100%' }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-black/60 to-transparent z-30 flex items-center justify-center gap-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => setIsMuted(m => !m)} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
                            {isMuted ? <FaVolumeMute size={22}/> : <FaVolumeUp size={22}/>}
                        </button>
                        <button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm text-sm font-semibold">
                            {autoPlayNext ? '连播: 开' : '连播: 关'}
                        </button>
                        <button onClick={() => paginate(1)} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
                            <FaForward size={18}/>
                        </button>
                        <button onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
                            <FaUndo size={18}/>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

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
