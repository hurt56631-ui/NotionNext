import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据
import speakingList from '@/data/speaking.json';

// 1. 导入组件
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
// 导入全屏互动引擎 (InteractiveLesson 内部集成了 XuanZeTi, PanDuanTi 等所有题型)
const InteractiveLesson = dynamic(() => import('@/components/InteractiveLesson'), { ssr: false });

// ✅ 移除 ExerciseCard，不再需要
// const ExerciseCard = dynamic(() => import('@/components/ExerciseCard'), { ssr: false });

const SpeakingContentBlock = () => {
  const router = useRouter();
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // 数据加载逻辑 (保持不变)
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    
    const fetchSafe = async (url) => {
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
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
          exercises: exercisesData // 这里现在加载的是 题型Block 数组
      });
      
      router.push(router.asPath + '#course-menu', undefined, { shallow: true });
    } catch (error) {
      alert("加载失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModuleClick = (type) => {
    setActiveModule(type);
    router.push(router.asPath.split('#')[0] + `#course-${type}`, undefined, { shallow: true });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('#course-vocab')) setActiveModule('vocab');
      else if (hash.includes('#course-grammar')) setActiveModule('grammar');
      else if (hash.includes('#course-sentences')) setActiveModule('sentences');
      else if (hash.includes('#course-exercises')) setActiveModule('exercises');
      else if (hash.includes('#course-menu')) setActiveModule(null);
      else {
        setSelectedCourse(null);
        setActiveModule(null);
      }
    };
    window.addEventListener('popstate', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  const handleBack = () => router.back();

  // ==================== 数据转换 ====================

  // 1. 短句转换 (和之前一样)
  const transformSentencesToLesson = (sentences) => {
    if (!sentences || sentences.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "word_study",
          content: {
            title: "常用短句",
            words: sentences.map(s => ({
              id: s.id,
              chinese: s.sentence,
              pinyin: s.pinyin,
              translation: s.translation,
              rate: 0.85
            }))
          }
        },
        { type: "complete", content: { title: "完成！", text: "你已掌握本课短句。" } }
      ]
    };
  };

  // 2. 语法转换 (和之前一样)
  const transformGrammarToLesson = (grammarData) => {
    if (!grammarData || grammarData.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "grammar_study",
          content: {
            title: "核心语法解析",
            grammarPoints: grammarData.map(g => {
              let finalExplanation = g.visibleExplanation;
              if (!finalExplanation) {
                 finalExplanation = `<div class="font-bold text-blue-600 mb-2">${g.translation || ''}</div><div>${g.explanation || ''}</div>`;
              }
              if (g.usage) finalExplanation += g.usage;
              if (g.attention) finalExplanation += g.attention;

              return {
                id: g.id,
                grammarPoint: g.grammarPoint || g.sentence,
                pattern: g.pattern || g.sentence,
                visibleExplanation: finalExplanation,
                examples: g.examples || []
              };
            })
          }
        },
        { type: "complete", content: { title: "太棒了！", text: "语法要点已学完。" } }
      ]
    };
  };

  // 3. 练习转换 (✅ 新逻辑)
  // 因为 exercises.json 已经是 blocks 格式了，我们只需要简单包装一下
  const transformExercisesToLesson = (exercisesData) => {
    if (!exercisesData || exercisesData.length === 0) return { blocks: [] };
    
    // 直接返回数据，因为我们在 json 里已经写好了 type: "choice", type: "panduan" 等
    return {
      blocks: exercisesData
    };
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium">正在加载资源...</span>
            </div>
        </div>
      )}

      {/* 课程列表 */}
      <div className="space-y-4 pb-20">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">口语速成</h2>
            <p className="text-sm text-gray-500">共 {speakingList.length} 课精选内容</p>
        </div>
        {speakingList.map(course => (
          <div key={course.id} onClick={() => handleCourseClick(course)} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 transition-all duration-300 flex items-center justify-between active:scale-[0.98]">
             <div className="flex items-center">
                <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4">{course.id}</div>
                <div><h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3><p className="text-xs text-gray-500">{course.description}</p></div>
             </div>
             <ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* 课程菜单 */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-0 z-40 bg-gray-100 dark:bg-gray-900 flex flex-col">
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300"><ChevronRight className="rotate-180" size={24}/></button>
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

      {/* 1. 生词 (卡片) */}
      <WordCard isOpen={activeModule === 'vocab'} words={selectedCourse?.vocabulary || []} onClose={handleBack} progressKey={`vocab-${selectedCourse?.id}`} />

      {/* 2. 短句 (全屏互动) */}
      {activeModule === 'sentences' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             <InteractiveLesson lesson={transformSentencesToLesson(selectedCourse?.sentences)} />
         </div>
      )}

      {/* 3. 语法 (全屏互动) */}
      {activeModule === 'grammar' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             <InteractiveLesson lesson={transformGrammarToLesson(selectedCourse?.grammar)} />
         </div>
      )}

      {/* 4. 练习 (全屏互动 - 升级版!) */}
      {activeModule === 'exercises' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             {/* 练习模式一般不允许中途随便退出，或者您可以保留关闭按钮 */}
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             
             {/* 直接把 exercises.json 的数据传给 lesson */}
             <InteractiveLesson lesson={transformExercisesToLesson(selectedCourse?.exercises)} />
         </div>
      )}
    </>
  );
};

const MenuCard = ({ title, subtitle, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 active:scale-95 transition-transform cursor-pointer">
        <div className={`w-14 h-14 rounded-full ${color} text-white flex items-center justify-center shadow-lg`}>
            {icon}
        </div>
        <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
            <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <ChevronRight className="ml-auto text-gray-300" />
    </div>
);

export default SpeakingContentBlock;
