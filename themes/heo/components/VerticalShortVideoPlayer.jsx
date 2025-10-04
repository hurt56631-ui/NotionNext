// themes/heo/components/VerticalShortVideoPlayer.jsx
// 功能：全屏竖版短视频/图片流（上下文整页切换）+ 边播边缓存

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';

// 默认 API 列表
const DEFAULT_APIS = [
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
'https://www.hhlqilongzhu.cn/api/MP4_xiaojiejie.php','http://api.xingchenfu.xyz/API/cossp.php',
'http://api.xingchenfu.xyz/API/wsb.php', 'http://api.xingchenfu.xyz/API/wmsc.php',
'http://api.xingchenfu.xyz/API/dlzp.php', 'http://api.xingchenfu.xyz/API/xgg.php',
'http://api.xingchenfu.xyz/API/sbkl.php', 'http://api.xingchenfu.xyz/API/ommn.php',
'http://api.xingchenfu.xyz/API/cxldb.php', 'http://api.xingchenfu.xyz/API/xqyl.php',
'http://api.xingchenfu.xyz/API/qttj.php', 'http://api.xingchenfu.xyz/API/hstp.php',
'http://api.xingchenfu.xyz/API/bianzhuang.php', 'http://api.xingchenfu.xyz/API/xqtj.php',
'http://api.xingchenfu.xyz/API/tianmei.php', 'http://api.xingchenfu.xyz/API/cdxl.php',
'http://api.xingchenfu.xyz/API/boy.php', 'http://api.xingchenfu.xyz/API/yzxl.php',
'http://api.xingchenfu.xyz/API/rwsp.php', 'http://api.xingchenfu.xyz/API/nvda.php',
'http://api.xingchenfu.xyz/API/ndym.php', 'http://api.xingchenfu.xyz/API/hssp.php',
'http://api.xingchenfu.xyz/API/bsxl.php', 'http://api.xingchenfu.xyz/API/gzlxjj.php',
'http://api.xingchenfu.xyz/API/sktj.php', 'http://api.xingchenfu.xyz/API/zzxjj.php',
'http://api.xingchenfu.xyz/API/jk.php', 'http://api.xingchenfu.xyz/API/youhuotu.php',
];


// 主组件
export default function VerticalShortVideoPlayer({
apiList = DEFAULT_APIS,
cacheSize = 3, // 缓存数量
preloadThreshold = 1, // 当缓存 <= 该值时触发补充
useProxy = false,
proxyPath = process.env.NEXT_PUBLIC_PROXY_PATH || '/api/proxy'
}) {
const [videos, setVideos] = useState([]); // 存储待播放媒体列表 [{id, url, type}]
const [index, setIndex] = useState(0); // 当前播放索引
const [isMuted, setIsMuted] = useState(true); // 默认静音
const [autoPlayNext, setAutoPlayNext] = useState(true);
const [isLoading, setIsLoading] = useState(true);

const mediaRefs = useRef([]); // 存储 video 或 img 元素的引用

// 工具函数：获取随机API
const getRandomAPI = useCallback(() => {
const raw = apiList[Math.floor(Math.random() * apiList.length)];
return `${raw}${raw.includes('?') ? '&' : '?'}t=${Date.now()}`;
}, [apiList]);

// 工具函数：构建代理或直接URL
const buildSrc = useCallback((url) => {
if (!useProxy) {
// 对于直接请求，我们在媒体标签上设置 referrerPolicy
// 所以这里只返回原始URL
return url;
}
return `${proxyPath}?url=${encodeURIComponent(url)}`;
}, [useProxy, proxyPath]);

// 工具函数：从URL判断内容类型
const getContentTypeFromUrl = (url) => {
if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
return 'image';
}
// 默认是视频
return 'video';
};

// 填充媒体队列，现在会判断内容类型
const fillVideoQueue = useCallback(async () => {
const promises = Array.from({ length: cacheSize }, () =>
fetch(getRandomAPI())
.then(response => {
if (response.ok) {
const finalUrl = response.url;
const type = getContentTypeFromUrl(finalUrl);
// 使用随机数确保id的独特性
return { id: Date.now() + Math.random(), url: finalUrl, type };
}
return null;
})
.catch(() => null)
);

const results = await Promise.all(promises);
const newMedia = results.filter(Boolean); // 过滤掉失败的请求 (null)

if (newMedia.length > 0) {
setVideos(prev => [...prev, ...newMedia]);
}
}, [cacheSize, getRandomAPI]);

