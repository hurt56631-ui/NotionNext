// /pages/index.js <-- 保持原版结构（只修正 Link）

import React, { useState } from 'react';
import Link from 'next/link'; // 导入 Link
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

// --- HSK 数据 (保持不变) ---
const hskData = [
    { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'bg-blue-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'bg-green-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', color: 'bg-yellow-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', color: 'bg-orange-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', color: 'bg-red-500', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
    { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', color: 'bg-purple-500', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课` })) },
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


// 内部组件：保持原版样式
const HskCard = ({ level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    return (
        <div key={level.level} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700/50">
            
            {/* 等级标题 (保持原版结构) */}
            <div className="flex items-center mb-4">
                <div className={`w-12 h-12 rounded-lg ${level.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg ${level.color.replace('bg-', 'shadow-')}/50`}>
                    {level.level}
                </div>
                <div className="ml-4">
                    <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{level.description}</p>
                </div>
            </div>

            {/* 课程列表 (改为 Link 导航) */}
            <div className="space-y-2">
                {visibleLessons.map(lesson => (
                    // 修正 HSK 课程的路由跳转指向
                    <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{lesson.title}</span>
                            <ChevronRight className="text-gray-400" size={20} />
                        </div>
                    </Link>
                ))}
                
                {/* 更多/收起 按钮 */}
                {hasMore && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-sm py-2 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {isExpanded ? '收起' : `展开所有 ${level.lessons.length - 5} 门课程`}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function HomePage() {
  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto">
      {/* 首页可以加上一个欢迎标题 */}
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">汉语学习中心</h1>
        <p className="text-gray-500 dark:text-gray-400">导航页</p>
      </div>
      
      {/* 拼音导航模块 (放在最上面) */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-cyan-500 pl-3">拼音基础</h2>
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

      {/* HSK 课程区 (保持原样) */}
      <div className="space-y-6 pt-4">
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-l-4 border-purple-500 pl-3">HSK 等级课程</h2>
        {hskData.map(level => (<HskCard level={level} />))}
      </div>
    </div>
  );
};
