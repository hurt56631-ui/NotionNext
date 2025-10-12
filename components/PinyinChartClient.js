// /components/PinyinChartClient.js <-- 最终版 (全新动画和声调表布局)

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- (新增) 自定义声波动画图标 ---
const SoundWaveIcon = ({ isPlaying }) => (
  <div className="w-4 h-4 flex justify-between items-end">
    <motion.span
      animate={{ scaleY: isPlaying ? [1, 0.4, 1] : 0.2 }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="w-1 h-full bg-current rounded-full"
      style={{ transformOrigin: 'bottom' }}
    />
    <motion.span
      animate={{ scaleY: isPlaying ? [0.5, 1, 0.5] : 0.2 }}
      transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
      className="w-1 h-full bg-current rounded-full"
      style={{ transformOrigin: 'bottom' }}
    />
    <motion.span
      animate={{ scaleY: isPlaying ? [0.7, 0.3, 0.7] : 0.2 }}
      transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
      className="w-1 h-full bg-current rounded-full"
      style={{ transformOrigin: 'bottom' }}
    />
  </div>
);

export default function PinyinChartClient({ initialData }) {
    const [isPlaying, setIsPlaying] = useState(null); // 正在播放的字母 (e.g., 'ā')
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [activeTab, setActiveTab] = useState(0); // 用于声调表

    const audioRef = useRef(null);
    const timeoutRef = useRef(null);

    const playAudio = (item) => {
        if (!item?.audio || isAutoPlaying) return;
        audioRef.current.src = item.audio;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch(e => console.error("音频播放失败:", e));
        setIsPlaying(item.letter);
    };

    useEffect(() => {
      // 自动播放逻辑
      if (isAutoPlaying) {
        let item;
        if (initialData.categories) { // 声调表
          item = initialData.categories[currentIndex.cat]?.rows[currentIndex.row]?.[currentIndex.col];
        } else { // 声母/韵母表
          item = initialData.items[currentIndex.col];
        }
        
        if (item?.audio) {
          audioRef.current.src = item.audio;
          audioRef.current.playbackRate = playbackRate;
          audioRef.current.play().catch(e => console.error("音频播放失败:", e));
          setIsPlaying(item.letter);
        } else {
          // 如果当前项没有音频，跳到下一个
          handleAudioEnd();
        }
      }
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [isAutoPlaying, currentIndex, playbackRate]);

    const handleAudioEnd = () => {
        setIsPlaying(null);
        if (isAutoPlaying) {
            timeoutRef.current = setTimeout(() => {
              let nextIndex;
              if (initialData.categories) { // 声调表
                const cat = initialData.categories[currentIndex.cat];
                if (currentIndex.col < cat.rows[currentIndex.row].length - 1) {
                  nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                } else if (currentIndex.row < cat.rows.length - 1) {
                  nextIndex = { ...currentIndex, row: currentIndex.row + 1, col: 0 };
                } else {
                  setIsAutoPlaying(false); // 当前类别播放完毕
                  return;
                }
              } else { // 声母/韵母表
                if (currentIndex.col < initialData.items.length - 1) {
                  nextIndex = { ...currentIndex, col: currentIndex.col + 1 };
                } else {
                  setIsAutoPlaying(false); // 播放完毕
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
            // 从当前活动Tab的第一项开始
            setCurrentIndex({ cat: activeTab, row: 0, col: 0 });
            setIsAutoPlaying(true);
        }
    };

    // --- 渲染函数 ---
    const renderGrid = () => {
      // 声母/韵母表
      if (!initialData.categories) {
        return (
          <div className="grid grid-cols-4 gap-4 sm:gap-5">
            {initialData.items.map((item) => (
              <LetterButton key={item.letter} item={item} />
            ))}
          </div>
        );
      }
      // 声调表
      return (
        <div>
          <div className="flex space-x-2 overflow-x-auto pb-4 mb-4 scroll-hidden">
            {initialData.categories.map((cat, index) => (
              <button key={cat.name} onClick={() => { setActiveTab(index); setIsAutoPlaying(false); }} className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === index ? 'text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-white/20'}`}>
                {activeTab === index && <motion.div layoutId="tab-highlight" className="absolute inset-0 bg-yellow-500 rounded-lg" />}
                <span className="relative z-10">{cat.name}</span>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {initialData.categories[activeTab].rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-3">
                {row.map((item) => (
                  <LetterButton key={item.letter} item={item} />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    };

    const LetterButton = ({ item }) => (
      <motion.div
        onClick={() => playAudio(item)}
        className="relative aspect-square flex flex-col items-center justify-center rounded-2xl cursor-pointer bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border border-white/20 shadow-lg"
        whileTap={{ scale: 0.92 }}
      >
        {isPlaying === item.letter && (
          <motion.div 
            layoutId="highlight"
            className="absolute inset-0 bg-teal-500 rounded-2xl"
          />
        )}
        <span className="relative text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white">
          {item.letter}
        </span>
        <div className={`relative mt-1 h-4 w-4 ${item.audio ? 'text-gray-400' : 'text-transparent'}`}>
            <SoundWaveIcon isPlaying={isPlaying === item.letter} />
        </div>
      </motion.div>
    );

    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 min-h-screen">
        <audio ref={audioRef} onEnded={handleAudioEnd} />
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors p-2 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-sm border border-white/30">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-wider">{initialData.title}</h1>
          <div className="w-12"></div>
        </div>

        {renderGrid()}
        
        <div className="mt-10 p-5 bg-white/30 dark:bg-gray-800/30 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20">
          <button onClick={toggleAutoPlay} disabled={!initialData.items?.some(i => i.audio) && !initialData.categories} className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all focus:outline-none ring-2 ring-transparent focus-visible:ring-teal-300 disabled:bg-gray-400 disabled:shadow-none">
            {isAutoPlaying ? <PauseCircle /> : <PlayCircle />}
            {isAutoPlaying ? '停止播放' : '自动播放'}
          </button>
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">发音语速</label>
            <div className="flex items-center gap-3">
              <ChevronsLeft size={18} className="text-gray-500" />
              <input
                type="range"
                min="0.5" max="2.0" step="0.1"
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
