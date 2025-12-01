import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom'; // 👈 核心：引入传送门
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据 (假设路径正确)
import speakingList from '@/data/speaking.json';

// 动态导入互动组件
const InteractiveLesson = dynamic(() => import('./Tixing/InteractiveLesson'), { ssr: false });

// --- 核心：传送门组件 ---
// 它的作用是把 children (课程组件) 直接“传送”到 document.body 下，
// 从而脱离 NotionNext 的所有布局限制，实现真全屏。
const FullScreenPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 锁定背景滚动
    document.body.style.overflow = 'hidden';
    return () => {
      // 恢复背景滚动
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-white">
      {children}
    </div>,
    document.body
  );
};

// ---------------- 主组件 ----------------

const SpeakingContentBlock = () => {
  const router = useRouter();
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // 1. 数据加载逻辑
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    
    const fetchSafe = async (url) => {
        try { 
            const res = await fetch(url); 
            return res.ok ? await res.json() : []; 
        } catch (e) { return []; }
    };

    try {
      // 假设数据在 public/data/lessons/...
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
      
      // 打开菜单
      router.push(router.asPath.split('#')[0] + '#course-menu', undefined, { shallow: true });
    } catch (error) {
      console.error(error);
      alert("加载课程失败，请检查数据文件路径");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 状态与路由同步
  const handleModuleClick = (type) => {
    setActiveModule(type);
    router.push(router.asPath.split('#')[0] + `#course-${type}`, undefined, { shallow: true });
  };

  const handleBack = () => router.back();

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('#course-vocab')) setActiveModule('vocab');
      else if (hash.includes('#course-grammar')) setActiveModule('grammar');
      else if (hash.includes('#course-sentences')) setActiveModule('sentences');
      else if (hash.includes('#course-exercises')) setActiveModule('exercises');
      else if (hash.includes('#course-menu')) {
          setActiveModule(null); // 回到菜单
      }
      else { 
          // 完全退出
          setSelectedCourse(null); 
          setActiveModule(null); 
      }
    };

    window.addEventListener('popstate', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  // 3. 数据转换逻辑 (保持不变)
  const transformToWordStudyLesson = (data, title, isSentence = false) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "word_study",
          content: {
            title: title,
            words: data.map(item => ({
              id: item.id,
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
              let finalExplanation = g.visibleExplanation || `<div class="font-bold text-blue-600 mb-2">${g.translation || ''}</div><div>${g.explanation || ''}</div>`;
              if (g.usage) finalExplanation += g.usage;
              return {
                id: g.id,
                grammarPoint: g.sentence || g.pattern,
                pattern: g.pattern || g.sentence,
                visibleExplanation: finalExplanation,
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

  let currentLessonData = null;
  if (activeModule === 'vocab') currentLessonData = transformToWordStudyLesson(selectedCourse?.vocabulary, "核心生词");
  else if (activeModule === 'sentences') currentLessonData = transformToWordStudyLesson(selectedCourse?.sentences, "常用短句", true);
  else if (activeModule === 'grammar') currentLessonData = transformGrammarToLesson(selectedCourse?.grammar);
  else if (activeModule === 'exercises') currentLessonData = transformExercisesToLesson(selectedCourse?.exercises);

  // ---------------- 渲染部分 ----------------

  return (
    <>
      {/* Loading 遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[50] bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium">资源加载中...</span>
            </div>
        </div>
      )}

      {/* 1. 课程列表 (正常页面显示) */}
      <div className="space-y-4 pb-20">
        <div className="text-center mb-6 pt-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">口语速成</h2>
            <p className="text-sm text-gray-500">共 {speakingList.length} 课精选内容</p>
        </div>
        {speakingList.map(course => (
          <div key={course.id} onClick={() => handleCourseClick(course)} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 transition-all flex items-center justify-between active:scale-[0.98]">
             <div className="flex items-center">
                 <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4">{course.id}</div>
                 <div>
                     <h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3>
                     <p className="text-xs text-gray-500">{course.description}</p>
                 </div>
             </div>
             <ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* 2. 课程二级菜单 (底部弹窗或全屏覆盖) */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            // 这里使用 fixed inset-0 z-40 覆盖当前页面
            className="fixed inset-0 z-[40] bg-gray-50 dark:bg-gray-900 flex flex-col"
          >
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center z-10">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 active:bg-gray-100 rounded-full">
                    <ChevronRight className="rotate-180" size={24}/>
                </button>
                <h2 className="flex-1 text-center font-bold text-lg pr-8 truncate">{selectedCourse.title}</h2>
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

      {/* 3. 互动课程全屏入口 (关键修改！) */}
      {/* 使用 FullScreenPortal 强制将组件挂载到 body 下，彻底解决层级问题 */}
      {activeModule && currentLessonData && (
         <FullScreenPortal>
             <InteractiveLesson lesson={currentLessonData} />
         </FullScreenPortal>
      )}
    </>
  );
};

// 菜单卡片组件
const MenuCard = ({ title, subtitle, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 active:scale-95 transition-transform cursor-pointer hover:shadow-md">
        <div className={`w-14 h-14 rounded-full ${color} text-white flex items-center justify-center shadow-lg shrink-0`}>{icon}</div>
        <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>
        <ChevronRight className="ml-auto text-gray-300" />
    </div>
);

export default SpeakingContentBlock;
