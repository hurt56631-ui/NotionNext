// /components/PinyinChartClient.js

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
    ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, 
    Volume2, Sparkles, Mic, Square, Ear 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';

export default function PinyinChartClient({ initialData }) {
    // --- 基础状态 ---
    const [activeTab, setActiveTab] = useState(0);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [direction, setDirection] = useState(0); 
    
    // --- 播放状态 ---
    const [selectedItem, setSelectedItem] = useState(null); 
    const [isPlaying, setIsPlaying] = useState(null); 
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);

    // --- 录音状态 ---
    const [isRecording, setIsRecording] = useState(false);
    const [userAudioUrl, setUserAudioUrl] = useState(null);
    const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);

    // --- Refs ---
    const audioRef = useRef(null); 
    const userAudioRef = useRef(null); 
    const timeoutRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // ===========================
    // 逻辑部分 (保持不变，功能完美)
    // ===========================

    const playAudio = (item) => {
        if (!item?.audio) return;
        if (isAutoPlaying) setIsAutoPlaying(false);

        setSelectedItem(item);
        if (selectedItem?.letter !== item.letter) setUserAudioUrl(null);

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

    useEffect(() => {
        if (isAutoPlaying) {
            let item;
            if (initialData.categories) {
                item = initialData.categories[currentIndex.cat]?.rows[currentIndex.row]?.[currentIndex.col];
            } else {
                item = initialData.items[currentIndex.col];
            }
            
            if (item) {
                setSelectedItem(item); 
                if (item.audio) {
                    audioRef.current.src = item.audio;
                    audioRef.current.playbackRate = playbackRate;
                    audioRef.current.play().catch(e => console.error("自动播放失败:", e));
                    setIsPlaying(item.letter);
                } else {
                    handleAudioEnd(); 
                }
            }
        }
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [isAutoPlaying, currentIndex, playbackRate, initialData]); 

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

    // ===========================
    // 录音功能
    // ===========================

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setUserAudioUrl(URL.createObjectURL(audioBlob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("无法访问麦克风:", error);
            alert("请允许麦克风权限以使用对比功能。");
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
    // 交互与动画配置
    // ===========================

    const hasMultipleCategories = initialData.categories && initialData.categories.length > 1;
    const paginate = (newDirection) => {
        if (newDirection > 0 && activeTab < initialData.categories.length - 1) {
            setDirection(1); setActiveTab(activeTab + 1);
        } else if (newDirection < 0 && activeTab > 0) {
            setDirection(-1); setActiveTab(activeTab - 1);
        }
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => hasMultipleCategories && paginate(1),
        onSwipedRight: () => hasMultipleCategories && paginate(-1),
        preventDefaultTouchmoveEvent: true,
        trackMouse: true,
    });

    const variants = {
        enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
        center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
        exit: (direction) => ({ zIndex: 0, x: direction < 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
    };

    // ===========================
    // 核心渲染组件
    // ===========================

    const LetterButton = ({ item }) => {
        const isActive = isPlaying === item.letter; 
        const isSelected = selectedItem?.letter === item.letter;
        const hasAudio = !!item.audio;

        return (
            <motion.div
                onClick={() => playAudio(item)}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                // 关键样式变化：亮色背景
                className={`group relative aspect-square flex flex-col items-center justify-center rounded-3xl cursor-pointer transition-all duration-300 select-none
                ${isActive 
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30' 
                    : isSelected
                        ? 'bg-white border-2 border-violet-400 shadow-md' // 选中但没播放：白底蓝边
                        : 'bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200' // 默认：纯白微投影
                }`}
            >
                <span className={`pinyin-letter relative text-4xl sm:text-5xl font-extrabold tracking-tight leading-none
                    ${isActive ? 'text-white' : 'text-slate-800 group-hover:text-violet-600'}
                `}>
                    {item.letter}
                </span>
                
                <div className="absolute bottom-2 sm:bottom-3 h-5 flex items-center justify-center">
                    {hasAudio && (
                        <motion.div animate={isActive ? { scale: [1, 1.2, 1], opacity: 1 } : { scale: 1, opacity: 0.3 }}>
                            <Volume2 size={18} className={isActive ? 'text-white/90' : 'text-slate-300'} />
                        </motion.div>
                    )}
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
                {/* 分类 Tabs - 亮色胶囊 */}
                <div className="relative mb-6">
                    <div className="flex space-x-2 overflow-x-auto pb-2 scroll-hidden px-1">
                        {initialData.categories.map((cat, index) => {
                            const isSelected = activeTab === index;
                            return (
                                <button 
                                    key={cat.name} 
                                    onClick={() => { setDirection(index > activeTab ? 1 : -1); setActiveTab(index); setIsAutoPlaying(false); }} 
                                    className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap z-10 
                                    ${isSelected 
                                        ? 'text-white bg-slate-900 shadow-lg shadow-slate-900/20' 
                                        : 'text-slate-500 bg-white hover:bg-slate-100 border border-slate-100'}`}
                                >
                                    {cat.name}
                                </button>
                            )
                        })}
                    </div>
                </div>
                
                {/* 字母列表容器 */}
                <div className="relative min-h-[300px]">
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <motion.div
                            key={activeTab} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                            className="space-y-6"
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
            {/* 亮色模式全局样式 */}
            <style jsx global>{`
                body { background: #f8fafc; } /* 确保body也是亮色 */
                .pinyin-letter { font-family: ui-rounded, "Nunito", system-ui, sans-serif; }
                .scroll-hidden::-webkit-scrollbar { display: none; }
                
                /* 优化后的 Slider - 亮色版 */
                input[type=range] { -webkit-appearance: none; background: transparent; }
                input[type=range]::-webkit-slider-thumb { 
                    -webkit-appearance: none; height: 20px; width: 20px; 
                    border-radius: 50%; background: #7c3aed; /* Violet-600 */
                    cursor: pointer; margin-top: -8px; 
                    box-shadow: 0 2px 6px rgba(124, 58, 237, 0.3); border: 2px solid white;
                }
                input[type=range]::-webkit-slider-runnable-track { 
                    width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; 
                }
            `}</style>

            {/* 主背景 - 柔和的灰白 + 极淡的彩色光晕 */}
            <div className="min-h-screen w-full bg-slate-50 text-slate-800 relative overflow-hidden font-sans selection:bg-violet-200 selection:text-violet-900">
                {/* 背景光晕 (变得非常淡，只增加氛围感) */}
                <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />
                <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-[100px] pointer-events-none mix-blend-multiply" />

                <div className="max-w-2xl mx-auto p-5 sm:p-8 relative z-10 flex flex-col min-h-screen">
                    <audio ref={audioRef} onEnded={handleAudioEnd} />
                    <audio ref={userAudioRef} />
                    
                    {/* 顶栏 */}
                    <header className="flex items-center justify-between mb-8">
                        <Link href="/hsk" passHref>
                            <a className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-95 text-slate-600 hover:text-slate-900">
                                <ArrowLeft size={20} />
                            </a>
                        </Link>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-sm">
                            {initialData.title}
                        </h1>
                        <div className="w-11 h-11 flex items-center justify-center bg-white rounded-full border border-slate-200 shadow-sm">
                            <Sparkles size={20} className="text-violet-500" />
                        </div>
                    </header>

                    {/* 主内容 - 增加 pb-80 防止被底部面板遮挡 */}
                    <main className="flex-grow flex flex-col pb-80">
                        {renderContent()}
                    </main>
                    
                    {/* 底部悬浮控制舱 - 亮色磨砂玻璃 */}
                    <div className="fixed bottom-6 left-4 right-4 z-50 max-w-2xl mx-auto">
                        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[2rem] shadow-2xl shadow-slate-300/50 overflow-hidden ring-1 ring-slate-900/5">
                            
                            {/* 发音实验室 (动态展开) */}
                            <AnimatePresence mode="wait">
                                {selectedItem && !isAutoPlaying ? (
                                    <motion.div 
                                        key="recorder"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-b border-slate-100 bg-slate-50/50"
                                    >
                                        <div className="p-5 flex items-center justify-between gap-4">
                                            <div className="flex flex-col items-start">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CONTRAST</span>
                                                <div className="flex items-baseline gap-3">
                                                    <span className="text-4xl font-black text-slate-800 leading-none">{selectedItem.letter}</span>
                                                    <button 
                                                        onClick={() => playAudio(selectedItem)}
                                                        className="p-2 rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 active:scale-90 transition-all"
                                                    >
                                                        <Ear size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {userAudioUrl && (
                                                    <motion.button
                                                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                        onClick={playUserAudio}
                                                        disabled={isRecording}
                                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                                                            isPlayingUserAudio 
                                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                                                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                                                        }`}
                                                    >
                                                        <PlayCircle size={18} />
                                                        回放
                                                    </motion.button>
                                                )}

                                                <button
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all shadow-lg border-4 border-white
                                                    ${isRecording 
                                                        ? 'bg-red-500 text-white shadow-red-500/30 scale-110' 
                                                        : 'bg-slate-900 text-white hover:scale-105 shadow-slate-900/20'}`}
                                                >
                                                    {isRecording ? (
                                                        <>
                                                            <Square size={20} fill="currentColor" />
                                                            <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-50"></span>
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

                            {/* 控制区域 */}
                            <div className="p-5 flex flex-col gap-4">
                                {/* 语速条 */}
                                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <span className="text-xs text-slate-400 font-bold px-1">语速</span>
                                    <ChevronsLeft size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setPlaybackRate(Math.max(0.5, playbackRate - 0.1))} />
                                    <div className="flex-1 relative h-6 flex items-center mx-2">
                                        <input
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={playbackRate}
                                            onChange={(e) => setPlaybackRate(Number(e.target.value))}
                                            className="w-full z-20 relative"
                                        />
                                        {/* 轨道背景 */}
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 rounded-full w-full" />
                                        {/* 进度条颜色 */}
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-violet-500 rounded-full z-10 pointer-events-none" style={{ width: `${((playbackRate - 0.5) / 1.5) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-violet-600 font-bold min-w-[30px] text-right">{playbackRate.toFixed(1)}x</span>
                                    <ChevronsRight size={16} className="text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setPlaybackRate(Math.min(2.0, playbackRate + 0.1))} />
                                </div>

                                {/* 自动播放按钮 */}
                                <button 
                                    onClick={toggleAutoPlay} 
                                    className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all border shadow-sm
                                    ${isAutoPlaying 
                                        ? 'bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100' 
                                        : 'bg-slate-900 text-white border-transparent hover:bg-slate-800 shadow-slate-900/20'
                                    }`}
                                >
                                    {isAutoPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
                                    {isAutoPlaying ? '停止自动播放' : '开启自动循环'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
