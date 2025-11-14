// /components/WordsContentBlock.js

import React, { useState } from 'react';
import {
  GraduationCap, BookCopy, Users, Atom, Globe, ArrowLeft,
  Quote, Sigma, Clock, Map, HeartPulse, Waves, Smile, BrainCircuit, Home, UtensilsCrossed, Bus, Briefcase, Banknote, Sun, Palette, Film
} from 'lucide-react';
import SmartLink from './SmartLink';
import semanticData from '../../data/semantic_words.json'; // ✅ 导入真实数据

// ✅ 为每个大分类动态分配图标
const mainCategoryIcons = {
  1: Atom,
  2: Users,
  3: Home,
  4: BrainCircuit,
  5: Globe
};

// ✅ 为每个次分类动态分配图标
const subCategoryIcons = {
  101: Quote, 102: Sigma, 103: Clock, 104: Map,
  201: HeartPulse, 202: Waves, 203: Smile, 204: BrainCircuit,
  301: Home, 302: Users, 303: UtensilsCrossed, 304: Home, 305: Bus,
  401: BrainCircuit, 402: Quote, 403: GraduationCap, 404: Briefcase, 405: Banknote,
  501: Sun, 502: Palette, 503: Film
};

// HSK 等级数据和组件 (保持不变)
const hskLevels = [
  { level: 1, title: '入门级', wordCount: 150, progress: 75, color: 'from-green-400 to-cyan-500' },
  { level: 2, title: '初级', wordCount: 300, progress: 40, color: 'from-sky-400 to-blue-500' },
  { level: 3, title: '进阶级', wordCount: 600, progress: 15, color: 'from-indigo-400 to-purple-500' },
  { level: 4, title: '中级', wordCount: 1200, progress: 5, color: 'from-orange-400 to-red-500' },
  { level: 5, title: '高级', wordCount: 2500, progress: 0, color: 'from-rose-500 to-pink-600' },
  { level: 6, title: '精通级', wordCount: 5000, progress: 0, color: 'from-gray-600 to-black' }
];

const HskLevelGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {hskLevels.map(level => (
      <SmartLink href={`/words/hsk/${level.level}`} key={level.level} className="group block">
        <div className={`relative p-6 rounded-2xl shadow-lg text-white bg-gradient-to-br ${level.color} overflow-hidden transform transition-transform duration-300 group-hover:scale-105`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold">HSK {level.level}</h3>
              <p className="opacity-80">{level.title}</p>
            </div>
            <span className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">{level.wordCount} 词汇</span>
          </div>
          <div className="mt-8">
            <p className="text-sm opacity-90 mb-1">{`学习进度 ${level.progress}%`}</p>
            <div className="w-full bg-black/20 rounded-full h-2.5">
              <div className="bg-white rounded-full h-2.5" style={{ width: `${level.progress}%` }}></div>
            </div>
          </div>
        </div>
      </SmartLink>
    ))}
  </div>
);

// 主题分类视图组件 (使用真实数据)
const ThemeView = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const mainCategoryColors = {
    1: 'bg-indigo-500', 2: 'bg-sky-500', 3: 'bg-emerald-500',
    4: 'bg-amber-500', 5: 'bg-rose-500'
  };

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
              <SmartLink href={`/words/theme/${sub.sub_category_id}`} key={sub.sub_category_id} className="group block">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 flex items-center gap-3 transform hover:scale-105 duration-300">
                    <SubIcon size={24} className={mainColor.replace('bg-', 'text-')} />
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{sub.sub_category_title}</span>
                </div>
              </SmartLink>
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

// 主组件 WordsContentBlock
const WordsContentBlock = () => {
  const [activeView, setActiveView] = useState('level');

  const buttonBaseStyle = "w-1/2 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-300 focus:outline-none";
  const activeButtonStyle = "bg-white dark:bg-gray-700 text-blue-500 shadow";
  const inactiveButtonStyle = "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-500/10";

  return (
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
        {activeView === 'level' ? <HskLevelGrid /> : <ThemeView />}
      </div>
    </div>
  );
};

export default WordsContentBlock;
