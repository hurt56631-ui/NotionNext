// /components/WordsContentBlock.js

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// 导入图标
import { 
    ArrowLeft, BookOpen, ChevronRight, LayoutGrid, 
    Atom, Layers, Home, BrainCircuit, Globe,
    Quote, Sigma, Clock, Map, HeartPulse, Waves, Smile, 
    UtensilsCrossed, Bus, Briefcase, Banknote, Sun, Palette, Film 
} from 'lucide-react';

// --- 动态导入 WordCard 组件 (ssr: false 避免服务端渲染错误) ---
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

// --- UI 数据与配置 ---

const hskLevels = [
  { level: 1, title: '入门级 (Introductory)', wordCount: 150 },
  { level: 2, title: '初级 (Basic)', wordCount: 300 },
  { level: 3, title: '进阶级 (Intermediate)', wordCount: 600 },
  { level: 4, title: '中级 (Upper Intermediate)', wordCount: 1200 },
  { level: 5, title: '高级 (Advanced)', wordCount: 2500 },
  { level: 6, title: '精通级 (Proficiency)', wordCount: 5000 }
];

// 图标映射
const mainCategoryIcons = { 1: Atom, 2: Layers, 3: Home, 4: BrainCircuit, 5: Globe };
// 颜色映射（改为文字颜色，而不是背景色，看起来更清爽）
const mainCategoryColors = { 1: 'text-indigo-500', 2: 'text-sky-500', 3: 'text-emerald-500', 4: 'text-amber-500', 5: 'text-rose-500' };

const subCategoryIcons = { 
    101: Quote, 102: Sigma, 103: Clock, 104: Map, 
    201: HeartPulse, 202: Waves, 203: Smile, 204: BrainCircuit, 
    301: Home, 302: Layers, 303: UtensilsCrossed, 304: Home, 305: Bus, 
    401: BrainCircuit, 402: Quote, 403: GraduationCap, 404: Briefcase, 405: Banknote, 
    501: Sun, 502: Palette, 503: Film 
};
// 补充缺失的图标定义
import { GraduationCap } from 'lucide-react';

// --- 子组件 ---

// 1. HSK 列表组件 (浅粉色，一排一个)
const HskLevelList = ({ onVocabularyClick }) => (
  <div className="flex flex-col gap-3">
    {hskLevels.map((level, index) => (
      <motion.div
        key={level.level}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <button
          onClick={() => onVocabularyClick('hsk', level)}
          className="group w-full flex items-center justify-between p-4 rounded-xl 
                     bg-pink-50 border border-pink-100 hover:bg-pink-100 
                     transition-all duration-200 cursor-pointer text-left shadow-sm hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            {/* 圆形数字标 */}
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-pink-500 border border-pink-100 shadow-sm font-serif font-bold text-lg group-hover:scale-110 transition-transform">
              {level.level}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800">HSK {level.level}</h3>
              <p className="text-xs text-gray-500">{level.title}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-white/60 text-xs text-gray-600">
                <BookOpen size={12} className="text-pink-400" />
                <span>{level.wordCount}</span>
             </div>
             <ChevronRight size={20} className="text-gray-300 group-hover:text-pink-500 transition-colors" />
          </div>
        </button>
      </motion.div>
    ))}
  </div>
);

// 2. 主题场景视图 (改为清爽卡片风格)
const ThemeView = ({ onVocabularyClick }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  // 子分类视图
  if (selectedCategory) {
    const MainIcon = mainCategoryIcons[selectedCategory.main_category_id] || Layers;
    const themeColorClass = mainCategoryColors[selectedCategory.main_category_id] || 'text-gray-500';

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-1 mb-4 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          返回全部分类
        </button>
        
        <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <MainIcon size={28} className={themeColorClass} />
            <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedCategory.main_category_title}</h3>
                <p className="text-xs text-gray-500">{selectedCategory.main_category_description}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedCategory.sub_categories.map((sub, idx) => {
            const SubIcon = subCategoryIcons[sub.sub_category_id] || BookOpen;
            return (
              <motion.button 
                key={sub.sub_category_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="group p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-between text-left"
                onClick={() => onVocabularyClick('theme', sub)}
              >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                        <SubIcon size={18} className="text-gray-600 group-hover:text-indigo-500" />
                    </div>
                    <span className="font-medium text-gray-700 group-hover:text-gray-900">{sub.sub_category_title}</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400" />
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    );
  }

  // 主分类列表 (清爽风格，取代之前的彩色块)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {semanticData.map((cat, index) => {
        const MainIcon = mainCategoryIcons[cat.main_category_id] || Layers;
        const colorClass = mainCategoryColors[cat.main_category_id] || 'text-gray-500';
        
        return(
          <motion.button
            key={cat.main_category_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedCategory(cat)}
            className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-left"
          >
            <div className={`p-3 rounded-full bg-gray-50 group-hover:bg-white border border-transparent group-hover:border-gray-100 transition-colors`}>
                <MainIcon size={24} className={colorClass} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{cat.main_category_title}</h3>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cat.main_category_description}</p>
            </div>
          </motion.button>
        )
      })}
    </div>
  );
};

// --- 主组件 WordsContentBlock ---
const WordsContentBlock = () => {
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
      alert(`数据准备中...`);
    }
  }, [router]);

  const handleCloseCard = useCallback(() => {
    setActiveWords(null);
    setProgressKey(null);
    if (window.location.hash.includes('#vocabulary')) {
        router.back(); 
    }
  }, [router]);

  // 处理浏览器回退
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 min-h-[60vh]">
        
        {/* HSK Section */}
        <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-pink-400 rounded-full"></div>
                HSK 核心词汇
            </h2>
            <HskLevelList onVocabularyClick={handleVocabularyClick} /> 
        </div>

        {/* Theme Section */}
        <div>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-indigo-400 rounded-full"></div>
                主题场景分类
            </h2>
            <ThemeView onVocabularyClick={handleVocabularyClick} />
        </div>
      </div>

      {/* 单词卡片 */}
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
