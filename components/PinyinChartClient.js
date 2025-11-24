// /components/PinyinChartClient.js

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

export default function PinyinChartClient({ initialData }) {
    // --- 现有状态，保持不变 ---
    const [isPlaying, setIsPlaying] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [activeTab, setActiveTab] = useState(0);
    const [direction, setDirection] = useState(0);

    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    // --- 逻辑函数，保持不变 ---
    const playAudio = (item) => {
        if (!item?.audio || isAutoPlaying) return;
        audioRef.current.src = item.audio;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch(e => console.error("音频播放失败:", e));
        setIsPlaying(item.letter);
    };

    const handleAudioEnd = () => {
        setIsPlaying(null);
        if (isAutoPlaying) {
            timeoutRef.current = setTimeout(() => {
                let nextIndex;
                if (initialData.categories) {
                    const cat = initialData.categories[currentIndex.cat];
                    if (currentIndex.col < cat.rows[currentIndex.row].length - 1) {
                        nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                    } else if (currentIndex.row < cat.rows.length - 1) {
                        nextIndex = { ...currentIndex, row: currentIndex.row + 1, col: 0 };
                    } else {
                        setIsAutoPlaying(false);
                        return;
                    }
                } else {
                    if (currentIndex.col < initialData.items.length - 1) {
                        nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                    } else {
                        setIsAutoPlaying(false);
                        return;
                    }
                }
                setCurrentIndex(nextIndex);
            }, 300);
        }
    };

    const toggleAutoPlay = () => {
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            setIsPlaying(null);
        } else {
            setCurrentIndex({ cat: activeTab, row: 0, col: 0 });
            setIsAutoPlaying(true);
        }
    };

    useEffect(() => {
        if (isAutoPlaying) {
            let item;
            if (initialData.categories) {
                item = initialData.categories[currentIndex.cat]?.rows[currentIndex.row]?.[currentIndex.col];
            } else {
                item = initialData.items[currentIndex.col];
            }
            if (item?.audio) {
                audioRef.current.src = item.audio;
                audioRef.current.playbackRate = playbackRate;
                audioRef.current.play().catch(e => console.error("音频播放失败:", e));
                setIsPlaying(item.letter);
            } else {
                handleAudioEnd();
            }
        }
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [isAutoPlaying, currentIndex, playbackRate, initialData]);

    // --- 手势与动画逻辑 ---
    const hasMultipleCategories = initialData.categories && initialData.categories.length > 1;

    const paginate = (newDirection) => {
        if (newDirection > 0 && activeTab < initialData.categories.length - 1) {
            setDirection(1);
            setActiveTab(activeTab + 1);
        } else if (newDirection < 0 && activeTab > 0) {
            setDirection(-1);
            setActiveTab(activeTab - 1);
        }
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => hasMultipleCategories && paginate(1),
        onSwipedRight: () => hasMultipleCategories && paginate(-1),
        preventDefaultTouchmoveEvent: true,
        trackMouse: true,
    });

    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction) => ({
            zIndex: 0,
            x: direction < 0 ? 50 : -50,
            opacity: 0,
            scale: 0.95
        }),
    };

    // --- 组件渲染 ---

    const LetterButton = ({ item }) => {
        const isActive = isPlaying === item.letter;
        const hasAudio = !!item.audio;

        return (
            <motion.div
                onClick={() => playAudio(item)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`group relative aspect-square flex flex-col items-center justify-center rounded-3xl cursor-pointer transition-all duration-300 
                ${isActive 
                    ? 'bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 shadow-lg shadow-fuchsia-500/40 border-transparent'
                    : 'bg-white/10 dark:bg-black/20 hover:bg-white/15 border border-white/10 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-white/20'
                }`}
            >
                {/* 活跃状态下的光晕背景 */}
                {isActive && (
                    <motion.div 
                        layoutId="active-glow"
                        className="absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-500 to-fuchsia-500 blur-md opacity-60 -z-10"
                    />
                )}

                <span className={`pinyin-letter relative text-4xl sm:text-5xl font-bold tracking-tight transition-colors duration-300 
                    ${isActive ? 'text-white drop-shadow-md' : 'text-slate-700 dark:text-slate-100 group-hover:text-white'}`}>
                    {item.letter}
                </span>
                
                <div className="absolute bottom-2 sm:bottom-3">
                    {hasAudio ? (
                        <motion.div 
                            animate={isActive ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 0.5 }}
                            transition={{ repeat: isActive ? Infinity : 0, duration: 1.5 }}
                        >
                            <Volume2 size={16} className={`transition-colors duration-300 ${isActive ? 'text-white/90' : 'text-slate-400 group-hover:text-white/70'}`} />
                        </motion.div>
                    ) : (
                       <div className="h-4 w-4" /> // 占位符
                    )}
                </div>
            </motion.div>
        );
    };

    const renderContent = () => {
        if (!initialData.categories) {
            // 无分类 (声母表等)
            return (
                <div className="grid grid-cols-4 gap-4 sm:gap-6 p-1">
                    {initialData.items.map((item) => (
                        <LetterButton key={item.letter} item={item} />
                    ))}
                </div>
            );
        }

        // 有分类 (韵母/声调表)
        return (
            <div {...swipeHandlers} className="flex flex-col flex-grow w-full">
                {/* 分类 Tabs - 磨砂玻璃胶囊风格 */}
                <div className="relative mb-6 group">
                    <div className="flex space-x-2 overflow-x-auto pb-2 scroll-hidden px-1 mask-linear-fade">
                        {initialData.categories.map((cat, index) => {
                            const isSelected = activeTab === index;
                            return (
                                <button 
                                    key={cat.name} 
                                    onClick={() => { 
                                        setDirection(index > activeTab ? 1 : -1);
                                        setActiveTab(index); 
                                        setIsAutoPlaying(false); 
                                    }} 
                                    className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap z-10
                                    ${isSelected ? 'text-white shadow-lg shadow-violet-500/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/5'}`}
                                >
                                    {isSelected && (
                                        <motion.div 
                                            layoutId="tab-highlight" 
                                            className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full -z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    {cat.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
                
                {/* 内容区域 - 带弹性动画 */}
                <div className="relative min-h-[300px]">
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={activeTab}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                            className="space-y-4"
                        >
                            {initialData.categories[activeTab].rows.map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-4 gap-3 sm:gap-4">
                                    {row.map((item) => (
                                        <LetterButton key={item.letter} item={item} />
                                    ))}
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* 全局样式注入：字体修正、隐藏滚动条、自定义Slider */}
            <style jsx global>{`
                .pinyin-letter {
                    font-family: ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-variant-ligatures: none;
                }
                .scroll-hidden::-webkit-scrollbar { display: none; }
                .scroll-hidden { -ms-overflow-style: none; scrollbar-width: none; }
                
                /* 自定义 Range Slider 样式 */
                input[type=range] {
                    -webkit-appearance: none; 
                    background: transparent; 
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    margin-top: -8px;
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 4px;
                    cursor: pointer;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                }
            `}</style>

            {/* 页面背景：深色渐变 + 噪点纹理 */}
            <div className="min-h-screen w-full bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans selection:bg-violet-500 selection:text-white">
                {/* 装饰性背景光斑 */}
                <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
                <div className="fixed bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
                <div className="fixed top-[30%] right-[20%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

                <div className="max-w-2xl mx-auto p-5 sm:p-8 relative z-10 flex flex-col min-h-screen">
                    <audio ref={audioRef} onEnded={handleAudioEnd} />
                    
                    {/* 顶部导航栏 */}
                    <header className="flex items-center justify-between mb-10">
                        <Link href="/hsk" passHref>
                            <a className="group flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all hover:scale-110 active:scale-95">
                                <ArrowLeft size={20} className="text-slate-300 group-hover:text-white" />
                            </a>
                        </Link>
                        
                        <div className="text-center">
                            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-wide">
                                {initialData.title}
                            </h1>
                            <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-widest opacity-60">Interactive Learning</p>
                        </div>
                        
                        <div className="w-10 h-10 flex items-center justify-center opacity-50">
                            <Sparkles size={20} className="text-violet-300" />
                        </div>
                    </header>

                    {/* 主内容区 */}
                    <main className="flex-grow flex flex-col">
                        {renderContent()}
                    </main>
                    
                    {/* 底部悬浮控制舱 */}
                    <div className="mt-8 sticky bottom-6 z-50">
                        <div className="bg-slate-900/60 dark:bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 p-5 sm:p-6 overflow-hidden relative">
                            {/* 内部高光边框装饰 */}
                            <div className="absolute inset-0 rounded-3xl border border-white/5 pointer-events-none"></div>
                            
                            <div className="flex flex-col gap-6">
                                {/* 播放控制按钮 */}
                                <button 
                                    onClick={toggleAutoPlay} 
                                    disabled={!initialData.items?.some(i => i.audio) && !initialData.categories} 
                                    className={`relative w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-lg transition-all duration-300 group overflow-hidden
                                    ${isAutoPlaying 
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20' 
                                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]'
                                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                                >
                                    {isAutoPlaying ? <PauseCircle size={24} /> : <PlayCircle size={24} className="fill-current" />}
                                    <span>{isAutoPlaying ? '暂停播放' : '开始自动播放'}</span>
                                    
                                    {/* 按钮内的流光动画 */}
                                    {!isAutoPlaying && (
                                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                                    )}
                                </button>

                                {/* 语速调节器 */}
                                <div className="space-y-3 px-1">
                                    <div className="flex justify-between items-center text-sm text-slate-400 font-medium">
                                        <span className="flex items-center gap-1"><Volume2 size={14}/> 语速控制</span>
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-xs text-slate-200">{playbackRate.toFixed(1)}x</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.1))} className="text-slate-500 hover:text-white transition-colors">
                                            <ChevronsLeft size={20} />
                                        </button>
                                        <div className="flex-1 relative h-6 flex items-center">
                                            <input
                                                type="range" min="0.5" max="2.0" step="0.1"
                                                value={playbackRate}
                                                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                                className="w-full z-20 relative"
                                            />
                                            {/* 自定义轨道填充效果 */}
                                            <div 
                                                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full z-10 pointer-events-none opacity-80" 
                                                style={{ width: `${((playbackRate - 0.5) / 1.5) * 100}%` }}
                                            />
                                        </div>
                                        <button onClick={() => setPlaybackRate(Math.min(2.0, playbackRate + 0.1))} className="text-slate-500 hover:text-white transition-colors">
                                            <ChevronsRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
