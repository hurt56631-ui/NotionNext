// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化
// 版本：4.0 (新增双击点赞、资源回收、智能加载等高级功能)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay, FaForward, FaHeart } from 'react-icons/fa';

// --- 功能：从 localStorage 读取用户偏好 ---
const getInitialState = (key, defaultValue) => {
    if (typeof window === 'undefined') return defaultValue;
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

const TXT_VIDEO_LIST_URL = 'https://tiktok.99980.xyz/index.txt';

const variants = {
    enter: (direction) => ({ y: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { zIndex: 1, y: '0%', opacity: 1 },
    exit: (direction) => ({ zIndex: 0, y: direction < 0 ? '100%' : '-100%', opacity: 0 })
};

export default function VerticalShortVideoPlayer({
    apiList = DEFAULT_APIS,
    cacheSize = 9,
    preloadThreshold = 3
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
    const [isInitialLoad, setIsInitialLoad] = useState(true); // ✅ 新增：用于首次加载动画
    const [hearts, setHearts] = useState([]); // ✅ 新增：用于双击点赞动画

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const autoSkipTimer = useRef(null);
    const lastTapTime = useRef(0); // 用于判断双击

    // ... (API获取和媒体类型判断逻辑保持不变)
    const getRandomAPI = useCallback(() => { /* ... */ }, [apiList, apiStatus]);
    const getMediaType = (url, headers) => { /* ... */ };
    const fetchMedia = useCallback(async () => { /* ... */ }, [getRandomAPI, apiStatus]);
    const fillMediaQueue = useCallback(async () => { /* ... */ }, [cacheSize, mediaQueue.length, page, fetchMedia]);
    const buildSrc = (url) => url; // 简化，默认不走代理

    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0 || newPage >= mediaQueue.length) {
            if (newDirection > 0) fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
    }, [page, mediaQueue.length, fillMediaQueue]);

    // ✅ 优化：在组件挂载时处理全局样式和事件
    useEffect(() => {
        document.body.style.overflow = 'hidden'; // 隐藏页面滚动条
        const handleContextMenu = (e) => e.preventDefault(); // ✅ 新增：全局禁用右键菜单
        document.addEventListener('contextmenu', handleContextMenu);
        return () => {
            document.body.style.overflow = 'auto'; // 恢复滚动条
            document.removeEventListener('contextmenu', handleContextMenu); // 移除监听
        };
    }, []);

    // ✅ 优化：将用户偏好设置存入 localStorage
    useEffect(() => { localStorage.setItem('player_isMuted', JSON.stringify(isMuted)); }, [isMuted]);
    useEffect(() => { localStorage.setItem('player_autoPlayNext', JSON.stringify(autoPlayNext)); }, [autoPlayNext]);

    // ✅ 新功能：资源回收，清理不在视野范围内的媒体引用
    useEffect(() => {
        const activeIds = new Set(mediaQueue.slice(Math.max(0, page - 3), page + 3).map(m => m.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!activeIds.has(id)) {
                delete mediaRefs.current[id];
            }
        });
    }, [page, mediaQueue]);

    // 初始化加载
    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            setShowControls(true); // ✅ 新增：首次进入时显示控件
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
    
    // 播放和预加载核心逻辑
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
                currentMediaRef.play().catch(() => console.warn('自动播放被阻止'));
            } else {
                setIsLoading(false);
            }
        }
        if (mediaQueue.length - page <= preloadThreshold) fillMediaQueue();
    }, [page, mediaQueue, preloadThreshold, fillMediaQueue]);

    // ✅ 优化：智能加载，超时自动跳过
    useEffect(() => {
        clearTimeout(autoSkipTimer.current);
        if (isLoading) {
            autoSkipTimer.current = setTimeout(() => {
                if (isLoading) { // 再次确认，防止已加载完成
                    console.log("加载超时，自动切换到下一个视频。");
                    paginate(1);
                }
            }, 3000); // 3秒超时
        }
        return () => clearTimeout(autoSkipTimer.current);
    }, [isLoading, paginate]);

    const handleMediaError = (id) => { /* ... */ };

    // ✅ 新功能：处理双击点赞
    const handleDoubleClick = (e) => {
        const newHeart = {
            id: Date.now(),
            x: e.clientX,
            y: e.clientY,
        };
        setHearts(currentHearts => [...currentHearts, newHeart]);
        // 1秒后移除爱心，保持DOM清洁
        setTimeout(() => {
            setHearts(currentHearts => currentHearts.filter(h => h.id !== newHeart.id));
        }, 1000);
    };

    // ✅ 优化：统一手势处理
    const bind = useDrag(({ down, tap, last, movement: [, my], velocity: [, vy], direction: [, dy], event, initial: [ix], dragging }) => {
        event.stopPropagation();
        const videoEl = mediaRefs.current[mediaQueue[page]?.id];

        if (tap) {
            const now = Date.now();
            if (now - lastTapTime.current < 300) { // 判断为双击
                handleDoubleClick(event);
                lastTapTime.current = 0; // 重置计时，防止三击
            } else { // 单击
                // ... (单击逻辑)
            }
            lastTapTime.current = now;
            return;
        }

        const isRightSide = ix > window.innerWidth / 2;
        if (down && isRightSide && !dragging) {
             if (!isFastForwarding && videoEl?.tagName === 'VIDEO') {
                videoEl.playbackRate = 2.0;
                setIsFastForwarding(true);
            }
        }

        if (last) {
            if (isFastForwarding && videoEl?.tagName === 'VIDEO') {
                videoEl.playbackRate = 1.0;
                setIsFastForwarding(false);
            }
            if ((Math.abs(my) > window.innerHeight / 4 || (vy > 0.5 && dy !== 0))) {
                paginate(my < 0 ? 1 : -1);
            }
        }
    }, { filterTaps: true, taps: true, threshold: 20 });

    const currentMedia = mediaQueue[page];

    return (
        <div className="w-full h-screen bg-black relative select-none touch-pan-y overflow-hidden" {...bind()}>
            <AnimatePresence initial={false} custom={direction}>
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
                                playsInline muted={isMuted} loop={!autoPlayNext}
                                onCanPlay={() => {
                                    setIsLoading(false);
                                    if (isInitialLoad) setIsInitialLoad(false);
                                }}
                                onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : ( <img /* ... */ /> )}
                     </motion.div>
                )}
            </AnimatePresence>

            {/* ✅ 新功能：双击点赞动画渲染 */}
            <AnimatePresence>
                {hearts.map(heart => (
                    <motion.div
                        key={heart.id}
                        className="absolute z-40 pointer-events-none"
                        style={{ top: heart.y - 50, left: heart.x - 50 }}
                        initial={{ opacity: 1, scale: 0.8 }}
                        animate={{ opacity: 0, scale: 2, y: -100 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                    >
                        <FaHeart className="text-red-500 text-8xl drop-shadow-lg" />
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* ✅ 优化：加载与首次进入动画 */}
            <AnimatePresence>
            {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 pointer-events-none z-20">
                    {isInitialLoad ? (
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1, transition: { delay: 0.3 } }}
                            className="text-2xl font-bold text-white tracking-widest"
                        >
                            发现精彩
                        </motion.h1>
                    ) : (
                        <div className="w-16 h-16 border-4 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>

            {/* ... (暂停图标, 快进提示 UI 保持不变) ... */}

            {/* ✅ 优化：底部控制栏 */}
            <motion.div
                className="absolute bottom-5 w-full z-30 flex items-center justify-center"
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
                <div className="flex items-center justify-center gap-5 p-2 bg-black/50 rounded-full backdrop-blur-sm">
                    {/* ... (按钮) ... */}
                </div>
            </motion.div>
        </div>
    );
}
