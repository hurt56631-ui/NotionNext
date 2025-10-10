// /components/HskPageClient.js <-- 最终美化增强版

"use client"; // 声明为客户端组件，因为需要使用 useState 和事件处理

import { useState } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 数据中心 (已更新) ---
// 增加了 pinyin 字段
const hskData = [
  { level: 1, title: '入门水平', pinyin: 'rùmén shuǐpíng', description: '掌握最常用词语和基本语法', color: 'blue', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 2, title: '基础水平', pinyin: 'jīchǔ shuǐpíng', description: '就熟悉的日常话题进行交流', color: 'green', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 3, title: '进阶水平', pinyin: 'jìnjiē shuǐpíng', description: '完成生活、学习、工作的基本交际', color: 'yellow', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 4, title: '中级水平', pinyin: 'zhōngjí shuǐpíng', description: '流畅地与母语者进行交流', color: 'orange', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 5, title: '高级水平', pinyin: 'gāojí shuǐpíng', description: '阅读报刊杂志，欣赏影视节目', color: 'red', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
  { level: 6, title: '流利水平', pinyin: 'liúlì shuǐpíng', description: '轻松理解信息，流利表达观点', color: 'purple', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
];

// --- 颜色映射表 ---
// 用于生成更丰富、更协调的 Tailwind CSS 颜色类
const colorMap = {
  blue: { bg: 'bg-blue-500', gradient: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-500/30' },
  green: { bg: 'bg-green-500', gradient: 'from-green-400 to-green-600', shadow: 'shadow-green-500/30' },
  yellow: { bg: 'bg-yellow-500', gradient: 'from-yellow-400 to-yellow-600', shadow: 'shadow-yellow-500/30' },
  orange: { bg: 'bg-orange-500', gradient: 'from-orange-400 to-orange-600', shadow: 'shadow-orange-500/30' },
  red: { bg: 'bg-red-500', gradient: 'from-red-400 to-red-600', shadow: 'shadow-red-500/30' },
  purple: { bg: 'bg-purple-500', gradient: 'from-purple-400 to-purple-600', shadow: 'shadow-purple-500/30' },
};


/**
 * ====================================================================
 * HSK 等级卡片组件 (子组件)
 * ====================================================================
 * 负责单个 HSK 等级的展示，并内置了课程列表的展开/折叠逻辑。
 * @param {object} level - 单个等级的数据对象 from hskData
 */
const HskLevelCard = ({ level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = colorMap[level.color] || colorMap.blue;
  const hasMore = level.lessons.length > 5;

  // 决定显示哪些课程
  const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

  return (
    <motion.div 
      layout
      className="relative w-full bg-white dark:bg-gray-800/70 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-gray-200/80 dark:border-gray-700/50 overflow-hidden"
      transition={{ layout: { duration: 0.3, type: 'spring' } }}
    >
      {/* 美化: 背景辉光效果 */}
      <div className={`absolute -top-1/4 -left-1/4 w-1/2 h-1/2 ${colors.bg} opacity-20 dark:opacity-10 rounded-full blur-3xl -z-10`}></div>
      
      {/* 等级标题 */}
      <div className="flex items-start mb-4">
        <motion.div 
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg ${colors.shadow}`}
          whileHover={{ scale: 1.1, rotate: 5 }}
        >
          {level.level}
        </motion.div>
        <div className="ml-4">
          <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
          {/* 新增: 拼音显示 */}
          <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{level.pinyin}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{level.description}</p>
        </div>
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
        
        {/* “更多” 或 “收起” 按钮 */}
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
 * HSK 内容块组件 (主组件)
 * ====================================================================
 * 它是一个可以嵌入任何地方的内容列表容器。
 * 它的作用是渲染所有 HSK 等级卡片。
 */
const HskContentBlock = () => {
  return (
    <div className="space-y-6">
      {hskData.map(level => (
        <HskLevelCard key={level.level} level={level} />
      ))}
    </div>
  );
};

export default HskContentBlock;
