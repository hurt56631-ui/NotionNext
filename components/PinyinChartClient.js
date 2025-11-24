// /components/PinyinChartClient.js

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
    ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, 
    Volume2, Sparkles, Mic, Square, RotateCcw, Ear 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

export default function PinyinChartClient({ initialData }) {
    // --- 基础状态 ---
    const [activeTab, setActiveTab] = useState(0);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [direction, setDirection] = useState(0); // 动画方向
    
    // --- 播放状态 ---
    const [selectedItem, setSelectedItem] = useState(null); // 当前选中的字母对象（用于录音对比）
    const [isPlaying, setIsPlaying] = useState(null); // 当前正在播放原音的字母 Letter
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);

    // --- 录音状态 ---
    const [isRecording, setIsRecording] = useState(false);
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);

    // --- Refs ---
    const audioRef = useRef(null); // 原音播放器
    const userAudioRef = useRef(null); // 用户录音播放器
    const timeoutRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // ===========================
    // 逻辑部分：原音播放
    // ===========================

    const playAudio = (item) => {
        if (!item?.audio) return;
        
        // 如果是自动播放中，阻止手动点击干扰（或者你可以选择暂停自动播放）
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
        }

        // 设置选中项，触发底部录音面板
        setSelectedItem(item);
        // 清空之前的录音，因为换字母了
        if (selectedItem?.letter !== item.letter) {
            setUserAudioUrl(null);
        }

        // 播放逻辑
        audioRef.current.src = item.audio;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch(e => console.error("音频播放失败:", e));
        setIsPlaying(item.letter);
    };

    const handleAudioEnd = () => {
        setIsPlaying(null);
        
        // 自动播放逻辑
        if (isAutoPlaying) {
            timeoutRef.current = setTimeout(() => {
                let nextIndex;
                // 计算下一个索引...
                if (initialData.categories) {
                    const cat = initialData.categories[currentIndex.cat];
                    if (currentIndex.col < cat.rows[currentIndex.row].length - 1) {
                        nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                    } else if (currentIndex.row < cat.rows.length - 1) {
                        nextIndex = { ...currentIndex, row: currentIndex.row + 1, col: 0 };
                    } else {
                        setIsAutoPlaying(false); // 分类播完停止
                        return;
                    }
                } else {
                    if (currentIndex.col < initialData.items.length - 1) {
                        nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                    } else {
                        setIsAutoPlaying(false); // 列表播完停止
                        return;
                    }
                }
                setCurrentIndex(nextIndex);
            }, 300);
        }
    };

    // 监听自动播放索引变化，触发播放
    useEffect(() => {
        if (isAutoPlaying) {
            let item;
            if (initialData.categories) {
                item = initialData.categories[currentIndex.cat]?.rows[currentIndex.row]?.[currentIndex.col];
            } else {
                item = initialData.items[currentIndex.col];
            }
            
            if (item) {
                setSelectedItem(item); // 自动播放时也更新底部面板
                if (item.audio) {
                    audioRef.current.src = item.audio;
                    audioRef.current.playbackRate = playbackRate;
                    audioRef.current.play().catch(e => console.error("自动播放失败:", e));
                    setIsPlaying(item.letter);
                } else {
                    handleAudioEnd(); // 无音频跳过
                }
            }
        }
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [isAutoPlaying, currentIndex, playbackRate, initialData]); // 依赖项保持

    const toggleAutoPlay = () => {
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
            setIsPlaying(null);
        } else {
            // 开始自动播放前，重置索引到当前Tab的开头
            setCurrentIndex({ cat: activeTab, row: 0, col: 0 });
            setIsAutoPlaying(true);
        }
    };

    // ===========================
    // 逻辑部分：录音功能
    // ===========================

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setUserAudioUrl(audioUrl);
                
                // 停止所有轨道
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("无法访问麦克风:", error);
            alert("需要麦克风权限才能使用对比功能。");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
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
    // 交互与动画
    // ===========================

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
        enter: (direction) => ({ x: direction > 0 ? 50 : -50, opacity: 0, scale: 0.95 }),
        center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
        exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 50 : -50, opacity: 0, scale: 0.95 }),
    };

    // ===========================
    // 子组件
    // ===========================

    const LetterButton = ({ item }) => {
        const isActive = isPlaying === item.letter; // 正在播放原音
        const isSelected = selectedItem?.letter === item.letter; // 被选中（用于显示边框）
        const hasAudio = !!item.audio;

        return (
            <motion.div
                onClick={() => playAudio(item)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.92 }}
                className={`group relative aspect-square flex flex-col items-center justify-center rounded-3xl cursor-pointer transition-all duration-300 
                ${isSelected 
                    ? 'bg-white/20 border-2 border-white/60 shadow-xl shadow-violet-500/20' // 选中状态：更亮，有边框
                    : 'bg-white/10 dark:bg-black/40 hover:bg-white/20 border border-white/10' // 普通状态：加深背景，提高文字对比
                } backdrop-blur-md`}
            >
                {/* 播放时的发光背景 */}
                {isActive && (
                    <motion.div 
                        layoutId="active-glow"
                        className="absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 blur-md -z-10"
                    />
                )}

                {/* 字母：使用 font-extrabold 和 text-white 确保最大清晰度 */}
                <span className={`pinyin-letter relative text-4xl sm:text-5xl font-extrabold tracking-tight transition-colors duration-200 
                    ${isActive ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'text-white/95 drop-shadow-md'}
                `}>
                    {item.letter}
                </span>
                
                {/* 喇叭图标 */}
                <div className="absolute bottom-2 sm:bottom-3">
                    {hasAudio ? (
                        <motion.div 
                            animate={isActive ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 0.7 }}
                        >
                            <Volume2 size={18} className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/60'}`} />
                        </motion.div>
                    ) : <div className="h-4 w-4" />}
                </div>
            </motion.div>
        );
    };

    const renderContent = () => {
        if (!initialData.categories) {
            return (
                <div className="grid grid-cols-4 gap-4 sm:gap-6 p-1">
                    {initialData.items.map((item) => <LetterButton key={item.letter} item={item} />)}
                </div>
            );
        }
        return (
            <div {...swipeHandlers} className="flex flex-col flex-grow w-full">
                <div className="relative mb-6">
                    <div className="flex space-x-3 overflow-x-auto pb-2 scroll-hidden px-1">
                        {initialData.categories.map((cat, index) => {
                            const isSelected = activeTab === index;
                            return (
                                <button 
                                    key={cat.name} 
                                    onClick={() => { setDirection(index > activeTab ? 1 : -1); setActiveTab(index); setIsAutoPlaying(false); }} 
                                    className={`relative px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap z-10 border
                                    ${isSelected ? 'text-white border-violet-500/50 bg-violet-600/20 shadow-lg shadow-violet-900/20' : 'text-slate-300 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {isSelected && (
                                        <motion.div layoutId="tab-highlight" className="absolute inset-0 rounded-full border-2 border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] -z-10" />
                                    )}
                                    {cat.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
                <div className="relative min-h-[300px]">
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={activeTab} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                            className="space-y-5"
                        >
                            {initialData.categories[activeTab].rows.map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-4 gap-4 sm:gap-5">
                                    {row.map((item) => <LetterButton key={item.letter} item={item} />)}
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
                .pinyin-letter { font-family: ui-rounded, system-ui, sans-serif; }
                .scroll-hidden::-webkit-scrollbar { display: none; }
                .scroll-hidden { -ms-overflow-style: none; scrollbar-width: none; }
                input[type=range] { -webkit-appearance: none; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 18px; width: 18px; border-radius: 50%; background: #fff; cursor: pointer; margin-top: -7px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; }
            `}</style>

            <div className="min-h-screen w-full bg-[#0b1121] text-white relative overflow-hidden font-sans selection:bg-violet-500">
                {/* 增强的背景光效 */}
                <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
                <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-2xl mx-auto p-5 sm:p-8 relative z-10 flex flex-col min-h-screen">
                    <audio ref={audioRef} onEnded={handleAudioEnd} />
                    <audio ref={userAudioRef} />
                    
                    <header className="flex items-center justify-between mb-8">
                        <Link href="/hsk" passHref>
                            <a className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-all active:scale-95">
                                <ArrowLeft size={22} className="text-white" />
                            </a>
                        </Link>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-wide drop-shadow-sm">
                            {initialData.title}
                        </h1>
                        <div className="w-11 h-11 flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full border border-white/10">
                            <Sparkles size={20} className="text-violet-300" />
                        </div>
                    </header>

                    <main className="flex-grow flex flex-col pb-32">
                        {renderContent()}
                    </main>
                    
                    {/* 底部固定控制舱 */}
                    <div className="fixed bottom-6 left-4 right-4 z-50 max-w-2xl mx-auto">
                        {/* 磨砂玻璃容器 */}
                        <div className="bg-[#1a1f35]/80 dark:bg-black/70 backdrop-blur-2xl border border-white/15 rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden">
                            
                            {/* 区域1：发音实验室 (当选中字母时显示) */}
                            <AnimatePresence mode="wait">
                                {selectedItem && !isAutoPlaying ? (
                                    <motion.div 
                                        key="recorder"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-b border-white/10 bg-gradient-to-r from-violet-900/30 to-indigo-900/30"
                                    >
                                        <div className="p-5 flex items-center justify-between gap-4">
                                            {/* 左侧：当前字母信息 */}
                                            <div className="flex flex-col items-start">
                                                <span className="text-xs text-violet-300 font-bold tracking-wider uppercase mb-1">发音对比</span>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-white leading-none">{selectedItem.letter}</span>
                                                    <button 
                                                        onClick={() => playAudio(selectedItem)}
                                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all"
                                                    >
                                                        <Ear size={16} className="text-violet-200" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 右侧：录音控制 */}
                                            <div className="flex items-center gap-3">
                                                {/* 你的录音播放按钮 */}
                                                {userAudioUrl && (
                                                    <motion.button
                                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                        onClick={playUserAudio}
                                                        disabled={isRecording}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                                                            isPlayingUserAudio ? 'bg-green-500 text-white' : 'bg-white/10 text-green-400 hover:bg-green-500/20'
                                                        }`}
                                                    >
                                                        <PlayCircle size={18} />
                                                        我的发音
                                                    </motion.button>
                                                )}

                                                {/* 录音按钮 (核心) */}
                                                <button
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg
                                                    ${isRecording 
                                                        ? 'bg-red-500 text-white shadow-red-500/40' 
                                                        : 'bg-white text-slate-900 hover:scale-105 shadow-white/20'}`}
                                                >
                                                    {isRecording ? (
                                                        <>
                                                            <Square size={20} fill="currentColor" />
                                                            {/* 录音时的波纹动画 */}
                                                            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-75"></span>
                                                        </>
                                                    ) : (
                                                        <Mic size={24} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {/* 区域2：全局控制 (语速 & 自动播放) */}
                            <div className="p-5 flex flex-col gap-4">
                                {/* 语速 */}
                                <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                                    <span className="text-xs text-slate-400 font-bold px-2">语速</span>
                                    <ChevronsLeft size={16} className="text-slate-500" onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.1))} />
                                    <div className="flex-1 relative h-6 flex items-center mx-2">
                                        <input
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={playbackRate}
                                            onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                            className="w-full z-20 relative"
                                        />
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-600 rounded-full w-full opacity-50" />
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-violet-500 rounded-full z-10 pointer-events-none" style={{ width: `${((playbackRate - 0.5) / 1.5) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-violet-300 min-w-[30px] text-right">{playbackRate.toFixed(1)}x</span>
                                    <ChevronsRight size={16} className="text-slate-500" onClick={() => setPlaybackRate(Math.min(2.0, playbackRate + 0.1))} />
                                </div>

                                {/* 自动播放按钮 */}
                                <button 
                                    onClick={toggleAutoPlay} 
                                    className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all border
                                    ${isAutoPlaying 
                                        ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20' 
                                        : 'bg-white text-black border-transparent hover:bg-slate-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                    }`}
                                >
                                    {isAutoPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                                    {isAutoPlaying ? '停止自动播放' : '开启自动循环播放'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
