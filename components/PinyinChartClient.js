// /components/PinyinChartClient.js <-- 最终修复版 (包含声调表新布局和所有美化/功能)

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PinyinChartClient({ initialData }) {
    const [isPlaying, setIsPlaying] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0); // 发音语速

    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    // 播放指定音频
    const playAudio = (item, index) => {
        if (!item.audio) return; // 声调表可能没有audio
        if (isAutoPlaying) return;

        audioRef.current.src = item.audio;
        audioRef.current.playbackRate = playbackRate; // 设置播放速度
        audioRef.current.play();
        setIsPlaying(item.letter);
        setCurrentIndex(index);
    };
    
    // 自动播放的核心逻辑
    useEffect(() => {
        if (isAutoPlaying) {
            const currentItem = initialData.items[currentIndex];
            if (currentItem?.audio) {
                audioRef.current.src = currentItem.audio;
                audioRef.current.playbackRate = playbackRate;
                audioRef.current.play();
                setIsPlaying(currentItem.letter);
            }
        }
        
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if(audioRef.current) audioRef.current.onended = null;
        };
    }, [isAutoPlaying, currentIndex, playbackRate, initialData.items]);

    const handleAudioEnd = () => {
        setIsPlaying(null);
        if (isAutoPlaying) {
            timeoutRef.current = setTimeout(() => {
                const nextIndex = currentIndex + 1;
                if (nextIndex < initialData.items.length) {
                    setCurrentIndex(nextIndex);
                } else {
                    setIsAutoPlaying(false);
                    setCurrentIndex(0);
                }
            }, 300); // 固定间隔 0.3秒
        }
    };
    
    const toggleAutoPlay = () => {
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
            if(timeoutRef.current) clearTimeout(timeoutRef.current);
            if(audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlaying(null);
        } else {
            setCurrentIndex(0);
            setIsAutoPlaying(true);
        }
    };
    
    // --- 核心改动：声调表布局逻辑 ---
    const renderTonesGrid = () => {
        // 声调表逻辑：将 5 个音节 (a, ā, á, ǎ, à) 排列成 5 行 5 列的结构（这里我们模仿图片，基础音+四声+轻声）
        const toneItems = initialData.items; // 5个元素: a, ā, á, ǎ, à
        
        if (toneItems.length === 5 && initialData.title === '声调表') {
            // 结构：[基础音] | [一声] | [二声] | [三声] | [四声]
            // 我们将“轻声”视为最后一行（或者放在基础音旁边）
            
            const baseLetter = toneItems[0].letter; // 'a' (轻声，作为基准)
            const baseName = toneItems[0].name;   // '轻声'
            const tones = toneItems.slice(1);    // [ā, á, ǎ, à] (四声)

            // 构造一个 4 列的网格（共四声）
            const grid = [];
            const baseItem = { letter: baseLetter, name: baseName, audio: null };
            
            // 顶部行：放基础音 (a)
            grid.push(
                // 第一列：基础音/轻声
                <motion.div key="base" className="col-span-1 row-span-4 flex flex-col items-center justify-center p-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    <span className="text-5xl font-mono text-gray-700 dark:text-gray-300">{baseLetter}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{baseName}</span>
                </motion.div>
            );

            // 后续四列：放四声
            for (let i = 0; i < 4; i++) {
                const tone = tones[i];
                const clickHandler = () => {
                    if (tone.audio) playAudio(tone, i + 1); // 传入正确的索引和数据
                };
                
                grid.push(
                    <motion.div
                        key={tone.name}
                        onClick={clickHandler}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-xl shadow-md cursor-pointer transition-all duration-300 border 
                        ${isPlaying === tone.letter 
                            ? 'bg-green-500/90 border-green-300 ring-4 ring-green-300/50 shadow-green-500/30' 
                            : 'bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 hover:border-white/50'}`}
                        whileTap={!isAutoPlaying ? { scale: 0.95 } : {}}
                    >
                        <span className={`text-3xl font-mono transition-colors ${isPlaying === tone.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                            {tone.letter}
                        </span>
                        <span className={`text-xs mt-1 transition-colors ${isPlaying === tone.letter ? 'text-white/80' : 'text-gray-500'}`}>
                            {tone.name}
                        </span>
                        {/* 动态音量图标 */}
                        {isPlaying === tone.letter && (
                            <Volume2 size={18} className="absolute top-2 right-2 text-white animate-pulse" />
                        )}
                    </motion.div>
                );
            }
            
            return grid;
        }
        
        // 对于声母和韵母，保持原有的四列布局
        return initialData.items.map((item, index) => (
            <motion.div
                key={item.letter}
                onClick={() => playAudio(item, index)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl shadow-md cursor-pointer transition-all duration-300 border 
                ${isPlaying === item.letter 
                    ? 'bg-green-500/80 border-green-300 ring-2 ring-green-300/50' 
                    : 'bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/30 hover:border-white/50'}`}
                whileTap={!isAutoPlaying ? { scale: 0.95 } : {}}
            >
                <span className={`text-3xl font-mono transition-colors ${isPlaying === item.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                    {item.letter}
                </span>
                {/* 动态音量图标 */}
                {isPlaying === item.letter && (
                    <Volume2 size={16} className="absolute bottom-2 right-2 text-white animate-pulse" />
                )}
                {item.audio && !isPlaying === item.letter && <Volume2 size={16} className="absolute bottom-2 right-2 text-gray-400" />}
            </motion.div>
        ));
    }


    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 min-h-screen">
            <audio ref={audioRef} onEnded={handleAudioEnd} />
            
            {/* 顶部导航 */}
            <div className="flex items-center justify-between mb-8">
                <Link href="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors p-2 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm border border-white/30">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{initialData.title}</h1>
                <div className="w-12"></div>
            </div>

            {/* 字母/声调表网格 */}
            <div className={`gap-3 sm:gap-4 ${initialData.title === '声调表' ? 'grid grid-cols-5 auto-rows-max' : 'grid grid-cols-4 gap-4 sm:gap-5'}`}>
                {renderTonesGrid()}
            </div>
            
            {/* 底部控制台 */}
            <div className="mt-10 p-5 bg-white/30 dark:bg-gray-800/30 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20">
                 <button onClick={toggleAutoPlay} disabled={!initialData.items.some(i => i.audio)} className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-gray-400 disabled:shadow-none">
                    {isAutoPlaying ? <PauseCircle /> : <PlayCircle />}
                    {isAutoPlaying ? '停止播放' : '自动播放'}
                </button>
                <div className="mt-5">
                    <label htmlFor="speed" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">发音语速</label>
                    <div className="flex items-center gap-3">
                        <ChevronsLeft size={18} className="text-gray-500" />
                        <input
                            id="speed"
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={playbackRate}
                            onChange={(e) => setPlaybackRate(Number(e.target.value))}
                            className="w-full h-2 bg-gray-500/30 rounded-lg appearance-none cursor-pointer dark:bg-gray-900/40"
                        />
                        <ChevronsRight size={18} className="text-gray-500" />
                    </div>
                     <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                        当前速度: {playbackRate.toFixed(1)}x
                    </div>
                </div>
            </div>
        </div>
    );
                                }
