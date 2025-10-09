// pages/hsk.js

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NextSeo } from 'next-seo'; // 假设您项目中已配置 next-seo
import { ArrowLeft, ChevronRight, BookText, Mic, PenTool, ListChecks, Brain } from 'lucide-react';

// --- 数据中心 ---
// 所有内容都在这里定义，方便您未来扩展
// 我为您挑选了高质量的 Unsplash 背景图
const hskData = [
  {
    level: 1,
    title: '入门水平',
    description: '掌握最常用词语和基本语法',
    image: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-blue-900/50 to-black/70',
    categories: [
      { slug: 'words', title: '生词列表', icon: <BookText />, description: '学习150个核心词汇' },
      { slug: 'pinyin', title: '拼音专项', icon: <Mic />, description: '掌握基础发音规则' },
      { slug: 'grammar', title: '语法要点', icon: <PenTool />, description: '理解基本句式结构' },
      { slug: 'exercise', title: '综合练习', icon: <ListChecks />, description: '巩固所学知识点' }
    ]
  },
  {
    level: 2,
    title: '基础水平',
    description: '就熟悉的日常话题进行交流',
    image: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-purple-900/50 to-black/70',
    categories: [
      { slug: 'words', title: '生词列表', icon: <BookText />, description: '学习300个常用词汇' },
      { slug: 'grammar', title: '语法要点', icon: <PenTool />, description: '掌握复合句和时态' },
      { slug: 'exercise', title: '综合练习', icon: <ListChecks />, description: '测试你的学习成果' }
    ]
  },
  {
    level: 3,
    title: '进阶水平',
    description: '完成生活、学习、工作的基本交际',
    image: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-red-900/50 to-black/70',
    categories: [
      { slug: 'words', title: '生词列表', icon: <BookText />, description: '学习600个高频词汇' },
      { slug: 'grammar', title: '语法要点', icon: <PenTool />, description: '深入理解复杂句式' },
      { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK三级考试' }
    ]
  },
  // 您可以在此继续添加 HSK 4, 5, 6 的数据...
];

// --- 动画效果定义 ---
const screenVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100vw' : '-100vw',
    opacity: 0.8
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 260, damping: 30 }
  },
  exit: (direction) => ({
    x: direction < 0 ? '100vw' : '-100vw',
    opacity: 0.8,
    transition: { type: 'spring', stiffness: 260, damping: 30 }
  })
};

// --- HSK 页面主组件 ---
const HskMobilePage = () => {
  // 状态管理：当前视图，选中的等级和分类，以及动画方向
  const [currentView, setCurrentView] = useState('levels'); // 'levels', 'categories', 'content'
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  // --- 导航函数 ---
  const handleSelectLevel = (level) => {
    setDirection(1);
    setSelectedLevel(level);
    setCurrentView('categories');
  };

  const handleSelectCategory = (category) => {
    setDirection(1);
    setSelectedCategory(category);
    setCurrentView('content');
  };

  const goBack = () => {
    setDirection(-1);
    if (currentView === 'content') {
      setCurrentView('categories');
    } else if (currentView === 'categories') {
      setCurrentView('levels');
    }
  };

  // --- 动态标题 ---
  const getTitle = () => {
    if (currentView === 'levels') return 'HSK 学习中心';
    if (currentView === 'categories') return `HSK ${selectedLevel?.level} - ${selectedLevel?.title}`;
    if (currentView === 'content') return selectedCategory?.title;
    return 'HSK';
  };

  return (
    <>
      <NextSeo
        title="HSK 移动学习中心"
        description="专为手机设计的沉浸式 HSK 分级学习系统，提供从词汇到语法的全方位练习。"
      />
      {/* 整体容器，h-screen w-screen 确保全屏 */}
      <div className="h-screen w-screen bg-black text-white font-sans flex flex-col overflow-hidden">
        
        {/* 顶部导航栏，使用毛玻璃效果 */}
        <header className="flex-shrink-0 h-16 px-4 flex items-center bg-black/50 backdrop-blur-md border-b border-white/10 z-20">
          <div className="w-10">
            {/* 返回按钮的进出动画 */}
            <AnimatePresence>
              {currentView !== 'levels' && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={goBack}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
                >
                  <ArrowLeft size={24} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <h1 className="flex-grow text-center text-lg font-bold">{getTitle()}</h1>
          <div className="w-10"></div> {/* 占位，使标题居中 */}
        </header>

        {/* 主内容区域，所有动画切换都在这里 */}
        <main className="flex-grow relative">
          <AnimatePresence initial={false} custom={direction}>
            
            {/* 视图一：HSK 等级选择 */}
            {currentView === 'levels' && (
              <motion.div
                key="levels"
                custom={direction}
                variants={screenVariants}
                initial="enter" animate="center" exit="exit"
                className="absolute inset-0 p-4 space-y-4 overflow-y-auto"
              >
                {hskData.map(level => (
                  <motion.div
                    key={level.level}
                    onClick={() => handleSelectLevel(level)}
                    className="relative h-32 p-6 rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-end text-shadow-lg shadow-black/30"
                    style={{ backgroundImage: `url(${level.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-t ${level.gradientOverlay}`}></div>
                    <div className="relative z-10">
                      <h2 className="text-3xl font-black">HSK {level.level}</h2>
                      <p className="text-white/80 text-sm">{level.description}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* 视图二：分类选择 */}
            {currentView === 'categories' && selectedLevel && (
              <motion.div
                key="categories"
                custom={direction}
                variants={screenVariants}
                initial="enter" animate="center" exit="exit"
                className="absolute inset-0 overflow-y-auto"
                style={{ backgroundImage: `url(${selectedLevel.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
                <div className="relative z-10 p-2 space-y-2">
                  {selectedLevel.categories.map(category => (
                    <motion.div
                      key={category.slug}
                      onClick={() => handleSelectCategory(category)}
                      className="flex items-center p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors duration-200"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="p-3 bg-white/10 rounded-md">
                        {category.icon}
                      </div>
                      <div className="ml-4 flex-grow">
                        <h3 className="font-semibold text-base">{category.title}</h3>
                        <p className="text-sm text-white/60">{category.description}</p>
                      </div>
                      <ChevronRight className="text-white/30" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 视图三：具体内容 (这是您需要填充真实内容的占位符) */}
            {currentView === 'content' && selectedCategory && selectedLevel && (
              <motion.div
                key="content"
                custom={direction}
                variants={screenVariants}
                initial="enter" animate="center" exit="exit"
                className="absolute inset-0 p-6 text-center"
              >
                <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 rounded-xl border border-dashed border-white/20">
                  <div className="text-5xl mb-4 opacity-50">
                    {selectedCategory.icon}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{`HSK ${selectedLevel.level} - ${selectedCategory.title}`}</h2>
                  <p className="text-white/60">
                    这里将是具体的学习内容区域。
                    <br/>
                    例如，可滚动的单词卡片列表或语法讲解。
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default HskMobilePage;
