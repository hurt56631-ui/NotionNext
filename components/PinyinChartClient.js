// /components/PinyinChartClient.js  <-- 全新美化+功能升级版

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
        if (!item.audio) return;
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
            }, 300);
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

    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6 min-h-screen">
            <audio ref={audioRef} onEnded={handleAudioEnd} />
            
            <div className="flex items-center justify-between mb-8">
                {/* 链接到首页 */}
                <Link href="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors p-2 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm border border-white/30">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{initialData.title}</h1>
                <div className="w-12"></div>
            </div>

            <div className="grid grid-cols-4 gap-4 sm:gap-5">
                {initialData.items.map((item, index) => (
                    <motion.div
                        key={item.letter}
                        onClick={() => playAudio(item, index)}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl shadow-xl cursor-pointer transition-all duration-300 border
                        ${isPlaying === item.letter 
                            ? 'bg-cyan-500/90 border-cyan-300 ring-4 ring-cyan-300/50 shadow-cyan-500/30' 
                            : 'bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-white/20 hover:border-white/50 shadow-md hover:shadow-lg'}`}
                        whileTap={!isAutoPlaying ? { scale: 0.95 } : {}}
                    >
                        <span className={`text-4xl sm:text-5xl font-bold transition-colors ${isPlaying === item.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                            {item.letter}
                        </span>
                        {item.audio && (
                           <Volume2 size={16} className={`mt-1 transition-colors ${isPlaying === item.letter ? 'text-white/80' : 'text-gray-400'}`}/>
                        )}
                    </motion.div>
                ))}
            </div>
            
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
