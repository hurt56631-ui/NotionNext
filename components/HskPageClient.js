// components/HskPageClient.js

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, BookText, Mic, PenTool, ListChecks, Brain } from 'lucide-react';

// --- 数据中心 ---
const hskData = [
  {
    level: 1,
    title: '入门水平',
    description: '掌握最常用词语和基本语法',
    image: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-blue-900/50 to-black/70',
    lessons: Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'pinyin', title: '拼音', icon: <Mic />, description: '掌握基础发音规则' },
        { slug: 'words', title: '生词', icon: <BookText />, description: '学习核心词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '理解基本句式结构' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '巩固所学知识点' }
      ]
    }))
  },
  {
    level: 2,
    title: '基础水平',
    description: '就熟悉的日常话题进行交流',
    image: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-purple-900/50 to-black/70',
    lessons: Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'pinyin', title: '拼音', icon: <Mic />, description: '巩固发音技巧' },
        { slug: 'words', title: '生词', icon: <BookText />, description: '扩展常用词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '掌握复合句和时态' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '测试你的学习成果' }
      ]
    }))
  },
  {
    level: 3,
    title: '进阶水平',
    description: '完成生活、学习、工作的基本交际',
    image: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-red-900/50 to-black/70',
    lessons: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'words', title: '生词', icon: <BookText />, description: '学习高频词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '深入理解复杂句式' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '强化综合能力' },
        { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK三级考试' }
      ]
    }))
  },
  {
    level: 4,
    title: '中级水平',
    description: '流畅地与母语者进行交流',
    image: 'https://images.unsplash.com/photo-1561736778-92e52a77699c?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-green-900/50 to-black/70',
    lessons: Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'words', title: '生词', icon: <BookText />, description: '掌握1200个词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '辨析易混淆语法点' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '专项技能训练' },
        { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK四级考试' }
      ]
    }))
  },
  {
    level: 5,
    title: '高级水平',
    description: '阅读报刊杂志，欣赏影视节目',
    image: 'https://images.unsplash.com/photo-1507608441487-a3a88b5b04a9?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-yellow-800/50 to-black/70',
    lessons: Array.from({ length: 36 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'words', title: '生词', icon: <BookText />, description: '掌握2500个词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '运用复杂书面语句式' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '提升阅读与写作能力' },
        { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK五级考试' }
      ]
    }))
  },
  {
    level: 6,
    title: '流利水平',
    description: '轻松理解信息，流利表达观点',
    image: 'https://images.unsplash.com/photo-1542451318-4729f2d55653?auto=format&fit=crop&q=80&w=800',
    gradientOverlay: 'from-pink-900/50 to-black/70',
    lessons: Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      title: `第 ${i + 1} 课`,
      categories: [
        { slug: 'words', title: '生词', icon: <BookText />, description: '掌握5000+词汇' },
        { slug: 'grammar', title: '语法', icon: <PenTool />, description: '掌握并运用各类语法' },
        { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '综合能力拔高' },
        { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK六级考试' }
      ]
    }))
  },
];

// --- 动画效果定义 ---
const screenVariants = {
  enter: (direction) => ({ x: direction > 0 ? '100vw' : '-100vw', opacity: 0.8 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 30 } },
  exit: (direction) => ({ x: direction < 0 ? '100vw' : '-100vw', opacity: 0.8, transition: { type: 'spring', stiffness: 260, damping: 30 } })
};

// --- HSK 页面主组件 ---
const HskMobilePage = () => {
  const [currentView, setCurrentView] = useState('levels'); 
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [direction, setDirection] = useState(1); 

  const handleSelectLevel = (level) => {
    setDirection(1);
    setSelectedLevel(level);
    setCurrentView('lessons');
  };
  
  const handleSelectLesson = (lesson) => {
    setDirection(1);
    setSelectedLesson(lesson);
    setCurrentView('categories');
  };

  const handleSelectCategory = (category) => {
    setDirection(1);
    setSelectedCategory(category);
    setCurrentView('content');
  };

  const goBack = () => {
    setDirection(-1);
    if (currentView === 'content') setCurrentView('categories');
    else if (currentView === 'categories') setCurrentView('lessons');
    else if (currentView === 'lessons') setCurrentView('levels');
  };

  const getTitle = () => {
    if (currentView === 'levels') return 'HSK 学习中心';
    if (currentView === 'lessons') return `HSK ${selectedLevel?.level} - ${selectedLevel?.title}`;
    if (currentView === 'categories') return `HSK ${selectedLevel?.level} - ${selectedLesson?.title}`;
    if (currentView === 'content') return selectedCategory?.title;
    return 'HSK';
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-sans flex flex-col overflow-hidden">
      <header className="flex-shrink-0 h-16 px-4 flex items-center bg-black/50 backdrop-blur-md border-b border-white/10 z-20">
        <div className="w-10">
          <AnimatePresence>
            {currentView !== 'levels' && (
              <motion.button onClick={goBack} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors">
                <ArrowLeft size={24} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <h1 className="flex-grow text-center text-lg font-bold truncate px-2">{getTitle()}</h1>
        <div className="w-10"></div>
      </header>
      <main className="flex-grow relative">
        <AnimatePresence initial={false} custom={direction}>
          {currentView === 'levels' && (
            <motion.div key="levels" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 p-4 space-y-4 overflow-y-auto">
              {hskData.map(level => (
                <motion.div key={level.level} onClick={() => handleSelectLevel(level)} className="relative h-32 p-6 rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-end text-shadow-lg shadow-black/30" style={{ backgroundImage: `url(${level.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <div className={`absolute inset-0 bg-gradient-to-t ${level.gradientOverlay}`}></div>
                  <div className="relative z-10">
                    <h2 className="text-3xl font-black">HSK {level.level}</h2>
                    <p className="text-white/80 text-sm">{level.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {currentView === 'lessons' && selectedLevel && (
            <motion.div key="lessons" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto" style={{ backgroundImage: `url(${selectedLevel.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
                <div className="relative z-10 p-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {selectedLevel.lessons.map(lesson => (
                        <motion.div key={lesson.id} onClick={() => handleSelectLesson(lesson)} className="aspect-square flex items-center justify-center text-center p-1 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors duration-200" whileTap={{ scale: 0.95 }}>
                            <span className="text-base font-semibold">{lesson.title.replace(' ', '\n')}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
          )}

          {currentView === 'categories' && selectedLesson && selectedLevel && (
            <motion.div key="categories" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto" style={{ backgroundImage: `url(${selectedLevel.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
              <div className="relative z-10 p-2 space-y-2">
                {selectedLesson.categories.map(category => (
                  <motion.div key={category.slug} onClick={() => handleSelectCategory(category)} className="flex items-center p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors duration-200" whileTap={{ scale: 0.98 }}>
                    <div className="p-3 bg-white/10 rounded-md">{category.icon}</div>
                    <div className="ml-4 flex-grow"><h3 className="font-semibold text-base">{category.title}</h3><p className="text-sm text-white/60">{category.description}</p></div>
                    <ChevronRight className="text-white/30" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {currentView === 'content' && selectedCategory && selectedLevel && selectedLesson && (
            <motion.div key="content" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 p-6 text-center">
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 rounded-xl border border-dashed border-white/20">
                <div className="text-5xl mb-4 opacity-50">{selectedCategory.icon}</div>
                <h2 className="text-2xl font-bold mb-2">{`HSK ${selectedLevel.level} - ${selectedLesson.title}`}</h2>
                <h3 className="text-xl font-semibold mb-4">{selectedCategory.title}</h3>
                <p className="text-white/60">这里将是具体的学习内容区域。</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default HskMobilePage;
