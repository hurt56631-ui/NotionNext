// /components/WordsContentBlock.js

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowLeft, GraduationCap, BookCopy, Layers, Quote, Sigma, Clock, Map, HeartPulse, Waves, Smile, BrainCircuit, Home, UtensilsCrossed, Bus, Briefcase, Banknote, Sun, Palette, Film } from 'lucide-react';

// --- 动态导入 WordCard 组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });

// --- 数据中心 ---

// 1. HSK 单词数据
let hskWordsData = {};
try { hskWordsData[1] = require('@/data/hsk/hsk1.json'); } catch (e) {}
try { hskWordsData[2] = require('@/data/hsk/hsk2.json'); } catch (e) {}
try { hskWordsData[3] = require('@/data/hsk/hsk3.json'); } catch (e) {}
try { hskWordsData[4] = require('@/data/hsk/hsk4.json'); } catch (e) {}
try { hskWordsData[5] = require('@/data/hsk/hsk5.json'); } catch (e) {}
try { hskWordsData[6] = require('@/data/hsk/hsk6.json'); } catch (e) {}

// 2. 语义分类单词数据
import semanticData from '@/data/semantic_words.json';

// --- UI 数据与辅助函数 ---

// a. HSK 等级 UI 数据
const hskLevels = [
  { level: 1, title: '入门级', wordCount: 150, color: 'from-green-400 to-cyan-500' },
  { level: 2, title: '初级', wordCount: 300, color: 'from-sky-400 to-blue-500' },
  { level: 3, title: '进阶级', wordCount: 600, color: 'from-indigo-400 to-purple-500' },
  { level: 4, title: '中级', wordCount: 1200, color: 'from-orange-400 to-red-500' },
  { level: 5, title: '高级', wordCount: 2500, color: 'from-rose-500 to-pink-600' },
  { level: 6, title: '精通级', wordCount: 5000, color: 'from-gray-600 to-black' }
];

// b. 语义分类图标和颜色映射
const mainCategoryIcons = { 1: Atom, 2: Layers, 3: Home, 4: BrainCircuit, 5: Globe };
const mainCategoryColors = { 1: 'bg-indigo-500', 2: 'bg-sky-500', 3: 'bg-emerald-500', 4: 'bg-amber-500', 5: 'bg-rose-500' };
const subCategoryIcons = { 101: Quote, 102: Sigma, 103: Clock, 104: Map, 201: HeartPulse, 202: Waves, 203: Smile, 204: BrainCircuit, 301: Home, 302: Layers, 303: UtensilsCrossed, 304: Home, 305: Bus, 401: BrainCircuit, 402: Quote, 403: GraduationCap, 404: Briefcase, 405: Banknote, 501: Sun, 502: Palette, 503: Film };

// --- 子组件 ---

// 1. HSK 等级卡片网格
const HskLevelGrid = ({ onVocabularyClick }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    {hskLevels.map(level => (
      <div 
        key={level.level}
        className={`relative p-6 rounded-2xl shadow-lg text-white bg-gradient-to-br ${level.color} overflow-hidden transform transition-transform duration-300 hover:scale-105 cursor-pointer`}
        onClick={() => onVocabularyClick('hsk', level)}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold">HSK {level.level}</h3>
            <p className="opacity-80">{level.title}</p>
          </div>
          <span className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">{level.wordCount} 词汇</span>
        </div>
        <div className="mt-8 text-center bg-black/20 hover:bg-black/30 transition-colors p-2 rounded-lg">
          点击开始学习
        </div>
      </div>
    ))}
  </div>
);

// 2. 主题场景分类视图
const ThemeView = ({ onVocabularyClick }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  if (selectedCategory) {
    const MainIcon = mainCategoryIcons[selectedCategory.main_category_id] || BookCopy;
    const mainColor = mainCategoryColors[selectedCategory.main_category_id] || 'bg-gray-500';

    return (
      <div>
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 mb-6 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowLeft size={16} />
          返回主分类
        </button>
        <div className="flex items-center gap-3 mb-4">
            <MainIcon className={`${mainColor.replace('bg-', 'text-')}`} />
            <h2 className={`text-2xl font-bold text-gray-800 dark:text-gray-200`}>
              {selectedCategory.main_category_title}
            </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedCategory.sub_categories.map(sub => {
            const SubIcon = subCategoryIcons[sub.sub_category_id] || BookCopy;
            return (
              <div 
                key={sub.sub_category_id} 
                className="group p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 flex items-center gap-3 transform hover:scale-105 duration-300 cursor-pointer"
                onClick={() => onVocabularyClick('theme', sub)}
              >
                  <SubIcon size={24} className={mainColor.replace('bg-', 'text-')} />
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{sub.sub_category_title}</span>
              </div>
            )
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {semanticData.map(cat => {
        const MainIcon = mainCategoryIcons[cat.main_category_id] || BookCopy;
        const mainColor = mainCategoryColors[cat.main_category_id] || 'bg-gray-500';
        return(
          <button
            key={cat.main_category_id}
            onClick={() => setSelectedCategory(cat)}
            className={`group text-left p-5 rounded-2xl shadow-lg text-white ${mainColor} overflow-hidden transform transition-transform duration-300 hover:scale-[1.03]`}
          >
            <div className="flex items-center gap-4">
              <MainIcon size={32} />
              <div>
                <h3 className="text-xl font-bold">{cat.main_category_title}</h3>
                <p className="text-sm opacity-80 mt-1">{cat.main_category_description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  );
};

// --- 主组件 WordsContentBlock ---
const WordsContentBlock = () => {
  const [activeView, setActiveView] = useState('level');
  const router = useRouter();
  const [activeWords, setActiveWords] = useState(null);
  const [progressKey, setProgressKey] = useState(null);

  const isCardViewOpen = router.asPath.includes('#vocabulary');

  const handleVocabularyClick = useCallback((type, data) => {
    let words = [];
    let key = '';

    if (type === 'hsk') {
      words = hskWordsData[data.level];
      key = `hsk${data.level}`;
    } else if (type === 'theme') {
      words = data.words;
      key = `theme_${data.sub_category_id}`;
    }

    if (words && words.length > 0) {
      setActiveWords(words);
      setProgressKey(key);
      router.push('/?tab=words#vocabulary', undefined, { shallow: true });
    } else {
      alert(`该分类下的词汇列表正在准备中，敬请期待！`);
    }
  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveWords(null);
    setProgressKey(null);
    if (window.location.hash.includes('#vocabulary')) {
        router.back(); 
    }
  }, [router]);

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
  
  const buttonBaseStyle = "w-1/2 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-300 focus:outline-none";
  const activeButtonStyle = "bg-white dark:bg-gray-700 text-blue-500 shadow";
  const inactiveButtonStyle = "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-500/10";

  return (
    <>
      <div className="max-w-5xl mx-auto p-2 sm:p-4">
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-xs p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex">
            <button
              onClick={() => setActiveView('level')}
              className={`${buttonBaseStyle} ${activeView === 'level' ? activeButtonStyle : inactiveButtonStyle}`}
            >
              按 HSK 等级
            </button>
            <button
              onClick={() => setActiveView('theme')}
              className={`${buttonBaseStyle} ${activeView === 'theme' ? activeButtonStyle : inactiveButtonStyle}`}
            >
              按主题场景
            </button>
          </div>
        </div>
        <div>
          {activeView === 'level' 
            ? <HskLevelGrid onVocabularyClick={handleVocabularyClick} /> 
            : <ThemeView onVocabularyClick={handleVocabularyClick} />
          }
        </div>
      </div>

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
