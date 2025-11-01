// /components/PinyinChartClient.js <-- 这是修改好的完整版本，请直接替换

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PinyinChartClient({ initialData }) {
    const [isPlaying, setIsPlaying] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [activeTab, setActiveTab] = useState(0);

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
    }, [isAutoPlaying, currentIndex, playbackRate]);

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

    const renderGrid = () => {
      if (!initialData.categories) {
        return (
          <div className="grid grid-cols-4 gap-4 sm:gap-5">
            {initialData.items.map((item) => (
              <LetterButton key={item.letter} item={item} />
            ))}
          </div>
        );
      }
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
        whileTap={{ scale: 0.88, transition: { duration: 0.1 } }}
        className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-colors duration-200 border shadow-lg 
        ${isPlaying === item.letter 
            ? 'bg-teal-500 border-teal-300 ring-2 ring-teal-400'
            : 'bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg border-white/20 hover:border-white/50'
        }`}
      >
        {/* ✨ [关键修改] 在这里添加了 pinyin-letter 类名 */}
        <span className={`pinyin-letter relative text-4xl sm:text-5xl font-bold transition-colors ${isPlaying === item.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
          {item.letter}
        </span>
        <div className={`relative mt-1 h-4 w-4 transition-colors ${item.audio ? (isPlaying === item.letter ? 'text-white' : 'text-gray-400') : 'text-transparent'}`}>
            {item.audio && <Volume2 size={16} />}
        </div>
      </motion.div>
    );

    return (
      // ✨ [关键修改] 在这里添加了 <style jsx> 块
      <>
        <style jsx>{`
          .pinyin-letter {
            /* 
              核心修复代码：
              通过禁用字体特性来绕过 Chrome/Blink 渲染引擎的 bug。
              这可以解决第一声在多字母组合中出现的“黑点”和“偏移”问题。
            */
            font-variant-ligatures: none;
            -webkit-font-feature-settings: "liga" 0, "clig" 0;
            font-feature-settings: "liga" 0, "clig" 0;
            font-kerning: none;
          }
        `}</style>
        <div className="max-w-xl mx-auto p-4 sm:p-6 min-h-screen">
          <audio ref={audioRef} onEnded={handleAudioEnd} />
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors p-2 rounded-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm border border-white/30">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 tracking-wider">{initialData.title}</h1>
            <div className="w-12"></div>
          </div>

          {renderGrid()}
          
          <div className="mt-10 p-5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20">
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
      </>
    );
                }
