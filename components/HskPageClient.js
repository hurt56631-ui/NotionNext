// /components/HskPageClient.js <-- 已重构为导航入口

"use client";

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Mic2, BookText, Music4 } from 'lucide-react';
import { motion } from 'framer-motion';

// --- HSK 数据 (保持不变) ---
const hskData = [
    { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'blue', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'green', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    // ... 其他HSK等级 ...
];
const colorMap = {
    blue: { bg: 'bg-blue-500' },
    green: { bg: 'bg-green-500' },
    yellow: { bg: 'bg-yellow-500' },
    orange: { bg: 'bg-orange-500' },
    red: { bg: 'bg-red-500' },
    purple: { bg: 'bg-purple-500' },
};

// --- 新增: 拼音学习模块数据 ---
const pinyinModules = [
  { title: '声母表', description: 'Initials', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500' },
  { title: '韵母表', description: 'Finals', href: '/pinyin/finals', icon: Music4, color: 'text-green-500' },
  { title: '声调表', description: 'Tones', href: '/pinyin/tones', icon: BookText, color: 'text-yellow-500' },
];

/**
 * ====================================================================
 * HSK 等级卡片组件 (保持不变)
 * ====================================================================
 */
const HskLevelCard = ({ level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const colors = colorMap[level.color] || colorMap.blue;
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    return (
        <motion.div layout transition={{ layout: { duration: 0.3, type: 'spring' } }} className={`relative w-full bg-white dark:bg-gray-800/70 backdrop-blur-sm p-5 pl-7 rounded-2xl shadow-lg border border-gray-200/80 dark:border-gray-700/50 overflow-hidden`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colors.bg} rounded-l-2xl`}></div>
            <div className="mb-4">
                <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{level.description}</p>
            </div>
            <motion.div layout className="flex flex-wrap gap-2">
                {visibleLessons.map(lesson => (
                    <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                        <motion.a whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} className="block px-3 py-1.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600/80 transition-colors">
                            {lesson.title}
                        </motion.a>
                    </Link>
                ))}
                {hasMore && (<motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setIsExpanded(!isExpanded)} className={`px-3 py-1.5 flex items-center gap-1 rounded-md text-sm font-semibold transition-colors ${isExpanded ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'}`}>{isExpanded ? '收起' : '更多'}{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</motion.button>)}
            </motion.div>
        </motion.div>
    );
};

/**
 * ====================================================================
 * 汉语学习中心 (主组件, 已重构)
 * ====================================================================
 */
const HskContentBlock = () => {
    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 px-4 py-8">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-extrabold text-gray-800 dark:text-white">汉语学习中心</h1>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-2">Chinese Learning Center</p>
            </div>

            {/* --- 拼音基础 (导航按钮) --- */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-cyan-500 pl-3">拼音基础</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pinyinModules.map((module) => (
                        <Link key={module.title} href={module.href} passHref>
                            <motion.a whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }} className="block bg-white dark:bg-gray-800/80 p-6 rounded-xl shadow-md border dark:border-gray-700/60 transition-shadow">
                                <div className="flex items-center gap-4">
                                    <module.icon className={`${module.color} w-8 h-8`} />
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{module.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{module.description}</p>
                                    </div>
                                </div>
                            </motion.a>
                        </Link>
                    ))}
                </div>
            </div>

            {/* --- HSK 课程区 --- */}
            <div className="space-y-6 pt-8">
                <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-purple-500 pl-3">HSK 等级课程</h2>
                {hskData.map(level => (<HskLevelCard key={level.level} level={level} />))}
            </div>
        </div>
    );
};

export default HskContentBlock;
