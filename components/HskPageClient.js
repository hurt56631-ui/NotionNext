// components/HskPageClient.js  <-- 全新亮色列表式设计

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, BookText, Mic, PenTool, ListChecks, Brain } from 'lucide-react';

// --- 数据中心 (保持不变) ---
const hskData = [
  { level: 1, title: '入门水平', description: '掌握最常用词语和基本语法', color: 'bg-blue-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'pinyin', title: '拼音', icon: <Mic />, description: '掌握基础发音规则' }, { slug: 'words', title: '生词', icon: <BookText />, description: '学习核心词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '理解基本句式结构' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '巩固所学知识点' } ] })) },
  { level: 2, title: '基础水平', description: '就熟悉的日常话题进行交流', color: 'bg-green-500', lessons: Array.from({ length: 15 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'pinyin', title: '拼音', icon: <Mic />, description: '巩固发音技巧' }, { slug: 'words', title: '生词', icon: <BookText />, description: '扩展常用词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '掌握复合句和时态' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '测试你的学习成果' } ] })) },
  { level: 3, title: '进阶水平', description: '完成生活、学习、工作的基本交际', color: 'bg-yellow-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'words', title: '生词', icon: <BookText />, description: '学习高频词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '深入理解复杂句式' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '强化综合能力' }, { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK三级考试' } ] })) },
  { level: 4, title: '中级水平', description: '流畅地与母语者进行交流', color: 'bg-orange-500', lessons: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'words', title: '生词', icon: <BookText />, description: '掌握1200个词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '辨析易混淆语法点' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '专项技能训练' }, { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK四级考试' } ] })) },
  { level: 5, title: '高级水平', description: '阅读报刊杂志，欣赏影视节目', color: 'bg-red-500', lessons: Array.from({ length: 36 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'words', title: '生词', icon: <BookText />, description: '掌握2500个词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '运用复杂书面语句式' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '提升阅读与写作能力' }, { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK五级考试' } ] })) },
  { level: 6, title: '流利水平', description: '轻松理解信息，流利表达观点', color: 'bg-purple-500', lessons: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `第 ${i + 1} 课`, categories: [ { slug: 'words', title: '生词', icon: <BookText />, description: '掌握5000+词汇' }, { slug: 'grammar', title: '语法', icon: <PenTool />, description: '掌握并运用各类语法' }, { slug: 'exercise', title: '练习', icon: <ListChecks />, description: '综合能力拔高' }, { slug: 'mock-test', title: '模拟考试', icon: <Brain />, description: '全真模拟HSK六级考试' } ] })) },
];

// --- 动画效果定义 (保持不变) ---
const screenVariants = {
  enter: (direction) => ({ x: direction > 0 ? '100vw' : '-100vw', opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: (direction) => ({ x: direction < 0 ? '100vw' : '-100vw', opacity: 0, transition: { duration: 0.2 } })
};

// --- HSK 页面主组件 (全新亮色设计) ---
const HskMobilePage = () => {
  const [currentView, setCurrentView] = useState('levels'); 
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [direction, setDirection] = useState(1); 

  const handleSelectLevel = (level) => { setDirection(1); setSelectedLevel(level); setCurrentView('lessons'); };
  const handleSelectLesson = (lesson) => { setDirection(1); setSelectedLesson(lesson); setCurrentView('categories'); };
  const handleSelectCategory = (category) => { setDirection(1); setSelectedCategory(category); setCurrentView('content'); };

  const goBack = () => {
    setDirection(-1);
    if (currentView === 'content') setCurrentView('categories');
    else if (currentView === 'categories') setCurrentView('lessons');
    else if (currentView === 'lessons') setCurrentView('levels');
  };

  const getTitle = () => {
    if (currentView === 'levels') return 'HSK 学习中心';
    if (currentView === 'lessons') return `HSK ${selectedLevel?.level}`;
    if (currentView === 'categories') return selectedLesson?.title;
    if (currentView === 'content') return selectedCategory?.title;
    return 'HSK';
  };

  return (
    <div className="h-full w-full bg-gray-50 text-gray-800 font-sans flex flex-col overflow-hidden">
      <header className="flex-shrink-0 h-14 px-4 flex items-center bg-white/80 backdrop-blur-lg border-b border-gray-200 z-20 sticky top-0">
        <div className="w-10">
          <AnimatePresence>
            {currentView !== 'levels' && (
              <motion.button onClick={goBack} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="p-2 -ml-2 rounded-full text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors">
                <ArrowLeft size={22} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <h1 className="flex-grow text-center text-lg font-semibold truncate px-2">{getTitle()}</h1>
        <div className="w-10"></div>
      </header>
      
      <main className="flex-grow relative overflow-y-auto">
        <AnimatePresence initial={false} custom={direction}>
          
          {/* 视图一：HSK 等级列表 */}
          {currentView === 'levels' && (
            <motion.div key="levels" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {hskData.map(level => (
                  <motion.div key={level.level} onClick={() => handleSelectLevel(level)} className="flex items-center p-4 cursor-pointer hover:bg-gray-100 transition-colors" whileTap={{ backgroundColor: '#e5e7eb' }}>
                    <div className={`w-12 h-12 rounded-lg ${level.color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                      {level.level}
                    </div>
                    <div className="ml-4 flex-grow">
                      <h2 className="font-bold text-base">HSK {level.level} - {level.title}</h2>
                      <p className="text-sm text-gray-500">{level.description}</p>
                    </div>
                    <ChevronRight className="text-gray-400" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 视图二：课程列表 (格子布局) */}
          {currentView === 'lessons' && selectedLevel && (
            <motion.div key="lessons" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto">
                <div className="p-4">
                  <h2 className="text-2xl font-bold mb-4">{`HSK ${selectedLevel.level} - ${selectedLevel.title}`}</h2>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                      {selectedLevel.lessons.map(lesson => (
                          <motion.div key={lesson.id} onClick={() => handleSelectLesson(lesson)} className="aspect-square flex items-center justify-center text-center p-1 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 hover:border-blue-400 transition-all duration-200" whileTap={{ scale: 0.95 }}>
                              <span className="text-base font-semibold text-gray-700">{lesson.title.replace(' ', '\n')}</span>
                          </motion.div>
                      ))}
                  </div>
                </div>
            </motion.div>
          )}

          {/* 视图三：分类列表 */}
          {currentView === 'categories' && selectedLesson && (
            <motion.div key="categories" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {selectedLesson.categories.map(category => (
                  <motion.div key={category.slug} onClick={() => handleSelectCategory(category)} className="flex items-center p-4 cursor-pointer hover:bg-gray-100 transition-colors" whileTap={{ backgroundColor: '#e5e7eb' }}>
                    <div className="p-3 bg-gray-100 text-blue-500 rounded-lg">{category.icon}</div>
                    <div className="ml-4 flex-grow">
                        <h3 className="font-semibold text-base">{category.title}</h3>
                        <p className="text-sm text-gray-500">{category.description}</p>
                    </div>
                    <ChevronRight className="text-gray-400" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* 视图四：具体内容 (占位) */}
          {currentView === 'content' && selectedCategory && selectedLevel && selectedLesson && (
            <motion.div key="content" custom={direction} variants={screenVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 p-6 text-center">
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-dashed border-gray-300">
                <div className="text-5xl mb-4 text-gray-400">{selectedCategory.icon}</div>
                <h2 className="text-xl font-bold mb-2">{`${selectedLesson.title} - ${selectedCategory.title}`}</h2>
                <p className="text-gray-500">这里将是具体的学习内容区域。</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default HskMobilePage;
