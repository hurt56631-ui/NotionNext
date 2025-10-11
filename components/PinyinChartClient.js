// /components/PinyinChartClient.js  <-- 新建文件

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Volume2, PlayCircle, PauseCircle, FastForward, Rewind } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PinyinChartClient({ initialData }) {
    const [isPlaying, setIsPlaying] = useState(null); // 正在播放的字母
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1500); // 间隔毫秒

    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    // 播放指定音频
    const playAudio = (item, index) => {
        if (!item.audio || (audioRef.current && !audioRef.current.paused)) return;

        audioRef.current.src = item.audio;
        audioRef.current.play();
        setIsPlaying(item.letter);
        setCurrentIndex(index);
    };

    // 自动播放的核心逻辑
    useEffect(() => {
        // 清理函数，组件卸载时停止一切
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioRef.current) {
                audioRef.current.onended = null;
            }
        };
    }, []);

    useEffect(() => {
        if (isAutoPlaying) {
            playAudio(initialData.items[currentIndex], currentIndex);
        } else {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    }, [isAutoPlaying, currentIndex]);


    const handleAudioEnd = () => {
        setIsPlaying(null);
        if (isAutoPlaying) {
            timeoutRef.current = setTimeout(() => {
                // 播放下一个，如果到结尾则停止
                const nextIndex = currentIndex + 1;
                if (nextIndex < initialData.items.length) {
                    setCurrentIndex(nextIndex);
                } else {
                    setIsAutoPlaying(false); // 播放完毕
                    setCurrentIndex(0);
                }
            }, playbackSpeed);
        }
    };
    
    const toggleAutoPlay = () => {
        if (isAutoPlaying) {
            setIsAutoPlaying(false);
            if(timeoutRef.current) clearTimeout(timeoutRef.current);
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(null);
        } else {
            setCurrentIndex(0); // 从头开始
            setIsAutoPlaying(true);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-4 sm:p-6">
            {/* 隐藏的audio元素 */}
            <audio ref={audioRef} onEnded={handleAudioEnd} />

            {/* 顶部导航 */}
            <div className="flex items-center justify-between mb-6">
                <Link href="/" className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                    返回
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{initialData.title}</h1>
                <div className="w-20"></div> {/* 占位符，使标题居中 */}
            </div>

            {/* 字母表网格 */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4">
                {initialData.items.map((item, index) => (
                    <motion.div
                        key={item.letter}
                        onClick={() => playAudio(item, index)}
                        className={`relative aspect-square flex flex-col items-center justify-center rounded-lg shadow-md cursor-pointer transition-all duration-300 ${isPlaying === item.letter ? 'bg-yellow-400 dark:bg-yellow-600 scale-105' : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className={`text-3xl sm:text-4xl font-bold ${isPlaying === item.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                            {item.letter}
                        </span>
                        {item.audio && (
                           <Volume2 size={16} className={`mt-1 ${isPlaying === item.letter ? 'text-white/80' : 'text-gray-400'}`}/>
                        )}
                         {/* 播放指示器 */}
                        <AnimatePresence>
                        {isPlaying === item.letter && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 border-2 border-yellow-500 rounded-lg"
                            />
                        )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
            
            {/* 底部控制台 */}
            <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                 <button onClick={toggleAutoPlay} className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-blue-500 text-white font-semibold rounded-md shadow-md hover:bg-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">
                    {isAutoPlaying ? <PauseCircle /> : <PlayCircle />}
                    {isAutoPlaying ? '停止播放' : '自动播放'}
                </button>
                <div className="mt-4">
                    <label htmlFor="speed" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">播放间隔 (语速)</label>
                    <div className="flex items-center gap-3">
                        <Rewind size={16} className="text-gray-400" />
                        <input
                            id="speed"
                            type="range"
                            min="500" // 0.5秒
                            max="3000" // 3秒
                            step="100"
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        <FastForward size={16} className="text-gray-400" />
                    </div>
                     <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                        当前间隔: {(playbackSpeed / 1000).toFixed(1)}秒
                    </div>
                </div>
            </div>
        </div>
    );
}
