// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存 + 交互优化

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaVolumeMute, FaVolumeUp, FaUndo, FaPlay } from 'react-icons/fa'; // 引入图标库，让UI更好看

// 1. API 列表去重
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

// 2. 定义独立的页面切换动画
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
    cacheSize = 5, // 适当增加缓存，体验更流畅
    preloadThreshold = 2,
    useProxy = false,
    proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
    const [mediaQueue, setMediaQueue] = useState([]);
    const [[page, direction], setPage] = useState([0, 0]); // 用数组同时存储当前页和方向
    const [isMuted, setIsMuted] = useState(true);
    const [autoPlayNext, setAutoPlayNext] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isPaused, setIsPaused] = useState(false); // 新增：用于UI显示的暂停状态

    const mediaRefs = useRef({}); // 使用对象存储引用，更稳定

    const getRandomAPI = useCallback(() => {
        const raw = apiList[Math.floor(Math.random() * apiList.length)];
        return `${raw}${raw.includes('?') ? '&' : '?'}t=${Date.now()}`;
    }, [apiList]);

    const buildSrc = useCallback((url) => {
        return useProxy ? `${proxyPath}?url=${encodeURIComponent(url)}` : url;
    }, [useProxy, proxyPath]);

    const getContentTypeFromUrl = (url) => {
        if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
            return 'image';
        }
        return 'video';
    };

    // 3. 改进的媒体获取函数，增加了超时和内容校验
    const fetchMedia = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
            const response = await fetch(getRandomAPI(), { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) return null;

            const finalUrl = response.url;
            const contentType = response.headers.get('Content-Type');
            if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
                 console.warn('API返回了非媒体内容，已跳过:', finalUrl);
                 return null;
            }

            const type = getContentTypeFromUrl(finalUrl);
            return { id: Date.now() + Math.random(), url: finalUrl, type };
        } catch (error) {
            console.error('API请求失败或超时，已跳过:', error.name === 'AbortError' ? '请求超时' : error);
            return null;
        }
    }, [getRandomAPI]);

    // 填充媒体队列
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

    // 初始化加载
    useEffect(() => {
        fillMediaQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 播放和预加载逻辑
    useEffect(() => {
        if (mediaQueue.length === 0) return;

        const currentItem = mediaQueue[page];
        if (!currentItem) return;
        
        // 确保只有一个视频在播放
        Object.values(mediaRefs.current).forEach(mediaEl => {
            if (mediaEl && mediaEl.tagName === 'VIDEO' && !mediaEl.paused) {
                mediaEl.pause();
            }
        });

        const currentMediaRef = mediaRefs.current[currentItem.id];
        if (currentMediaRef && currentItem.type === 'video') {
            setIsLoading(true); // 切换时先显示加载
            setIsPaused(false);
            currentMediaRef.currentTime = 0;
            currentMediaRef.play().catch(e => console.warn('自动播放可能被浏览器阻止:', e));
        } else if (currentItem.type === 'image') {
            setIsLoading(false); // 图片直接完成加载
        }

        // 预加载逻辑
        if (mediaQueue.length - page <= preloadThreshold) {
            fillMediaQueue();
        }
    }, [page, mediaQueue, fillMediaQueue, preloadThreshold]);

    const paginate = (newDirection) => {
        let newPage = page + newDirection;
        if (newPage < 0) newPage = 0; // 防止索引越界
        if (newPage >= mediaQueue.length) {
            // 如果滑到最后一个，可以尝试填充更多
            fillMediaQueue();
            return;
        }
        setPage([newPage, newDirection]);
    };

    // 4. 修复并优化的手势绑定
    const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
        if (last && (Math.abs(my) > window.innerHeight / 4 || (vy > 0.5 && dy !== 0))) {
            paginate(my < 0 ? 1 : -1);
        }
    }, { axis: 'y', filterTaps: true, taps: true });


    // 5. 新增：点击播放/暂停
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
    
    // 6. 新增：媒体加载失败时自动跳过
    const handleMediaError = (id) => {
        console.error(`媒体 (ID: ${id}) 加载失败，将在1秒后自动跳到下一个。`);
        // 从队列中移除失败的媒体
        setMediaQueue(prev => prev.filter(item => item.id !== id));
        // 短暂延迟后切换，避免界面闪烁
        setTimeout(() => paginate(1), 1000);
    };
    
    const currentMedia = mediaQueue[page];

    return (
        <div className="w-full h-screen bg-black relative overflow-hidden select-none touch-action-pan-y" {...bind()}>
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
                                className="w-full h-full object-cover bg-black" // 7. 全屏剪裁
                                playsInline
                                muted={isMuted}
                                loop={!autoPlayNext} // 开启连播则不循环
                                referrerPolicy="no-referrer"
                                onCanPlay={() => setIsLoading(false)}
                                onWaiting={() => setIsLoading(true)}
                                onEnded={() => { if (autoPlayNext) paginate(1); }} // 8. 自动连播
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        ) : (
                            <img
                                ref={el => { if (el) mediaRefs.current[currentMedia.id] = el; }}
                                src={buildSrc(currentMedia.url)}
                                className="w-full h-full object-cover bg-black" // 7. 全屏剪裁
                                alt="media content"
                                referrerPolicy="no-referrer"
                                onLoad={() => setIsLoading(false)}
                                onError={() => handleMediaError(currentMedia.id)}
                            />
                        )}
                     </motion.div>
                )}
            </AnimatePresence>

            {/* 9. 居中、更大的加载指示器 */}
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-20">
                    <div className="text-white text-2xl font-bold">
                        正在加载...
                    </div>
                </div>
            )}
            
            {/* 暂停时居中显示播放按钮 */}
            {isPaused && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                     <FaPlay className="text-white/80 text-7xl" />
                </div>
            )}

            {/* 全局控制按钮 */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-5">
                <button onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    {isMuted ? <FaVolumeMute size={22}/> : <FaVolumeUp size={22}/>}
                </button>
                 <button onClick={(e) => { e.stopPropagation(); setAutoPlayNext(p => !p); }} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm text-sm font-semibold">
                    {autoPlayNext ? '连播: 开' : '连播: 关'}
                </button>
                 <button onClick={(e) => { e.stopPropagation(); window.location.reload(); }} className="p-3 rounded-full bg-black/50 text-white backdrop-blur-sm">
                     <FaUndo size={18}/>
                </button>
            </div>

            {/* 页面指示器 */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
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
