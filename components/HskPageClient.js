// /pages/index.js <-- 保持原版结构（只修正 Link）

import React, { useState } from 'react';
import Link from 'next/link'; // 导入 Link
import { ChevronRight, ChevronDown, ChevronUp, Mic2, Music4, BookText } from 'lucide-react';
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
// colorMap 未在提供的代码中使用，但为了完整性保留
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


// 内部组件：HskCard - 优化界面
const HskCard = ({ level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    // 为 HSK 卡片添加进入动画
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    };

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            // 优化卡片样式：增加阴影、圆角，添加过渡和悬停效果
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border-2 border-transparent dark:border-gray-700/50 transition-all duration-300 hover:shadow-xl hover:scale-[1.005] relative overflow-hidden group"
        >
            {/* 左侧的彩色等级条纹，增强视觉区分度 */}
            <div className={`absolute top-0 left-0 bottom-0 w-2 ${level.color} rounded-l-lg transition-all duration-300 group-hover:w-3`}></div>

            {/* 等级标题和描述 */}
            <div className="flex items-center mb-6 pl-2"> {/* 增加左边距，以避开彩色条纹 */}
                <div className={`w-14 h-14 rounded-full ${level.color} flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-lg ${level.color.replace('bg-', 'shadow-')}/50`}>
                    {level.level}
                </div>
                <div className="ml-5">
                    <h2 className="font-extrabold text-xl text-gray-900 dark:text-gray-100">HSK {level.level} - {level.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{level.description}</p>
                </div>
            </div>

            {/* 课程列表 */}
            <div className="space-y-2 border-t pt-4 border-gray-100 dark:border-gray-700/70 pl-2"> {/* 增加左边距和上边框 */}
                {visibleLessons.map(lesson => (
                    // 修正 HSK 课程的路由跳转指向，并优化列表项样式
                    <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                        <a className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer group">
                            <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{lesson.title}</span>
                            <ChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors" size={20} />
                        </a>
                    </Link>
                ))}
                
                {/* 更多/收起 按钮 */}
                {hasMore && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-sm py-2 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1 mt-2">
                        {isExpanded ? '收起课程' : `展开所有 ${level.lessons.length - 5} 门课程`}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export default function HomePage() {
  return (
    <div className="space-y-8 p-4 max-w-3xl mx-auto md:py-8"> {/* 增加整体间距，调整最大宽度，增加垂直边距 */}
      {/* 首页欢迎标题 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center py-6 bg-gradient-to-r from-emerald-400 to-cyan-500 text-white rounded-xl shadow-lg"
      >
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2">汉语学习中心</h1>
        <p className="text-xl opacity-90">开启你的中文学习之旅</p> {/* 更新欢迎语尺寸 */}
      </motion.div>
      
      {/* 拼音导航模块 - 优化为一排3个按钮样式 */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-cyan-500 pl-4 py-1">拼音基础</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* 响应式网格：小屏幕1列，中等屏幕2列，大屏幕3列 */}
            {pinyinModules.map((module) => (
                <Link key={module.title} href={module.href} passHref>
                    <motion.a
                        whileHover={{ y: -7, boxShadow: '0 15px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)' }}
                        // 优化按钮样式：居中内容，增加图标和文本大小，添加更多边框和背景视觉效果
                        className={`block p-6 rounded-xl shadow-md border-2 ${module.color.replace('text-', 'border-')} transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center group bg-white dark:bg-gray-800/80 hover:bg-opacity-90 dark:hover:bg-opacity-95`}
                    >
                        <module.icon className={`${module.color} w-10 h-10 mb-3 group-hover:scale-110 transition-transform`} />
                        <h3 className="font-extrabold text-xl text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">{module.title}</h3>
                        <p className="text-base text-gray-500 dark:text-gray-400">{module.description}</p> {/* 调整描述文本大小 */}
                    </motion.a>
                </Link>
            ))}
        </div>
    </div>

      {/* HSK 课程区 */}
      <div className="space-y-6 pt-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-purple-500 pl-4 py-1">HSK 等级课程</h2>
        {hskData.map(level => (<HskCard key={level.level} level={level} />))}
      </div>
    </div>
  );
};
