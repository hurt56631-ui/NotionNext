// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化 + 状态持久化

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay, FaForward } from 'react-icons/fa'; // 引入图标库

// 1. 内置的 API 列表 (作为备用)
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

const EXTERNAL_API_LIST_URL = 'https://tiktok.999980.xyz/index.txt';

// 2. 定义页面切换动画
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

// 智能重试函数
const fetchWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await fn();
            if (result) return result;
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed. Retrying...`, error);
        }
        await new Promise(r => setTimeout(r, 500)); // 延迟0.5秒再试
    }
    return null;
};

// 主组件
export default function VerticalShortVideoPlayer({
    cacheSize = 9,
    preloadThreshold = 3,
    useProxy = false,
    proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
    const [apiList, setApiList] = useState(DEFAULT_APIS);
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]);
    
    // 3. 状态管理：使用 localStorage 初始化用户偏好
    const [isMuted, setIsMuted] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('short-video-isMuted') === 'true';
        }
        return true;
    });
    const [autoPlayNext, setAutoPlayNext] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('short-video-autoPlayNext') !== 'false';
        }
        return true;
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false);
    const [showControls, setShowControls] = useState(true);

    const mediaRefs = useRef({});
    const hideControlsTimeout = useRef(null);

    // 4. 从外部 TXT 加载 API 列表
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

    // 5. 状态持久化：将用户偏好存入 localStorage
    useEffect(() => {
        localStorage.setItem('short-video-isMuted', isMuted);
    }, [isMuted]);

    useEffect(() => {
        localStorage.setItem('short-video-autoPlayNext', autoPlayNext);
    }, [autoPlayNext]);

    const getRandomAPI = useCallback(() => {
        const raw = apiList[Math.floor(Math.random() * apiList.length)];
        return `${raw}${raw.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }, [apiList]);

    const buildSrc = useCallback((url) => {
        return useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url;
    }, [useProxy, proxyPath]);

    const getContentTypeFromUrl = (url) => {
        if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return 'video';
        if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return 'image';
        return 'video'; // 默认视为视频
    };

    const fetchMedia = useCallback(async () => {
        const fetchFn = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(getRandomAPI(), { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) return null;

            const finalUrl = response.url;
            // 严格判断URL后缀
            if (!finalUrl.match(/\.(mp4|mov|webm|jpg|jpeg|png|gif|webp)(\?|$)/i)) {
                 console.warn('URL不包含有效的媒体后缀，已跳过:', finalUrl);
                 return null;
            }

            const contentType = response.headers.get('Content-Type');
            if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
                 console.warn('API返回了非媒体内容，已跳过:', finalUrl);
                 return null;
            }

            const type = getContentTypeFromUrl(finalUrl);
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        };
        
        return fetchWithRetry(fetchFn);
    }, [getRandomAPI]);

    const fillMediaQueue = useCallback(async () => {
        const needed = cacheSize - (mediaQueue.length - page);
        if (needed <= 0) return;

        setIsLoading(true);
        const promises = Array.from({ length: needed }, fetchMedia);
        const results = await Promise.all(promises);
        const newMedia = results.filter(Boolean);

        if (newMedia.length > 0) {
            setMediaQueue(prev => [...prev, ...newMedia]);
        }
        // 如果是首次加载，加载完后取消加载状态
        if (page === 0 && mediaQueue.length === 0) {
             setIsLoading(false);
        }
    }, [cacheSize, mediaQueue.length, page, fetchMedia]);

    useEffect(() => {
        fillMediaQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 6. 资源回收：清理不在队列中的媒体引用
    useEffect(() => {
        const currentQueueIds = new Set(mediaQueue.map(item => item.id));
        Object.keys(mediaRefs.current).forEach(id => {
            if (!currentQueueIds.has(parseFloat(id))) {
                delete mediaRefs.current[id];
            }
        });
    }, [mediaQueue]);
    
    // 7. 加载超时自动跳过
    useEffect(() => {
        let timeoutId = null;
        if (isLoading) {
            timeoutId = setTimeout(() => {
                if (isLoading) { // 4秒后仍在加载
                    console.warn('加载超时，自动跳到下一个。');
                    paginate(1);
                }
            }, 4000);
        }
        return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);

    useEffect(() => {
        if (mediaQueue.length === 0) return;

        const currentItem = mediaQueue[page];
        if (!currentItem) return;
        
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl && mediaEl.tagName === 'VIDEO' && !mediaEl.paused) {
                mediaEl.pause();
            }
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

        if (mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }
    }, [page, mediaQueue, fillMediaQueue, preloadThreshold]);

    const paginate = (newDirection) => {
        let newPage = page + newDirection;
        if (newPage < 0) newPage = 0;
        if (newPage >= mediaQueue.length) {
            fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
    };

    // 8. 手势灵敏度优化
    const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy], cancel }) => {
        // 当垂直移动超过屏幕高度的1/3，或速度足够快时切换
        if (last && (Math.abs(my) > window.innerHeight / 3.5 || (vy > 0.6 && dy !== 0))) {
             paginate(my < 0 ? 1 : -1);
        }
    }, { axis: 'y', filterTaps: true, taps: true });
    
    // 9. 控制栏自动隐藏逻辑
    const resetHideTimeout = useCallback(() => {
        clearTimeout(hideControlsTimeout.current);
        setShowControls(true);
        hideControlsTimeout.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    }, []);

    useEffect(() => {
        resetHideTimeout(); // 每次切换视频时重置计时器
        return () => clearTimeout(hideControlsTimeout.current);
    }, [page, resetHideTimeout]);

    const handleInteraction = () => {
        resetHideTimeout();
    };

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
    
    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，将自动跳到下一个。`);
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        // 不需要延迟，让翻页逻辑自然过渡
        paginate(1);
    };
    
    // 10. 后台预加载下一个视频
    const handleTimeUpdate = (e) => {
        const videoEl = e.target;
        const nextPageIndex = page + 1;
        if (mediaQueue[nextPageIndex] && !mediaQueue[nextPageIndex].preloaded) {
            // 当播放到30%时
            if (videoEl.currentTime / videoEl.duration > 0.3) {
                const nextMedia = mediaQueue[nextPageIndex];
                if (nextMedia.type === 'video') {
                     // 创建一个预加载链接
                     const preloadLink = document.createElement('link');
                     preloadLink.rel = 'preload';
                     preloadLink.as = 'video';
                     preloadLink.href = buildSrc(nextMedia.url);
                     document.head.appendChild(preloadLink);
                     // 标记为已预加载
                     setMediaQueue(prev => {
                        const newQueue = [...prev];
                        newQueue[nextPageIndex].preloaded = true;
                        return newQueue;
                     });
                     // 移除link标签避免内存泄漏
                     setTimeout(() => document.head.removeChild(preloadLink), 5000);
                }
            }
        }
    };

    const currentMedia = mediaQueue[page];

    return (
        <div 
            className="w-full h-screen bg-black relative overflow-hidden select-none" 
            style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}
            {...bind()}
            onClick={handleInteraction}
            onContextMenu={(e) => e.preventDefault()} // 11. 禁止长按菜单
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
                        onClick={(e) => {
                            e.stopPropagation();
                            handleInteraction();
                            handleTogglePlay();
                        }}
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
                                onTimeUpdate={handleTimeUpdate} // 绑定时间更新事件
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

            {/* 12. 动态旋转加载动画 */}
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
                    <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
            )}
            
            {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                     <FaPlay className="text-white/80 text-7xl" />
                </div>
            )}

            {/* 13. 底部动画控制栏 */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0, y: '100%' }}
                        animate={{ opacity: 1, y: '0%' }}
                        exit={{ opacity: 0, y: '100%' }}
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
                        <button onClick={() => window.location.reload()} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
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
