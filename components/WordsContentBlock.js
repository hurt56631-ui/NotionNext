// /components/WordsContentBlock.js

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// 导入图标
import { BookOpen, ChevronRight, BarChart3 } from 'lucide-react';

// --- 动态导入 WordCard 组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });

// --- 数据中心 ---

// HSK 单词数据加载
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) {}
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) {}
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) {}
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) {}
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) {}
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) {}

// --- UI 数据 ---

const hskLevels = [
  { level: 1, title: '入门级 (Introductory)', wordCount: 150 },
  { level: 2, title: '初级 (Basic)', wordCount: 300 },
  { level: 3, title: '进阶级 (Intermediate)', wordCount: 600 },
  { level: 4, title: '中级 (Upper Intermediate)', wordCount: 1200 },
  { level: 5, title: '高级 (Advanced)', wordCount: 2500 },
  { level: 6, title: '精通级 (Proficiency)', wordCount: 5000 }
];

// --- 子组件 ---

// HSK 列表项组件
const HskLevelList = ({ onVocabularyClick }) => (
  <div className="grid grid-cols-1 gap-4">
    {hskLevels.map((level, index) => (
      <motion.div
        key={level.level}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="group relative w-full"
      >
        <button
          onClick={() => onVocabularyClick(level)}
          className="w-full flex items-center justify-between p-5 rounded-2xl 
                     bg-pink-50 border border-pink-100
                     hover:bg-pink-100 hover:border-pink-200 hover:shadow-sm
                     transition-all duration-300 cursor-pointer text-left"
        >
          {/* 左侧：图标与标题 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-pink-400 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl font-bold font-serif">{level.level}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">HSK {level.level}</h3>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">{level.title}</p>
            </div>
          </div>

          {/* 右侧：词汇量与箭头 */}
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 text-gray-600">
              <BookOpen size={14} className="text-pink-400" />
              <span className="text-xs font-semibold">{level.wordCount} 词</span>
            </div>
            <ChevronRight size={20} className="text-gray-400 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
          </div>
        </button>
      </motion.div>
    ))}
  </div>
);

// --- 主组件 WordsContentBlock ---
const WordsContentBlock = () => {
  const router = useRouter();
  const [activeWords, setActiveWords] = useState(null);
  const [progressKey, setProgressKey] = useState(null);

  const isCardViewOpen = router.asPath.includes('#vocabulary');

  // 处理点击逻辑 - 简化为只处理 HSK
  const handleVocabularyClick = useCallback((data) => {
    const words = hskWordsData[data.level];
    const key = `hsk${data.level}`;

    if (words && words.length > 0) {
      setActiveWords(words);
      setProgressKey(key);
      router.push('/?tab=words#vocabulary', undefined, { shallow: true });
    } else {
      // 简单的提示反馈
      alert(`HSK ${data.level} 词汇列表正在准备中...`);
    }
  }, [router]);

  // 关闭卡片逻辑
  const handleCloseCard = useCallback(() => {
    setActiveWords(null);
    setProgressKey(null);
    if (window.location.hash.includes('#vocabulary')) {
        router.back(); 
    }
  }, [router]);

  // 监听路由 Hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      if (!window.location.hash.includes('vocabulary')) {
        setActiveWords(null);
        setProgressKey(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
  return (
    <>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 min-h-[50vh]">
        {/* 头部标题区域 */}
        <div className="mb-8 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 tracking-tight flex items-center justify-center sm:justify-start gap-2">
              <BarChart3 className="text-pink-500" />
              HSK 词汇等级
            </h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">
              选择适合您的等级，开始系统性地积累词汇。
            </p>
        </div>

        {/* 列表区域 */}
        <HskLevelList onVocabularyClick={handleVocabularyClick} /> 
      </div>

      {/* 弹出的单词卡片组件 */}
      <WordCard 
        isOpen={isCardViewOpen}
        words={activeWords || []}
        onClose={handleCloseCard}
        progressKey={progressKey || 'default-key'}
      />
    </>
  );
};

export default WordsContentBlock;
