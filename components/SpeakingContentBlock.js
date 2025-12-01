// components/SpeakingContentBlock.js
'use client'; // 1. 必须添加：标记为客户端组件，否则部署必挂

import { useState, useEffect } from 'react';
// 2. 路由修复：适配 Next.js 13+ App Router
import { useRouter, usePathname } from 'next/navigation'; 
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据
import speakingList from '@/data/speaking.json';

// --- 核心组件：动态导入，禁用 SSR ---
const InteractiveLesson = dynamic(() => import('@/components/Tixing/InteractiveLesson'), { ssr: false });

const SpeakingContentBlock = () => {
  const router = useRouter();
  const pathname = usePathname(); // 获取当前路径
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // ==================== 1. 数据加载逻辑 ====================
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    
    const fetchSafe = async (url) => {
        try { 
            const res = await fetch(url); 
            return res.ok ? await res.json() : []; 
        } catch (e) { 
            console.warn(`Failed to fetch ${url}`, e);
            return []; 
        }
    };

    try {
      const [vocabData, grammarData, sentencesData, exercisesData] = await Promise.all([
          fetchSafe(`/data/lessons/${lessonId}/vocabulary.json`),
          fetchSafe(`/data/lessons/${lessonId}/grammar.json`),
          fetchSafe(`/data/lessons/${lessonId}/sentences.json`),
          fetchSafe(`/data/lessons/${lessonId}/exercises.json`)
      ]);

      setSelectedCourse({ 
          ...courseSummary, 
          vocabulary: vocabData, 
          grammar: grammarData, 
          sentences: sentencesData, 
          exercises: exercisesData 
      });
      
      // 3. 路由修复：使用 window.location.hash 或 pathname 进行跳转
      // App Router 中 push 不需要 shallow: true 来处理 hash
      router.push(`${pathname}#course-menu`);
    } catch (error) {
      console.error(error);
      alert("加载课程数据失败，请检查网络");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 2. 状态与路由 Hash 同步 ====================
  const handleModuleClick = (type) => {
    setActiveModule(type);
    router.push(`${pathname}#course-${type}`);
  };

  useEffect(() => {
    const handleHashChange = () => {
      // 确保在客户端执行
      if (typeof window === 'undefined') return;

      const hash = window.location.hash;
      if (hash.includes('#course-vocab')) setActiveModule('vocab');
      else if (hash.includes('#course-grammar')) setActiveModule('grammar');
      else if (hash.includes('#course-sentences')) setActiveModule('sentences');
      else if (hash.includes('#course-exercises')) setActiveModule('exercises');
      else if (hash.includes('#course-menu')) {
          setActiveModule(null); 
      } else { 
          setSelectedCourse(null); 
          setActiveModule(null); 
      }
    };

    window.addEventListener('popstate', handleHashChange);
    // 初始化检查
    handleHashChange();
    
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  const handleBack = () => router.back();

  // ==================== 3. 数据转换适配器 ====================
  const transformToWordStudyLesson = (data, title, isSentence = false) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "word_study",
          content: {
            title: title,
            words: data.map((item, index) => ({
              id: item.id || `word-${index}`,
              chinese: isSentence ? item.sentence : item.word,
              pinyin: item.pinyin,
              translation: item.translation,
              example: item.example,
              rate: isSentence ? 0.85 : 0
            }))
          }
        },
        { type: "complete", content: { title: "学习完成！" } }
      ]
    };
  };

  const transformGrammarToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "grammar_study",
          content: {
            grammarPoints: data.map(g => {
              let finalExplanation = g.visibleExplanation || `<div class="font-bold text-blue-600 mb-2 text-lg">${g.translation || ''}</div><div class="leading-relaxed">${g.explanation || ''}</div>`;
              if (g.usage) finalExplanation += `<div class="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-800">📌 ${g.usage}</div>`;
              
              return {
                id: g.id,
                grammarPoint: g.sentence || g.pattern,
                pattern: g.pattern || g.sentence,
                visibleExplanation: finalExplanation,
                narrationScript: g.explanation,
                examples: g.examples || []
              };
            })
          }
        },
        { type: "complete", content: { title: "语法通关！" } }
      ]
    };
  };

  const transformExercisesToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    return { blocks: Array.isArray(data) ? data : (data.blocks || []) };
  };

  // ==================== 4. 渲染逻辑 ====================
  let currentLessonData = null;
  if (activeModule === 'vocab') currentLessonData = transformToWordStudyLesson(selectedCourse?.vocabulary, "核心生词");
  else if (activeModule === 'sentences') currentLessonData = transformToWordStudyLesson(selectedCourse?.sentences, "常用短句", true);
  else if (activeModule === 'grammar') currentLessonData = transformGrammarToLesson(selectedCourse?.grammar);
  else if (activeModule === 'exercises') currentLessonData = transformExercisesToLesson(selectedCourse?.exercises);

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium text-gray-700">正在加载课程...</span>
            </div>
        </div>
      )}

      {/* 课程列表 */}
      <div className="space-y-4 pb-20 px-1">
        <div className="text-center mb-6 mt-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">口语速成</h2>
            <p className="text-sm text-gray-500">共 {speakingList.length} 课精选内容</p>
        </div>
        {speakingList.map(course => (
          <div key={course.id} onClick={() => handleCourseClick(course)} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-md hover:border-teal-500 transition-all flex items-center justify-between active:scale-[0.98]">
             <div className="flex items-center">
                 <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4 shrink-0">
                     {course.id}
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3>
                     <p className="text-xs text-gray-500 line-clamp-1">{course.description}</p>
                 </div>
             </div>
             <ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* 课程菜单 */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col"
          >
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center shrink-0">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 active:bg-gray-100 rounded-full">
                    <ChevronRight className="rotate-180" size={24}/>
                </button>
                <h2 className="flex-1 text-center font-bold text-lg pr-8 truncate text-gray-800 dark:text-gray-100">
                    {selectedCourse.title}
                </h2>
            </div>
            
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <MenuCard title="生词学习" subtitle={`${selectedCourse.vocabulary?.length || 0} 个生词`} icon={<Book size={24}/>} color="bg-blue-500" onClick={() => handleModuleClick('vocab')} />
                <MenuCard title="常用短句" subtitle={`${selectedCourse.sentences?.length || 0} 个实用句子`} icon={<Sparkles size={24}/>} color="bg-pink-500" onClick={() => handleModuleClick('sentences')} />
                <MenuCard title="语法解析" subtitle={`${selectedCourse.grammar?.length || 0} 个句型`} icon={<MessageCircle size={24}/>} color="bg-purple-500" onClick={() => handleModuleClick('grammar')} />
                <MenuCard title="课后练习" subtitle={`${selectedCourse.exercises?.length || 0} 道关卡`} icon={<PenTool size={24}/>} color="bg-orange-500" onClick={() => handleModuleClick('exercises')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 核心修复：直接渲染全屏组件 */}
      {activeModule && currentLessonData && (
         <InteractiveLesson lesson={currentLessonData} />
      )}
    </>
  );
};

const MenuCard = ({ title, subtitle, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 active:scale-[0.97] transition-all cursor-pointer hover:shadow-md">
        <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-md shrink-0`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <ChevronRight className="ml-auto text-gray-300" />
    </div>
);

export default SpeakingContentBlock;
