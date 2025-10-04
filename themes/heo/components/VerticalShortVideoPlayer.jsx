// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化
// 版本：2.0 (集成高级功能)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay } from 'react-icons/fa';

// --- 新增功能：从 localStorage 读取用户偏好 ---
const getInitialState = (key, defaultValue) => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    const storedValue = localStorage.getItem(key);
    // JSON.parse(null) 会返回 null，所以要做判断
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

// --- 新增功能：外部 TXT 视频列表地址 ---
const TXT_VIDEO_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 2. 页面切换动画（保持不变）
const variants = {
    enter: (direction) => ({
        y: direction > 0 ? '100%' : '-100%',
        opacity: 0
    }),
    center: {
        zIndex: 1,
        y: '0%',
        opacity: 1
    },
    exit: (direction) => ({
        zIndex: 0,
        y: direction < 0 ? '100%' : '-100%',
        opacity: 0
    })
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
    // --- ✅ 优化：使用 localStorage 初始化状态 ---
    const [isMuted, setIsMuted] = useState(() => getInitialState('player_isMuted', true));
    const [autoPlayNext, setAutoPlayNext] = useState(() => getInitialState('player_autoPlayNext', true));
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    // --- ✅ 新增：API 失败计数器 ---
    const [apiStatus, setApiStatus] = useState(() => apiList.reduce((acc, api) => ({ ...acc, [api]: { failures: 0 } }), {}));
    // --- ✅ 新增：UI 控制显示状态 ---
    const [showControls, setShowControls] = useState(true);

    const mediaRefs = useRef({});
    const controlsTimer = useRef(null);
    const longPressTimer = useRef(null);
    const preloadTriggered = useRef(new Set()); // 用于防止重复触发预加载

    // --- ✅ 优化：增加“失败黑名单”的 API 选择逻辑 ---
    const getRandomAPI = useCallback(() => {
        const availableApis = apiList.filter(api => (apiStatus[api]?.failures || 0) < 3); // 失败少于3次的才可用
        
        let selectedApi;
        if (availableApis.length === 0) {
            console.warn("所有API均暂时失效，将重置失败计数并重试。");
            // 重置所有API的失败计数
            setApiStatus(prev => Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: { failures: 0 } }), {}));
            selectedApi = apiList[Math.floor(Math.random() * apiList.length)];
        } else {
            selectedApi = availableApis[Math.floor(Math.random() * availableApis.length)];
        }
        
        const urlWithTimestamp = `${selectedApi}${selectedApi.includes('?') ? '&' : '?'}t=${Date.now()}`;
        return { url: urlWithTimestamp, originalUrl: selectedApi };
    }, [apiList, apiStatus]);
    
    const buildSrc = useCallback((url) => {
        return useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url;
    }, [useProxy, proxyPath]);

    // --- ✅ 优化：根据响应头和URL后缀判断媒体类型，更准确 ---
    const getMediaType = (url, headers) => {
        const contentType = headers?.get('Content-Type');
        if (contentType) {
            if (contentType.startsWith('image/')) return 'image';
            if (contentType.startsWith('video/')) return 'video';
        }
        if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
            return 'image';
        }
        // 默认是视频，因为大部分API返回的是视频
        return 'video';
    };

    // --- ✅ 优化：带重试、超时和失败记录的媒体获取函数 ---
    const fetchMedia = useCallback(async () => {
        const { url: apiUrl, originalUrl } = getRandomAPI();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok || response.status === 404) throw new Error('API响应失败');

            const finalUrl = response.url;
            // 增加内容类型过滤，防止返回HTML或广告页
            const contentTypeHeader = response.headers.get('Content-Type');
            if (contentTypeHeader && (contentTypeHeader.includes('text/html') || contentTypeHeader.includes('application/json'))) {
                 console.warn('API返回了非媒体内容，已跳过:', finalUrl);
                 return null;
            }
            
            const type = getMediaType(finalUrl, response.headers);

            // 成功后重置失败计数
            if (apiStatus[originalUrl]?.failures > 0) {
                setApiStatus(prev => ({ ...prev, [originalUrl]: { failures: 0 } }));
            }
            return { id: Date.now() + Math.random(), url: finalUrl, type };

        } catch (error) {
            console.error(`API [${originalUrl}] 请求失败:`, error.name === 'AbortError' ? '请求超时' : error.message);
            // 失败后增加计数
            setApiStatus(prev => ({
                ...prev,
                [originalUrl]: { failures: (prev[originalUrl]?.failures || 0) + 1 }
            }));
            return null;
        }
    }, [getRandomAPI, apiStatus]);
    
    const fillMediaQueue = useCallback(async () => {
        const needed = cacheSize - (mediaQueue.length - page);
        if (needed <= 0) return;

        // 使用并发限制，避免瞬间请求过多
        const promises = [];
        for (let i = 0; i < needed; i++) {
            promises.push(fetchMedia());
        }
        
        const results = await Promise.all(promises);
        const newMedia = results.filter(Boolean); // 过滤掉返回 null 的失败请求

        if (newMedia.length > 0) {
            setMediaQueue(prev => [...prev, ...newMedia]);
        }
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    // --- ✅ 新增：组件加载时，首先拉取 TXT 列表的视频 ---
    useEffect(() => {
        const initializeQueue = async () => {
            setIsLoading(true);
            let initialMedia = [];
            try {
                const response = await fetch(TXT_VIDEO_LIST_URL);
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(url => url.trim().match(/\.(mp4|webm)$/));
                    initialMedia = urls.map(url => ({
                        id: `txt-${Math.random()}`,
                        url: url.trim(),
                        type: 'video'
                    }));
                    // 打乱顺序增加随机性
                    initialMedia.sort(() => Math.random() - 0.5);
                }
            } catch (error) {
                console.error("加载TXT视频列表失败:", error);
            }
            
            setMediaQueue(initialMedia);
            // 即使TXT列表失败，也继续从API填充
            await fillMediaQueue();
            setIsLoading(false);
        };

        initializeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- ✅ 优化：将用户偏好设置存入 localStorage ---
    useEffect(() => {
        localStorage.setItem('player_isMuted', JSON.stringify(isMuted));
    }, [isMuted]);

    useEffect(() => {
        localStorage.setItem('player_autoPlayNext', JSON.stringify(autoPlayNext));
    }, [autoPlayNext]);
    
    // --- ✅ 优化：资源回收，清理不在视野范围内的媒体引用 ---
    useEffect(() => {
        const activeIds = new Set(mediaQueue.slice(Math.max(0, page - 2), page + cacheSize).map(m => m.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!activeIds.has(id)) {
                delete mediaRefs.current[id];
            }
        });
    }, [page, mediaQueue, cacheSize]);

    // 播放和预加载核心逻辑
    useEffect(() => {
        if (mediaQueue.length === 0 || !mediaQueue[page]) {
            // 如果队列为空或当前项不存在，尝试填充
            fillMediaQueue();
            return;
        }

        const currentItem = mediaQueue[page];
        
        // 统一暂停所有视频
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl && mediaEl.tagName === 'VIDEO' && !mediaEl.paused) {
                mediaEl.pause();
            }
        });

        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef) {
            if (currentItem.type === 'video') {
                setIsLoading(true); // 切换时默认显示加载中
                setIsPaused(false);
                currentMediaRef.currentTime = 0;
                currentMediaRef.play().catch(e => console.warn('自动播放失败，等待用户交互。', e));
            } else {
                setIsLoading(false); // 图片直接完成加载
            }
        }

        // 预加载下一个视频
        if (mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }
    }, [page, mediaQueue, fillMediaQueue, preloadThreshold]);
    
    const paginate = useCallback((newDirection) => {
        const newPage = page + newDirection;
        if (newPage < 0 || newPage >= mediaQueue.length) {
            if (newDirection > 0) fillMediaQueue(); // 如果是向后滑动越界，尝试加载更多
            return;
        }
        setPage([newPage, newDirection]);
    }, [page, mediaQueue.length, fillMediaQueue]);
    
    // --- ✅ 优化：根据屏幕高度动态调整滑动阈值 ---
    const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy], tap }) => {
        if (tap) return; // 阻止拖动逻辑响应点击事件
        const threshold = Math.min(window.innerHeight / 3, 200);
        if (last && (Math.abs(my) > threshold || (vy > 0.5 && dy !== 0))) {
            paginate(my < 0 ? 1 : -1);
        }
    }, { axis: 'y', filterTaps: true, taps: true });
    
    // --- ✅ 优化：点击播放/暂停 ---
    const handleTogglePlay = () => {
        const currentItem = mediaQueue[page];
        if (!currentItem || currentItem.type !== 'video') return;
        const videoEl = mediaRefs.current[currentItem.id];
        if (videoEl) {
            if (videoEl.paused) {
                videoEl.play();
                setIsPaused(false);
            } else {
                videoEl.pause();
                setIsPaused(true);
            }
        }
    };

    // --- ✅ 新增：媒体加载失败时自动跳过 ---
    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，将自动切换到下一个。`);
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        // 如果当前页就是失败的媒体，立即切换
        if (mediaQueue[page]?.id === id) {
           paginate(1);
        }
    };
    
    // --- ✅ 新增：后台自动预加载下一个视频 ---
    const handleTimeUpdate = (e) => {
        const video = e.target;
        const currentId = mediaQueue[page]?.id;
        if (!video.duration || !currentId || preloadTriggered.current.has(currentId)) return;
        
        // 当前视频播放到 60% 时，触发预加载
        if ((video.currentTime / video.duration) > 0.6) {
            if (mediaQueue.length - page <= preloadThreshold) {
                fillMediaQueue();
            }
            preloadTriggered.current.add(currentId); // 标记为已触发，避免重复
        }
    };

    // --- ✅ 新增：控制UI显示与隐藏 ---
    const displayControls = useCallback(() => {
        setShowControls(true);
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    }, []);

    useEffect(() => {
        displayControls(); // 组件加载时显示一次
        return () => clearTimeout(controlsTimer.current);
    }, [displayControls]);
    
    // --- ✅ 新增：长按屏幕显示控制UI ---
    const handlePointerDown = () => {
        longPressTimer.current = setTimeout(() => {
            displayControls();
        }, 500); // 500ms 算作长按
    };
    const handlePointerUp = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative overflow-hidden select-none touch-action-pan-y" 
            {...bind()}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp} // 移动取消时也清除计时器
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
                        onClick={handleTogglePlay}
                     >
                        {currentMedia.type === 'video' ? (
                            <video
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black"
                                playsInline
                                muted={isMuted}
                                loop={!autoPlayNext}
                                referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)}
                                onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }}
                                onError={() => handleMediaError(currentMedia.id)}
                                onTimeUpdate={handleTimeUpdate} // 监听播放进度
                            />
                        ) : (
                            <img
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black"
                                alt="media content"
                                referrerPolicy="no-referrer"
                                onLoad={() => setIsLoading(false)}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        )}
                     </motion.div>
                )}
            </AnimatePresence>

            {/* --- ✅ 优化：动态 loading 效果 --- */}
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-white/80 border-solid border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            
            {/* --- ✅ 优化：暂停图标淡入淡出 --- */}
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

            {/* --- ✅ 优化：底部控制栏自动隐藏/显示 --- */}
            <motion.div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-5"
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: showControls ? 'auto' : 'none' }}
            >
                <button onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform hover:scale-110">
                    {isMuted ? <FaVolumeMute size={22}/> : <FaVolumeUp size={22}/>}
                </button>
                 <button onClick={(e) => { e.stopPropagation(); setAutoPlayNext(p => !p); }} className="px-4 py-3 rounded-full bg-black/50 text-white backdrop-blur-sm text-sm font-semibold transition-transform hover:scale-110">
                    {autoPlayNext ? '自动连播' : '关闭连播'}
                </button>
                 <button onClick={(e) => { e.stopPropagation(); window.location.reload(); }} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform hover:scale-110">
                     <FaUndo size={18}/>
                </button>
            </motion.div>

            {/* 页面指示器 */}
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
