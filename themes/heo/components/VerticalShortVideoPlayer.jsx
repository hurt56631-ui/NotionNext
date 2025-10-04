// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化
// 版本：3.1 (根据用户需求进行交互和布局重构)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaPlay, FaRedo } from 'react-icons/fa';

// --- 功能：从 localStorage 读取用户偏好 ---
const getInitialState = (key, defaultValue) => {
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    const storedValue = localStorage.getItem(key);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
};

// 1. API 列表（保持不变）
const DEFAULT_APIS = [...new Set([
    'http://api.xingchenfu.xyz/API/hssp.php', 'http://api.xingchenfu.xyz/API/wmsc.php',
    'http://api.xingchenfu.xyz/API/tianmei.php', 'http://api.xingchenfu.xyz/API/cdxl.php',
    'http://api.xingchenfu.xyz/API/yzxl.php', 'http://api.xingchenfu.xyz/API/rwsp.php',
    'http://api.xingchenfu.xyz/API/nvda.php', 'http://api.xingchenfu.xyz/API/bsxl.php',
    'http://api.xingchenfu.xyz/API/zzxjj.php', 'http://api.xingchenfu.xyz/API/qttj.php',
    'http://api.xingchenfu.xyz/API/xqtj.php', 'http://api.xingchenfu.xyz/API/sktj.php',
    'http://api.xingchenfu.xyz/API/cossp.php', 'http://api.xingchenfu.xyz/API/xiaohulu.php',
    'http://api.xingchenfu.xyz/API/manhuay.php', 'http://api.xingchenfu.xyz/API/bianzhuang.php',
    'http://api.xingchenfu.xyz/API/jk.php', 'https://v2.xxapi.cn/api/meinv?return=302',
    'https://api.jkyai.top/API/jxhssp.php', 'https://api.jkyai.top/API/jxbssp.php',
    'https://api.jkyai.top/API/rmtmsp/api.php', 'https://api.jkyai.top/API/qcndxl.php',
    'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php', 'http://api.xingchenfu.xyz/API/wsb.php',
    'http://api.xingchenfu.xyz/API/dlzp.php', 'http://api.xingchenfu.xyz/API/xgg.php',
    'http://api.xingchenfu.xyz/API/sbkl.php', 'http://api.xingchenfu.xyz/API/ommn.php',
    'http://api.xingchenfu.xyz/API/cxldb.php', 'http://api.xingchenfu.xyz/API/xqyl.php',
    'http://api.xingchenfu.xyz/API/hstp.php', 'http://api.xingchenfu.xyz/API/boy.php',
    'http://api.xingchenfu.xyz/API/ndym.php', 'http://api.xingchenfu.xyz/API/gzlxjj.php',
    'http://api.xingchenfu.xyz/API/youhuotu.php',
])];

