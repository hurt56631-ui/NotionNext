// /components/WordsContentBlock.js

import React, { useState } from 'react';
import {
  GraduationCap, BookCopy, Users, Atom, Globe, ArrowLeft,
  Quote, Link2, Sigma, Clock, Map, UserSquare, HeartPulse, Smile, BrainCircuit, Waves, UtensilsCrossed, Home, Bus, ShoppingCart, Briefcase, Banknote, Sun, Palette, Film
} from 'lucide-react';
import SmartLink from './SmartLink';

// =================================================================================
// ======================  数据中心：语义分类宝库  ========================
// =================================================================================

const semanticCategories = [
  // --- 第一部分：核心概念 ---
  {
    id: 1,
    title: '核心概念',
    description: '语言的基石，构建句子的必需元素',
    Icon: Atom,
    color: 'bg-indigo-500',
    subCategories: [
      { id: 101, title: '指代与关系', Icon: Quote },
      { id: 102, title: '数字与度量', Icon: Sigma },
      { id: 103, title: '时间与频率', Icon: Clock },
      { id: 104, title: '空间与方位', Icon: Map }
    ]
  },
  // --- 第二部分：个体与感知 ---
  {
    id: 2,
    title: '个体与感知',
    description: '围绕“人”本身，从身体到思想',
    Icon: UserSquare,
    color: 'bg-sky-500',
    subCategories: [
      { id: 201, title: '身体与健康', Icon: HeartPulse },
      { id: 202, title: '感官与感受', Icon: Waves },
      { id: 203, title: '情绪与情感', Icon: Smile },
      { id: 204, title: '品格与状态', Icon: BrainCircuit }
    ]
  },
  // --- 第三部分：社会与生活 ---
  {
    id: 3,
    title: '社会与生活',
    description: '个体在社会环境中的活动与关系',
    Icon: Users,
    color: 'bg-emerald-500',
    subCategories: [
      { id: 301, title: '日常行为', Icon: Home },
      { id: 302, title: '家庭与人际关系', Icon: Users },
      { id: 303, title: '饮食文化', Icon: UtensilsCrossed },
      { id: 304, title: '居住与环境', Icon: Home },
      { id: 305, title: '交通与出行', Icon: Bus }
    ]
  },
  // --- 第四部分：抽象与认知 ---
  {
    id: 4,
    title: '抽象与认知',
    description: '超越具体事物，进入思想与知识领域',
    Icon: BrainCircuit,
    color: 'bg-amber-500',
    subCategories: [
      { id: 401, title: '思想与认知', Icon: BrainCircuit },
      { id: 402, title: '语言与沟通', Icon: Quote },
      { id: 403, title: '教育与学习', Icon: GraduationCap },
      { id: 404, title: '工作与职业', Icon: Briefcase },
      { id: 405, title: '经济与商业', Icon: Banknote }
    ]
  },
  // --- 第五部分：世界与万物 ---
  {
    id: 5,
    title: '世界与万物',
    description: '扩展到人类社会之外的自然界',
    Icon: Globe,
    color: 'bg-rose-500',
    subCategories: [
      { id: 501, title: '自然与地理', Icon: Sun },
      { id: 502, title: '物品、颜色与形状', Icon: Palette },
      { id: 503, title: '文化与娱乐', Icon: Film }
    ]
  }
];

// 为了方便，我们将所有大分类和小分类整合到一个映射中
const allCategories = {};
semanticCategories.forEach(cat => {
  allCategories[cat.id] = cat;
  cat.subCategories.forEach(sub => {
    allCategories[sub.id] = { ...sub, parentId: cat.id, color: cat.color };
  });
});


// =================================================================================
// ======================  UI 组件  ========================
// =================================================================================

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

// 主题分类视图组件 (全新重写)
const ThemeView = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  if (selectedCategory) {
    return (
      <div>
        <button
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2 mb-6 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowLeft size={16} />
          返回主分类
        </button>
        <h2 className={`text-2xl font-bold mb-4 ${selectedCategory.color.replace('bg-', 'text-')}`}>
          {selectedCategory.title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedCategory.subCategories.map(sub => (
            <SmartLink href={`/words/theme/${sub.id}`} key={sub.id} className="group block">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <sub.Icon size={24} className={selectedCategory.color.replace('bg-', 'text-')} />
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{sub.title}</span>
                </div>
            </SmartLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {semanticCategories.map(cat => (
        <button
          key={cat.id}
          onClick={() => setSelectedCategory(cat)}
          className={`group text-left p-5 rounded-2xl shadow-lg text-white ${cat.color} overflow-hidden transform transition-transform duration-300 hover:scale-[1.03]`}
        >
          <div className="flex items-center gap-4">
            <cat.Icon size={32} />
            <div>
              <h3 className="text-xl font-bold">{cat.title}</h3>
              <p className="text-sm opacity-80 mt-1">{cat.description}</p>
            </div>
          </div>
        </button>
      ))}
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
