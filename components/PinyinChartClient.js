// /components/PinyinChartClient.js

"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
    PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, 
    Volume2, Sparkles, Mic, Square, Ear, RefreshCcw, BarChart2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

// ==========================================
// 1. IndexedDB 离线缓存管理器 (原生实现，无依赖)
// ==========================================
const DB_NAME = 'Pinyin_Hsk_Audio_DB';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

const AudioCacheManager = {
    db: null,

    // 初始化数据库
    async init() {
        if (typeof window === 'undefined') return;
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    },

    // 获取缓存的 Blob URL
    async getAudioUrl(url) {
        if (!url) return null;
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(url);

            request.onsuccess = () => {
                if (request.result) {
                    // 命中缓存：将 Blob 转为本地 URL
                    const blobUrl = URL.createObjectURL(request.result);
                    // console.log('📦 Loaded from Cache:', url);
                    resolve(blobUrl);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    // 缓存音频
    async cacheAudio(url, blob) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(blob, url); // Key: URL, Value: Blob
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ==========================================
// 2. 视觉组件
// ==========================================

// Siri 风格动态声波
const SiriWaveform = ({ isActive }) => {
    return (
        <div className="flex items-center justify-center gap-[3px] h-8">
            {[...Array(5)].map((_, i) => (
                <motion.div
                    key={i}
                    animate={isActive ? {
                        height: [4, 16 + Math.random() * 16, 4],
                        backgroundColor: ["#8b5cf6", "#ec4899", "#8b5cf6"]
                    } : { height: 4, backgroundColor: "#cbd5e1" }}
                    transition={isActive ? {
                        repeat: Infinity,
                        duration: 0.4 + Math.random() * 0.2,
                        ease: "easeInOut"
                    } : { duration: 0.3 }}
                    className="w-1.5 rounded-full bg-slate-300"
                />
            ))}
        </div>
    );
};

// 单个拼音按钮 (Memoized)
const LetterButton = React.memo(({ item, isActive, isSelected, onClick }) => {
    const fontSizeClass = useMemo(() => {
        const len = item.letter.length;
        if (len > 4) return 'text-xl sm:text-2xl';
        if (len > 3) return 'text-2xl sm:text-3xl';
        return 'text-3xl sm:text-4xl';
    }, [item.letter]);

    return (
        <motion.button
            onClick={() => onClick(item)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className={`group relative w-full aspect-[4/3] sm:aspect-square flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl transition-all duration-300 select-none overflow-hidden touch-manipulation
            ${isActive 
                ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-xl shadow-fuchsia-500/40 ring-2 ring-white/50' 
                : isSelected
                    ? 'bg-white border-2 border-violet-400 shadow-md ring-4 ring-violet-50' 
                    : 'bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-300'
            }`}
        >
            {isActive && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-white/20 blur-xl rounded-full translate-x-1/2 -translate-y-1/2" />
            )}

            <span className={`pinyin-letter font-black tracking-tight leading-none z-10 transition-colors duration-200
                ${fontSizeClass}
                ${isActive ? 'text-white drop-shadow-md' : 'text-slate-800 group-hover:text-violet-600'}
            `}>
                {item.letter}
            </span>
            
            <div className="absolute bottom-1.5 sm:bottom-3 h-4 flex items-center justify-center z-10">
                {item.audio ? (
                    <motion.div animate={isActive ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 0.4 }}>
                        <Volume2 size={16} className={isActive ? 'text-white/90' : 'text-slate-300'} />
                    </motion.div>
                ) : (
                    <span className="text-[10px] text-slate-300 font-bold">无音频</span>
                )}
            </div>
        </motion.button>
    );
}, (prev, next) => {
    return (
        prev.item.letter === next.item.letter &&
        prev.isActive === next.isActive &&
        prev.isSelected === next.isSelected
    );
});

LetterButton.displayName = 'LetterButton';

// ==========================================
// 3. 主组件
// ==========================================

export default function PinyinChartClient({ initialData }) {
    // 基础状态
    const [activeTab, setActiveTab] = useState(0);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [direction, setDirection] = useState(0); 
    
    // 播放状态
    const [selectedItem, setSelectedItem] = useState(null); 
    const [isPlayingLetter, setIsPlayingLetter] = useState(null); 
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false); 

    // 录音状态
    const [isRecording, setIsRecording] = useState(false);
    const [isMicLoading, setIsMicLoading] = useState(false); // 新增：麦克风初始化状态
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);

    // Refs
    const audioRef = useRef(null); 
    const userAudioRef = useRef(null); 
    const timeoutRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // 初始化 DB
    useEffect(() => {
        AudioCacheManager.init().catch(console.error);
    }, []);

    // ===========================
    // 核心逻辑：智能缓存播放
    // ===========================

    const playAudio = useCallback(async (item, isAuto = false) => {
        if (!item?.audio) {
            if (isAuto) handleAudioEnd();
            return;
        }

        if (!isAuto && isAutoPlaying) setIsAutoPlaying(false);

        setSelectedItem(item);
        if (selectedItem?.letter !== item.letter) setUserAudioUrl(null);
        if (typeof window === "undefined" || !audioRef.current) return;

        try {
            setIsLoadingAudio(true);
            setIsPlayingLetter(item.letter); 

            let srcToPlay = await AudioCacheManager.getAudioUrl(item.audio);

            if (!srcToPlay) {
                // console.log('⬇️ Fetching from network:', item.audio);
                const response = await fetch(item.audio);
                const blob = await response.blob();
                await AudioCacheManager.cacheAudio(item.audio, blob);
                srcToPlay = URL.createObjectURL(blob);
            }

            audioRef.current.src = srcToPlay;
            audioRef.current.playbackRate = playbackRate;
            
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Playback interrupted:", error);
                    setIsPlayingLetter(null);
                    if (isAuto) handleAudioEnd();
                });
            }
        } catch (e) {
            console.error("Play Error:", e);
            setIsPlayingLetter(null);
        } finally {
            setIsLoadingAudio(false);
        }
    }, [isAutoPlaying, playbackRate, selectedItem]);

    const handleAudioEnd = useCallback(() => {
        setIsPlayingLetter(null);
        
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
            }, 400); 
        }
    }, [isAutoPlaying, currentIndex, initialData]);

    useEffect(() => {
        if (!isAutoPlaying) return;

        let item;
        if (initialData.categories) {
            item = initialData.categories[currentIndex.cat]?.rows[currentIndex.row]?.[currentIndex.col];
        } else {
            item = initialData.items[currentIndex.col];
        }
        
        if (item) {
            playAudio(item, true);
        } else {
            setIsAutoPlaying(false);
        }

        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [currentIndex, isAutoPlaying, playAudio, initialData]);

    const toggleAutoPlay = useCallback(() => {
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioRef.current) { 
                audioRef.current.pause(); 
                audioRef.current.currentTime = 0; 
            }
            setIsPlayingLetter(null);
        } else {
            setCurrentIndex({ cat: activeTab, row: 0, col: 0 });
            setIsAutoPlaying(true);
        }
    }, [isAutoPlaying, activeTab]);

    // ===========================
    // 录音功能 (优化版)
    // ===========================

    const startRecording = async () => {
        if (typeof window === "undefined") return;
        
        // 立即给予 UI 反馈，避免用户觉得卡顿
        setIsMicLoading(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);
                setUserAudioUrl(url);
                
                // 彻底释放流
                stream.getTracks().forEach(track => track.stop());
            };

            // timeslice 设置为 100ms，防止非常短的点击导致数据为空
            mediaRecorderRef.current.start(100);
            
            // 只有成功开始录音后才切换状态
            setIsRecording(true);
        } catch (error) {
            console.error("Microphone error:", error);
            alert("请允许麦克风权限以使用对比功能。");
        } finally {
            // 无论成功失败，都停止加载动画
            setIsMicLoading(false);
        }
    };

    const stopRecording = () => {
        // 增加安全检查，防止未初始化完成就点击停止
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const playUserAudio = () => {
        if (userAudioUrl && userAudioRef.current) {
            userAudioRef.current.src = userAudioUrl;
            userAudioRef.current.play();
            setIsPlayingUserAudio(true);
            userAudioRef.current.onended = () => setIsPlayingUserAudio(false);
        }
    };

    // ===========================
    // UI 逻辑
    // ===========================

    const hasMultipleCategories = initialData.categories && initialData.categories.length > 1;
    
    const paginate = useCallback((newDirection) => {
        if (!hasMultipleCategories) return;
        if (newDirection > 0 && activeTab < initialData.categories.length - 1) {
            setDirection(1); setActiveTab(prev => prev + 1); setIsAutoPlaying(false);
        } else if (newDirection < 0 && activeTab > 0) {
            setDirection(-1); setActiveTab(prev => prev - 1); setIsAutoPlaying(false);
        }
    }, [activeTab, hasMultipleCategories, initialData.categories]);

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => paginate(1),
        onSwipedRight: () => paginate(-1),
        preventDefaultTouchmoveEvent: true,
        trackMouse: true,
    });

    const pageVariants = {
        enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0, scale: 0.95 }),
        center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
        exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 50 : -50, opacity: 0, scale: 0.95 }),
    };

    // 响应式 Grid
    const [gridCols, setGridCols] = useState(4);
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 400) setGridCols(3);
            else if (window.innerWidth < 640) setGridCols(4);
            else setGridCols(5);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const renderContent = () => {
        const gridClass = gridCols === 3 ? "grid-cols-3" : gridCols === 4 ? "grid-cols-4" : "grid-cols-5";

        if (!initialData.categories) {
            return (
                <div className={`grid ${gridClass} gap-3 sm:gap-5 p-1`}>
                    {initialData.items.map((item) => (
                        <LetterButton 
                            key={item.letter} 
                            item={item} 
                            isActive={isPlayingLetter === item.letter}
                            isSelected={selectedItem?.letter === item.letter}
                            onClick={playAudio} 
                        />
                    ))}
                </div>
            );
        }

        return (
            <div {...swipeHandlers} className="flex flex-col flex-grow w-full">
                {/* Tabs */}
                <div className="relative mb-6">
                    <div className="flex space-x-3 overflow-x-auto pb-4 pt-2 px-1 scroll-hidden items-center snap-x">
                        {initialData.categories.map((cat, index) => {
                            const isSelected = activeTab === index;
                            return (
                                <button 
                                    key={cat.name} 
                                    onClick={() => { setDirection(index > activeTab ? 1 : -1); setActiveTab(index); setIsAutoPlaying(false); }} 
                                    className={`relative px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap snap-center z-10 flex-shrink-0
                                    ${isSelected 
                                        ? 'text-white bg-slate-900 shadow-lg shadow-slate-900/30 scale-105' 
                                        : 'text-slate-500 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-300'}`}
                                >
                                    {cat.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
                
                {/* 字母列表 */}
                <div className="relative min-h-[300px]">
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={activeTab} custom={direction} variants={pageVariants} initial="enter" animate="center" exit="exit"
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="space-y-6 pb-4"
                        >
                            {initialData.categories[activeTab].rows.map((row, rowIndex) => (
                                <div key={rowIndex} className={`grid ${gridClass} gap-3 sm:gap-5`}>
                                    {row.map((item) => (
                                        <LetterButton 
                                            key={item.letter} 
                                            item={item} 
                                            isActive={isPlayingLetter === item.letter}
                                            isSelected={selectedItem?.letter === item.letter}
                                            onClick={playAudio} 
                                        />
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
            <style jsx global>{`
                body { background: #f8fafc; }
                .pinyin-letter { font-family: ui-rounded, "Nunito", system-ui, sans-serif; }
                .scroll-hidden::-webkit-scrollbar { display: none; }
                .scroll-hidden { -ms-overflow-style: none; scrollbar-width: none; }
                input[type=range] { -webkit-appearance: none; background: transparent; }
                input[type=range]::-webkit-slider-thumb { 
                    -webkit-appearance: none; height: 24px; width: 24px; 
                    border-radius: 50%; background: #fff; 
                    cursor: pointer; margin-top: -10px; 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06); 
                    border: 2px solid #7c3aed;
                }
                input[type=range]::-webkit-slider-runnable-track { 
                    width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; 
                }
            `}</style>

            <div className="min-h-screen w-full bg-slate-50 text-slate-800 relative overflow-hidden font-sans selection:bg-violet-200 selection:text-violet-900">
                <div className="fixed top-[-20%] right-[-10%] w-[800px] h-[800px] bg-fuchsia-200/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
                <div className="fixed top-[20%] left-[-10%] w-[600px] h-[600px] bg-violet-200/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
                <div className="fixed bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

                <div className="max-w-2xl mx-auto p-4 sm:p-6 relative z-10 flex flex-col min-h-screen">
                    <audio ref={audioRef} onEnded={handleAudioEnd} preload="none" />
                    <audio ref={userAudioRef} />
                    
                    {/* Header (移除了返回箭头，文字和图标两端对齐) */}
                    <header className="flex items-center justify-between mb-6 pt-2">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight drop-shadow-sm flex items-center gap-2">
                            {initialData.title}
                        </h1>
                        <div className="w-12 h-12 flex items-center justify-center bg-white/80 backdrop-blur rounded-full border border-slate-200 shadow-sm">
                            {isLoadingAudio ? (
                                <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Sparkles size={22} className="text-violet-500" />
                            )}
                        </div>
                    </header>

                    <main className="flex-grow flex flex-col pb-80">
                        {renderContent()}
                    </main>
                    
                    {/* Control Panel */}
                    <div className="fixed bottom-6 left-4 right-4 z-50 max-w-2xl mx-auto touch-none">
                        <div className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden ring-1 ring-black/5">
                            
                            {/* Contrast Lab */}
                            <AnimatePresence mode="wait">
                                {selectedItem && !isAutoPlaying ? (
                                    <motion.div 
                                        key="recorder"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-b border-slate-100 bg-slate-50/60"
                                    >
                                        <div className="px-6 py-5 flex items-center justify-between gap-4">
                                            <div className="flex flex-col items-start min-w-[80px]">
                                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <BarChart2 size={10} />
                                                    Contrast
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-4xl font-black text-slate-800 leading-none tracking-tight">{selectedItem.letter}</span>
                                                    <button 
                                                        onClick={() => playAudio(selectedItem)}
                                                        className="w-10 h-10 flex items-center justify-center rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 active:scale-90 transition-all"
                                                    >
                                                        <Ear size={20} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 justify-end flex-1">
                                                <div className="flex flex-col items-end mr-2 hidden sm:flex">
                                                    {isRecording ? (
                                                        <SiriWaveform isActive={true} />
                                                    ) : isMicLoading ? (
                                                        <span className="text-xs text-slate-400 font-medium">启动麦克风...</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium">点击麦克风跟读</span>
                                                    )}
                                                </div>

                                                <AnimatePresence>
                                                    {userAudioUrl && !isRecording && !isMicLoading && (
                                                        <motion.button
                                                            initial={{ scale: 0, opacity: 0 }} 
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            exit={{ scale: 0, opacity: 0 }}
                                                            onClick={playUserAudio}
                                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                                                                isPlayingUserAudio 
                                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                                                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                                            }`}
                                                        >
                                                            {isPlayingUserAudio ? <Volume2 size={18} className="animate-pulse"/> : <PlayCircle size={18} />}
                                                            <span className="hidden sm:inline">我的发音</span>
                                                        </motion.button>
                                                    )}
                                                </AnimatePresence>

                                                <button
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    disabled={isMicLoading}
                                                    className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 shadow-xl border-[3px] border-white
                                                    ${isRecording 
                                                        ? 'bg-red-500 text-white shadow-red-500/40 scale-110' 
                                                        : isMicLoading
                                                            ? 'bg-slate-200 text-slate-400'
                                                            : 'bg-slate-900 text-white hover:scale-105 shadow-slate-900/30'}`}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {isMicLoading ? (
                                                            <motion.div key="loading" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                                <Loader2 size={24} className="animate-spin" />
                                                            </motion.div>
                                                        ) : isRecording ? (
                                                            <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                                <Square size={20} fill="currentColor" className="rounded-sm" />
                                                                <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-60"></span>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                                                <Mic size={24} />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {/* Main Controls */}
                            <div className="p-5 flex flex-col gap-5">
                                <div className="flex items-center gap-4 px-2">
                                    <span className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Speed</span>
                                    <div className="flex-1 relative h-8 flex items-center group">
                                        <ChevronsLeft size={16} className="text-slate-300 absolute left-[-24px] cursor-pointer hover:text-slate-500 transition-colors" onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.1))} />
                                        <input
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={playbackRate}
                                            onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                            className="w-full z-20 relative cursor-grab active:cursor-grabbing"
                                        />
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-slate-100 rounded-full w-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${((playbackRate - 0.5) / 1.5) * 100}%` }} />
                                        </div>
                                        <ChevronsRight size={16} className="text-slate-300 absolute right-[-24px] cursor-pointer hover:text-slate-500 transition-colors" onClick={() => setPlaybackRate(Math.min(2.0, playbackRate + 0.1))} />
                                    </div>
                                    <div className="w-12 text-right">
                                        <span className="text-sm font-mono text-violet-600 font-bold bg-violet-50 px-2 py-1 rounded-md">{playbackRate.toFixed(1)}x</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={toggleAutoPlay} 
                                    className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all border shadow-lg active:scale-[0.98]
                                    ${isAutoPlaying 
                                        ? 'bg-rose-50 text-rose-500 border-rose-100 shadow-rose-500/10 hover:bg-rose-100' 
                                        : 'bg-slate-900 text-white border-transparent hover:bg-slate-800 shadow-slate-900/30'
                                    }`}
                                >
                                    {isAutoPlaying ? (
                                        <>
                                            <PauseCircle size={22} className="animate-pulse" />
                                            <span>停止循环播放</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCcw size={20} />
                                            <span>开启自动循环</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