// --- 外部 TXT 视频列表地址 ---
const TXT_VIDEO_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 2. 页面切换动画（保持不变）
const variants = {
    enter: (direction) => ({ y: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, y: '0%', opacity: 1 },
    exit: (direction) => ({ zIndex: 0, y: direction < 0 ? '100%' : '-100%', opacity: 0 })
};

// 主组件
export default function VerticalShortVideoPlayer({
    apiList = DEFAULT_APIS,
    cacheSize = 9,
    preloadThreshold = 3,
    useProxy = false,
    proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    const [isMuted, setIsMuted] = useState(() => getInitialState('player_isMuted', true));
    const [autoPlayNext, setAutoPlayNext] = useState(() => getInitialState('player_autoPlayNext', true));
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [apiStatus, setApiStatus] = useState(() => apiList.reduce((acc, api) => ({ ...acc, [api]: { failures: 0 } }), {}));
    const [showControls, setShowControls] = useState(false);
    const [showSkipButton, setShowSkipButton] = useState(false);

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const skipButtonTimer = useRef(null);

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

    const buildSrc = useCallback((url) => {
        return useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url;
    }, [useProxy, proxyPath]);

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
    }, [getRandomAPI]);

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
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(TXT_VIDEO_LIST_URL);
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(url => url.trim().match(/\.(mp4|webm)$/));
                    const initialMedia = urls.map(url => ({ id: `txt-${Math.random()}`, url: url.trim(), type: 'video' }));
                    setMediaQueue(initialMedia.sort(() => Math.random() - 0.5));
                }
            } catch (error) {
                console.error("加载TXT视频列表失败:", error);
            }
            await fillMediaQueue();
            setIsLoading(false);
        };
        initializeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mediaQueue[page]) return;
        const currentItem = mediaQueue[page];
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl && mediaEl.tagName === 'VIDEO' && !mediaEl.paused) mediaEl.pause();
        });
        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true);
                setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(() => console.warn('自动播放被阻止'));
            } else {
                setIsLoading(false);
            }
        }
        if (mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }
    }, [page, mediaQueue, preloadThreshold, fillMediaQueue]);
    
    useEffect(() => {
        if (isLoading) {
            skipButtonTimer.current = setTimeout(() => {
                setShowSkipButton(true);
            }, 3000);
        } else {
            clearTimeout(skipButtonTimer.current);
            setShowSkipButton(false);
        }
        return () => clearTimeout(skipButtonTimer.current);
    }, [isLoading]);

    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，自动切换。`);
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        if (mediaQueue[page]?.id === id) {
           paginate(1);
        }
    };
    
    const handleScreenTap = () => {
        const currentItem = mediaQueue[page];
        if (!currentItem || currentItem.type !== 'video') return;
        const videoEl = mediaRefs.current[currentItem.id];
        if (videoEl) {
            const isCurrentlyPaused = videoEl.paused;
            if (isCurrentlyPaused) {
                videoEl.play();
                setIsPaused(false);
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
                controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
            } else {
                videoEl.pause();
                setIsPaused(true);
                if (controlsTimer.current) clearTimeout(controlsTimer.current);
            }
            setShowControls(true);
        }
    };

    // ✅ 手势处理简化：移除长按，只保留单击和滑动
    const bind = useDrag(({ tap, last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
        // 1. 处理单击
        if (tap) {
            handleScreenTap();
            return;
        }

        // 2. 处理滑动切换
        if (last && (Math.abs(my) > window.innerHeight / 4 || (vy > 0.5 && dy !== 0))) {
            paginate(my < 0 ? 1 : -1);
        }
    }, {
        axis: 'y',
        filterTaps: true,
        taps: true,
        threshold: 20,
    });

    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative select-none touch-pan-y overflow-hidden"
            {...bind()}
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
                     >
                        {currentMedia.type === 'video' ? (
                            <video
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover"
                                playsInline muted={isMuted} loop={!autoPlayNext}
                                referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)}
                                onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : (
                            <img
                                src={buildSrc(currentMedia.url)}
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
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    {showSkipButton && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); paginate(1); }}
                            className="mt-8 px-4 py-2 text-white bg-white/20 rounded-lg pointer-events-auto backdrop-blur-sm"
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

            {/* ✅ 修改：按钮移至右侧，仿抖音布局 */}
            <motion.div
                className="absolute top-1/2 right-3 -translate-y-1/2 z-30"
                animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
                <div className="flex flex-col items-center gap-6 text-white">
                    {/* 静音按钮 */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }} 
                        className="flex flex-col items-center justify-center"
                    >
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            {isMuted ? <FaVolumeMute size={22}/> : <FaVolumeUp size={22}/>}
                        </div>
                    </button>

                    {/* 连播/单集按钮 */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setAutoPlayNext(p => !p); }} 
                        className="flex flex-col items-center justify-center"
                    >
                        <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                            {autoPlayNext ? <FaRedo size={20} /> : <span className="text-xl font-bold">1</span>}
                        </div>
                        <span className="text-xs mt-1.5 font-semibold drop-shadow-md">{autoPlayNext ? '连播' : '单集'}</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
                        }
