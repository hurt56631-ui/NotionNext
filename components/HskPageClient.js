import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Mic2, Music4, BookText } from 'lucide-react';
import { motion } from 'framer-motion';

// --- [核心修改] HSK 数据更新：增加了课程名和图片背景 ---
const hskData = [
    { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 你好' },
        { id: 2, title: '第 2 课 谢谢你' },
        { id: 3, title: '第 3 课 你叫什么名字？' },
        { id: 4, title: '第 4 课 她是我的汉语老师' },
        { id: 5, title: '第 5 课 她女儿今年二十岁' },
        // ...更多课程
    ]},
    { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 九月去北京旅游最好' },
        { id: 2, title: '第 2 课 我每天六点起床' },
        { id: 3, title: '第 3 课 左边那个红色的是我的' },
        { id: 4, title: '第 4 课 这个工作是他帮我介绍的' },
        { id: 5, title: '第 5 课 喂，您好' },
    ]},
    { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 周末你有什么打算' },
        { id: 2, title: '第 2 课 他什么时候回来' },
        { id: 3, title: '第 3 课 桌子上放着很多饮料' },
    ]},
    { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 简单的爱情' },
        { id: 2, title: '第 2 课 真正的朋友' },
        { id: 3, title: '第 3 课 经理对我印象不错' },
    ]},
    { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 爱的细节' },
        { id: 2, title: '第 2 课 父母的“唠叨”' },
    ]},
    { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', imageUrl: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=800&q=80', lessons: [
        { id: 1, title: '第 1 课 创新的“智慧”' },
        { id: 2, title: '第 2 课 走进“杂交水稻之父”袁隆平' },
    ]},
];

// --- [核心修改] 拼音模块数据：移除了英文描述 ---
const pinyinModules = [
  { title: '声母表', href: '/pinyin/initials', icon: Mic2, color: 'text-blue-500', borderColor: 'border-blue-500' },
  { title: '韵母表', href: '/pinyin/finals', icon: Music4, color: 'text-green-500', borderColor: 'border-green-500' },
  { title: '声调表', href: '/pinyin/tones', icon: BookText, color: 'text-yellow-500', borderColor: 'border-yellow-500' },
];

// --- [核心修改] HSK卡片组件：改造为图片背景模式，移除圆形和箭头 ---
const HskCard = ({ level }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasMore = level.lessons.length > 5;
    const visibleLessons = isExpanded ? level.lessons : level.lessons.slice(0, 5);

    const cardVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    };

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            whileInView="visible" // 当卡片进入视口时才执行动画
            viewport={{ once: true, amount: 0.3 }}
            className="relative rounded-xl shadow-lg overflow-hidden group transition-all duration-300 hover:shadow-2xl"
        >
            {/* 背景图片 */}
            <img src={level.imageUrl} alt={level.title} className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-110" />
            {/* 渐变遮罩层，确保文字清晰 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10"></div>
            
            {/* 内容容器 */}
            <div className="relative z-20 p-6 flex flex-col h-full text-white">
                {/* 等级标题和描述 */}
                <div>
                    <h2 className="font-extrabold text-2xl">HSK {level.level} - {level.title}</h2>
                    <p className="text-sm opacity-80 mt-1">{level.description}</p>
                </div>
                
                {/* 课程列表 */}
                <div className="space-y-1.5 mt-4 flex-grow">
                    {visibleLessons.map(lesson => (
                        <Link key={lesson.id} href={`/hsk/${level.level}/lessons/${lesson.id}`} passHref>
                            <a className="block p-2 rounded-md hover:bg-white/20 transition-colors cursor-pointer">
                                <span className="font-medium">{lesson.title}</span>
                            </a>
                        </Link>
                    ))}
                </div>
                
                {/* 更多/收起 按钮 */}
                {hasMore && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-sm py-2 hover:bg-white/20 rounded-md transition-colors flex items-center justify-center gap-1 mt-2 font-semibold">
                        {isExpanded ? '收起列表' : `展开更多课程`}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export default function HomePage() {
  return (
    // --- [核心修改] 增加了整页背景图 ---
    <div 
        className="relative min-h-screen bg-gray-100 dark:bg-gray-900"
        style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1534777367048-a53b2d1ac68e?fit=crop&w=1600&q=80)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
        }}
    >
        {/* 内容容器，带毛玻璃效果 */}
        <div className="space-y-10 p-4 max-w-4xl mx-auto md:py-10 bg-white/80 dark:bg-black/70 backdrop-blur-md rounded-lg my-8 shadow-2xl">
            {/* 首页欢迎标题 */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center"
            >
                <h1 className="text-4xl sm:text-5xl font-extrabold mb-2 text-gray-800 dark:text-white">汉语学习中心</h1>
                <p className="text-xl text-gray-600 dark:text-gray-300">开启你的中文学习之旅</p>
            </motion.div>
      
            {/* --- [核心修改] 拼音模块重构为一排3个按钮 --- */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-cyan-500 pl-4 py-1">拼音基础</h2>
                <div className="grid grid-cols-3 gap-4">
                    {pinyinModules.map((module) => (
                        <Link key={module.title} href={module.href} passHref>
                            <motion.a
                                whileHover={{ y: -5 }}
                                whileTap={{ scale: 0.95 }}
                                className={`block p-4 rounded-xl shadow-md border ${module.borderColor} transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center group bg-white dark:bg-gray-800 hover:shadow-lg`}
                            >
                                <module.icon className={`${module.color} w-8 h-8 mb-2 transition-transform group-hover:scale-110`} />
                                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{module.title}</h3>
                            </motion.a>
                        </Link>
                    ))}
                </div>
            </div>

            {/* HSK 课程区 */}
            <div className="space-y-8 pt-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-l-4 border-purple-500 pl-4 py-1">HSK 等级课程</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {hskData.map(level => (<HskCard key={level.level} level={level} />))}
                </div>
            </div>
        </div>
    </div>
  );
};