// 初始化加载
useEffect(() => {
fillVideoQueue();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// 播放当前索引的媒体
useEffect(() => {
const currentMedia = videos[index];
if (!currentMedia) return;

// 根据媒体类型处理播放和暂停
mediaRefs.current.forEach((mediaEl, i) => {
const item = videos[i];
if (mediaEl && item?.type === 'video') {
if (i === index) {
setIsLoading(true);
mediaEl.play().catch(e => console.warn('自动播放被阻止:', e));
} else {
mediaEl.pause();
mediaEl.currentTime = 0; // 重置非当前视频的播放进度
}
}
});

// 如果当前是图片，直接设置加载完成
if (currentMedia.type === 'image') {
setIsLoading(false);
}

// 补充媒体队列
if (videos.length > 0 && videos.length - index <= preloadThreshold) {
fillVideoQueue();
}
}, [index, videos, fillVideoQueue, preloadThreshold]);

// 手势绑定
const bind = useDrag(({ last, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
if (!last) return;
// 判定为有效滑动
const isIntentionalSwipe = Math.abs(my) > 80 || (vy > 0.6 && Math.abs(dy) > 0);
if (!isIntentionalSwipe) return;

if (my < 0) { // 向上滑动
setIndex(i => Math.min(i + 1, videos.length - 1)); // 下一条
} else { // 向下滑动
setIndex(i => Math.max(0, i - 1)); // 上一条
}
}, { axis: 'y', pointer: { touch: true } });

return (
<div className="w-full h-screen bg-black relative overflow-hidden touch-action-pan-y" {...bind()}>
<AnimatePresence initial={false}>
<motion.div
key={index}
className="absolute inset-0 w-full h-full"
initial={{ y: '0%' }}
animate={{ y: `-${index * 100}%` }}
transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
{videos.map((item, i) => (
<div key={item.id} className="w-full h-full absolute" style={{ top: `${i * 100}%` }}>
{/* 根据类型渲染 video 或 img */}
{item.type === 'video' ? (
<video
ref={el => (mediaRefs.current[i] = el)}
src={buildSrc(item.url)}
className="w-full h-full object-contain bg-black"
playsInline
muted={isMuted}
controls={false}
loop // 循环播放当前视频
referrerPolicy="no-referrer" // 隐藏来源
onCanPlay={() => { if (i === index) setIsLoading(false); }}
onWaiting={() => { if (i === index) setIsLoading(true); }}
onEnded={() => { if (autoPlayNext) setIndex(current => current + 1); }}
/>
) : (
<img
ref={el => (mediaRefs.current[i] = el)}
src={buildSrc(item.url)}
className="w-full h-full object-contain bg-black"
alt="media content"
referrerPolicy="no-referrer" // 隐藏来源
onLoad={() => { if (i === index) setIsLoading(false); }}
/>
)}

{/* UI 覆盖层 */}
{index === i && (
<div className="absolute inset-0 flex flex-col justify-between p-4 z-10 pointer-events-none">
<div className="text-white/80 text-sm">
{isLoading && '加载中...'}
</div>
{/* 你可以在这里添加标题、作者信息等 */}
</div>
)}
</div>
))}
</motion.div>
</AnimatePresence>

{/* 全局控制按钮 */}
<div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4">
<button onClick={() => setIsMuted(m => !m)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">
{isMuted ? '取消静音' : '静音'}
</button>
<button onClick={() => setAutoPlayNext(p => !p)} className="px-4 py-2 rounded-lg bg-black/50 text-white backdrop-blur-sm">
{autoPlayNext ? '连播: 开' : '连播: 关'}
</button>
</div>

{/* 页面指示器 */}
<div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
{videos.slice(0, 10).map((_, i) => ( // 最多显示10个点
<div
key={i}
className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${index === i ? 'bg-white scale-150' : 'bg-white/50'}`}
/>
))}
</div>
</div>
);
}
