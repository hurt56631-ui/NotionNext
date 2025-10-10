// /components/HskPageClient.js <-- 最终交互增强版

"use client"; // 声明为客户端组件，因为需要使用 useState, Link 和 window API

import { useState } from 'react';
import Link from 'next/link'; // --- 新增: 导入Next.js的链接组件 ---
import { BookOpen, ChevronDown, ChevronUp, Mic2, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

// --- 数据中心 (保持不变) ---
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
const hskData = [
    { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'blue', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'green', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', color: 'yellow', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', color: 'orange', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', color: 'red', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', color: 'purple', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
];
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
 * 拼音学习卡片组件 (已增加语音朗读功能)
 * ====================================================================
 */
const PinyinCard = ({ title, description, items, isTones = false }) => {

  // --- 新增: 语音朗读函数 ---
  const speakPinyin = (text) => {
    // 检查浏览器是否支持语音合成
    if (!('speechSynthesis' in window)) {
      alert("抱歉，您的浏览器不支持语音朗读功能。");
      return;
    }

    // 创建一个语音合成的实例
    const utterance = new SpeechSynthesisUtterance();
    
    // 对于带声调的字母，我们只朗读其基本形式（例如 'ā' -> 'a'）
    // 对于普通字母，直接朗读
    utterance.text = isTones ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : text;
    
    utterance.lang = 'zh-CN'; // 关键！设置为中文，确保发音标准
    utterance.rate = 0.8;     // 语速稍慢，方便学习
    utterance.pitch = 1;      // 音调正常

    // 朗读前取消上一次的朗读，避免重叠
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative w-full bg-white/60 dark:bg-gray-800/50 backdrop-blur-lg p-5 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/40">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg">
          <Volume2 className="text-gray-600 dark:text-gray-300" size={20} />
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
            whileTap={{ scale: 0.95 }}
            className="bg-gray-100 dark:bg-gray-900/60 rounded-md text-gray-700 dark:text-gray-300 font-mono text-center cursor-pointer"
            style={isTones ? { flexBasis: 'calc(20% - 8px)', padding: '12px 4px' } : { padding: '8px 12px' }}
            // --- 新增: 点击事件，调用朗读函数 ---
            onClick={() => speakPinyin(isTones ? item.symbol : item)}
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
};


/**
 * ====================================================================
 * HSK 等级卡片组件 (已增加课程链接)
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
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colors.bg} rounded-l-2xl`}></div>
      <div className="mb-4">
        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{level.description}</p>
      </div>
      <motion.div layout className="flex flex-wrap gap-2">
        {visibleLessons.map(lesson => (
          // --- 核心修改: 将按钮用 Link 组件包裹，使其成为导航链接 ---
          <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
            <motion.a
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="block px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600/80 transition-colors"
            >
              {lesson.title}
            </motion.a>
          </Link>
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
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-cyan-500 pl-3">拼音基础 (点击可朗读)</h2>
        <PinyinCard title={pinyinData.initials.title} description={pinyinData.initials.description} items={pinyinData.initials.items} />
        <PinyinCard title={pinyinData.finals.title} description={pinyinData.finals.description} items={pinyinData.finals.items} />
        <PinyinCard title={pinyinData.tones.title} description={pinyinData.tones.description} items={pinyinData.tones.items} isTones={true} />
      </div>
      <div className="space-y-6 pt-8">
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-purple-500 pl-3">HSK 等级课程 (点击进入)</h2>
        {hskData.map(level => (
          <HskLevelCard key={level.level} level={level} />
        ))}
      </div>
    </div>
  );
};

export default HskContentBlock;
