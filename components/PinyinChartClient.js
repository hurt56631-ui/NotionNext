// /components/PinyinChartClient.js <-- 这是修改好的完整版本，请直接替换

"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, PauseCircle, ChevronsLeft, ChevronsRight, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable'; // ✨ [新增] 导入手势库

export default function PinyinChartClient({ initialData }) {
    // --- 现有状态，基本保持不变 ---
    const [isPlaying, setIsPlaying] = useState(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState({ cat: 0, row: 0, col: 0 });
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [activeTab, setActiveTab] = useState(0);

    // ✨ [新增] 增加一个状态来追踪滑动方向，用于动画
    const [direction, setDirection] = useState(0); 

    const audioRef = useRef(null);
    const timeoutRef = useRef(null);
    
    // --- 现有函数，基本保持不变 ---
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
                  // 当前分类播放完毕，停止
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
    
    // 确保切换 Tab 或自动播放时，依赖项正确
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
          handleAudioEnd(); // 如果没有音频，直接跳到下一个
        }
      }
      return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [isAutoPlaying, currentIndex, playbackRate, initialData]);


    // ✨ [新增] 定义手势处理逻辑
    const hasMultipleCategories = initialData.categories && initialData.categories.length > 1;
    
    const paginate = (newDirection) => {
        // 检查是否可以切换
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
    
    // ✨ [新增] 定义动画变体
    const variants = {
        enter: (direction) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction) => ({
            zIndex: 0,
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    };

    // ✨ [重构] 将渲染逻辑拆分并集成手势和动画
    const renderContent = () => {
        // 声母表（无分类）
        if (!initialData.categories) {
            return (
                <div className="grid grid-cols-4 gap-4 sm:gap-5">
                    {initialData.items.map((item) => (
                        <LetterButton key={item.letter} item={item} />
                    ))}
                </div>
            );
        }

        // 韵母/声调表（有分类）
        return (
            <div {...swipeHandlers} className="flex flex-col flex-grow overflow-hidden">
                {/* 分类 Tabs */}
                <div className="flex space-x-2 overflow-x-auto pb-4 mb-4 scroll-hidden border-b border-white/10">
                    {initialData.categories.map((cat, index) => (
                        <button 
                            key={cat.name} 
                            onClick={() => { 
                                // 点击时也设置方向，以触发动画
                                setDirection(index > activeTab ? 1 : -1);
                                setActiveTab(index); 
                                setIsAutoPlaying(false); 
                            }} 
                            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === index ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            {activeTab === index && <motion.div layoutId="tab-highlight" className="absolute inset-0 bg-yellow-500/80 rounded-lg" />}
                            <span className="relative z-10">{cat.name}</span>
                        </button>
                    ))}
                </div>
                
                {/* 带动画的内容区域 */}
                <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                        key={activeTab} // 关键！让 AnimatePresence 知道组件已改变
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="space-y-3"
                    >
                        {initialData.categories[activeTab].rows.map((row, rowIndex) => (
                            <div key={rowIndex} className="grid grid-cols-4 gap-3">
                                {row.map((item) => (
                                    <LetterButton key={item.letter} item={item} />
                                ))}
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
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
        <span className={`pinyin-letter relative text-4xl sm:text-5xl font-bold transition-colors ${isPlaying === item.letter ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
          {item.letter}
        </span>
        <div className={`relative mt-1 h-4 w-4 transition-colors ${item.audio ? (isPlaying === item.letter ? 'text-white' : 'text-gray-400') : 'text-transparent'}`}>
            {item.audio && <Volume2 size={16} />}
        </div>
      </motion.div>
    );

    return (
      <>
        <style jsx>{`
          .pinyin-letter {
            font-variant-ligatures: none;
            -webkit-font-feature-settings: "liga" 0, "clig" 0;
            font-feature-settings: "liga" 0, "clig" 0;
            font-kerning: none;
          }
          .scroll-hidden::-webkit-scrollbar { display: none; }
          .scroll-hidden { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        <div className="max-w-xl mx-auto p-4 sm:p-6 min-h-screen flex flex-col">
          <audio ref={audioRef} onEnded={handleAudioEnd} />
          
          <div className="flex items-center justify-between mb-8">
            <Link href="/hsk" passHref>
                <a className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors p-2 rounded-lg bg-black/20 backdrop-blur-sm border border-white/30">
                    <ArrowLeft size={20} />
                </a>
            </Link>
            <h1 className="text-3xl font-bold text-gray-100 tracking-wider">{initialData.title}</h1>
            <div className="w-12"></div>
          </div>

          {/* ✨ 调用重构后的渲染函数 */}
          {renderContent()}
          
          {/* 控制面板部分保持不变，但增加一个外层 div 以便布局 */}
          <div className="mt-auto pt-6">
            <div className="p-5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20">
              <button 
                  onClick={toggleAutoPlay} 
                  disabled={!initialData.items?.some(i => i.audio) && !initialData.categories} 
                  className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all focus:outline-none ring-2 ring-transparent focus-visible:ring-teal-300 disabled:bg-gray-400 disabled:shadow-none"
              >
                {isAutoPlaying ? <PauseCircle /> : <PlayCircle />}
                {isAutoPlaying ? '停止播放' : '自动播放'}
              </button>
              <div className="mt-5">
                <label className="block text-sm font-medium text-gray-300 mb-2">发音语速</label>
                <div className="flex items-center gap-3">
                  <ChevronsLeft size={18} className="text-gray-400" />
                  <input
                    type="range" min="0.5" max="2.0" step="0.1"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-500/30 rounded-lg appearance-none cursor-pointer dark:bg-gray-900/40"
                  />
                  <ChevronsRight size={18} className="text-gray-400" />
                </div>
                <div className="text-center text-xs text-gray-400 mt-1">
                  当前速度: {playbackRate.toFixed(1)}x
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
                }
