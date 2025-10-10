// /components/HskPageClient.js <-- 最终重构美化版

"use client"; // 声明为客户端组件，因为需要使用 useState 和事件处理

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Mic2 } from 'lucide-react';
import { motion } from 'framer-motion';

// --- 新增：拼音学习数据 ---
const pinyinData = {
  initials: {
    title: '声母表',
    description: 'Initials',
    items: ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w']
  },
  finals: {
    title: '韵母表',
    description: 'Finals',
    items: ['a', 'o', 'e', 'i', 'u', 'ü', 'ai', 'ei', 'ui', 'ao', 'ou', 'iu', 'ie', 'üe', 'er', 'an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong']
  },
  tones: {
    title: '声调表',
    description: 'Tones',
    items: [
      { symbol: 'ā', name: '一声' },
      { symbol: 'á', name: '二声' },
      { symbol: 'ǎ', name: '三声' },
      { symbol: 'à', name: '四声' },
      { symbol: 'a', name: '轻声' },
    ]
  }
};

// --- HSK 数据中心 (已简化) ---
const hskData = [
  { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'blue', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'green', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', color: 'yellow', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', color: 'orange', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', color: 'red', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', color: 'purple', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
];

// --- 颜色映射表 ---
const colorMap = {
  blue: { border: 'border-blue-500', text: 'text-blue-500', bg: 'bg-blue-500', shadow: 'shadow-blue-500/30' },
  green: { border: 'border-green-500', text: 'text-green-500', bg: 'bg-green-500', shadow: 'shadow-green-500/30' },
  yellow: { border: 'border-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/30' },
  orange: { border: 'border-orange-500', text: 'text-orange-500', bg: 'bg-orange-500', shadow: 'shadow-orange-500/30' },
  red: { border: 'border-red-500', text: 'text-red-500', bg: 'bg-red-500', shadow: 'shadow-red-500/30' },
  purple: { border: 'border-purple-500', text: 'text-purple-500', bg: 'bg-purple-500', shadow: 'shadow-purple-500/30' },
};


/**
 * ====================================================================
 * 新增：拼音学习卡片组件
 * ====================================================================
 */
const PinyinCard = ({ title, description, items, isTones = false }) => (
  <div className="relative w-full bg-white/60 dark:bg-gray-800/50 backdrop-blur-lg p-5 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/40">
    <div className="flex items-center gap-3 mb-4">
      <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg">
        <Mic2 className="text-gray-600 dark:text-gray-300" size={20} />
      </div>
      <div>
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <motion.div
          key={index}
          whileHover={{ scale: 1.1, y: -2 }}
          className="bg-gray-100 dark:bg-gray-900/60 rounded-md text-gray-700 dark:text-gray-300 font-mono text-center cursor-pointer"
          style={isTones ? { flexBasis: 'calc(20% - 8px)', padding: '12px 4px' } : { padding: '8px 12px' }}
        >
          {isTones ? (
            <div>
              <span className="text-2xl">{item.symbol}</span>
              <p className="text-xs mt-1">{item.name}</p>
            </div>
          ) : (
            item
          )}
        </motion.div>
      ))}
    </div>
  </div>
);


/**
 * ====================================================================
 * HSK 等级卡片组件 (已重构)
 * ====================================================================
 */
const HskLevelCard = ({ level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = colorMap[level.color] || colorMap.blue;
  const hasMore = level.lessons.length > 5;

  const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.3, type: 'spring' } }}
      className={`relative w-full bg-white dark:bg-gray-800/70 backdrop-blur-sm p-5 pl-7 rounded-2xl shadow-lg border border-gray-200/80 dark:border-gray-700/50 overflow-hidden`}
    >
      {/* 美化: 左侧增加彩色竖线代替数字块 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colors.bg} rounded-l-2xl`}></div>
      
      {/* 等级标题 (已移除数字块和拼音) */}
      <div className="mb-4">
        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{level.description}</p>
      </div>

      {/* 课程按钮列表 */}
      <motion.div layout className="flex flex-wrap gap-2">
        {visibleLessons.map(lesson => (
          <motion.button
            key={lesson.id}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600/80 transition-colors"
          >
            {lesson.title}
          </motion.button>
        ))}
        {hasMore && (
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-3 py-1.5 flex items-center gap-1 rounded-md text-sm font-semibold transition-colors ${isExpanded ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'}`}
          >
            {isExpanded ? '收起' : '更多'}
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
};


/**
 * ====================================================================
 * 汉语学习中心 (主组件)
 * ====================================================================
 */
const HskContentBlock = () => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 px-4 py-8">
      
      <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white">汉语学习中心</h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">Chinese Learning Center</p>
      </div>

      {/* --- 拼音学习区 --- */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-cyan-500 pl-3">拼音基础</h2>
        <PinyinCard title={pinyinData.initials.title} description={pinyinData.initials.description} items={pinyinData.initials.items} />
        <PinyinCard title={pinyinData.finals.title} description={pinyinData.finals.description} items={pinyinData.finals.items} />
        <PinyinCard title={pinyinData.tones.title} description={pinyinData.tones.description} items={pinyinData.tones.items} isTones={true} />
      </div>

      {/* --- HSK 课程区 --- */}
      <div className="space-y-6 pt-8">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-purple-500 pl-3">HSK 等级课程</h2>
        {hskData.map(level => (
          <HskLevelCard key={level.level} level={level} />
        ))}
      </div>
      
    </div>
  );
};

export default HskContentBlock;
