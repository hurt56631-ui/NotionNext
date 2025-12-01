// components/SpeakingContentBlock.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import speakingList from '@/data/speaking.json';

// --- 组件导入 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const InteractiveLesson = dynamic(() => import('@/components/InteractiveLesson'), { ssr: false });

const SpeakingContentBlock = () => {
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    const fetchSafe = async (url) => { try { const res = await fetch(url); if (!res.ok) return []; return await res.json(); } catch (e) { return []; } };

    try {
      const [vocabData, grammarData, sentencesData, exercisesData] = await Promise.all([
          fetchSafe(`/data/lessons/${lessonId}/vocabulary.json`),
          fetchSafe(`/data/lessons/${lessonId}/grammar.json`),
          fetchSafe(`/data/lessons/${lessonId}/sentences.json`),
          fetchSafe(`/data/lessons/${lessonId}/exercises.json`)
      ]);
      setSelectedCourse({ ...courseSummary, vocabulary: vocabData, grammar: grammarData, sentences: sentencesData, exercises: exercisesData });
      router.push(router.asPath + '#course-menu', undefined, { shallow: true });
    } catch (error) { alert("加载失败"); } finally { setIsLoading(false); }
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
        else { setSelectedCourse(null); setActiveModule(null); }
    };
    window.addEventListener('popstate', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  const handleBack = () => router.back();

  // --- 数据转换：短句 ---
  const transformSentencesToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        { type: "word_study", content: { title: "常用短句", words: data.map(s => ({ id: s.id, chinese: s.sentence, pinyin: s.pinyin, translation: s.translation, rate: 0.85 })) } },
        { type: "complete", content: { title: "完成！", text: "短句已掌握。" } }
      ]
    };
  };

  // --- 数据转换：语法 ---
  const transformGrammarToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "grammar_study", // 这会触发 InteractiveLesson 中的 case 'grammar_study'
          content: {
            // 这里的数据会被传递给 GrammarPointPlayer 的 props.grammarPoints
            grammarPoints: data.map(g => {
                let finalExplanation = g.visibleExplanation;
                if (!finalExplanation) {
                    finalExplanation = `<div class="font-bold text-blue-600 mb-2">${g.translation || ''}</div><div>${g.explanation || ''}</div>`;
                }
                if(g.usage) finalExplanation += g.usage;
                return {
                    id: g.id,
                    grammarPoint: g.grammarPoint || g.sentence, // 标题
                    pattern: g.pattern || g.sentence,           // 句型
                    visibleExplanation: finalExplanation,       // 富文本
                    examples: g.examples || []
                };
            })
          }
        },
        { type: "complete", content: { title: "太棒了！", text: "语法要点已学完。" } }
      ]
    };
  };

  // --- 数据转换：练习 ---
  const transformExercisesToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    // 确保数据是数组形式
    return { blocks: Array.isArray(data) ? data : (data.blocks || []) };
  };

  return (
    <>
      {isLoading && (<div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-teal-600"/></div>)}

      {/* 课程列表 */}
      <div className="space-y-4 pb-20">
        <div className="text-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">口语速成</h2><p className="text-sm text-gray-500">共 {speakingList.length} 课精选内容</p></div>
        {speakingList.map(course => (
          <div key={course.id} onClick={() => handleCourseClick(course)} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 transition-all flex items-center justify-between">
             <div className="flex items-center"><div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4">{course.id}</div><div><h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3><p className="text-xs text-gray-500">{course.description}</p></div></div><ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* 菜单 */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} className="fixed inset-0 z-40 bg-gray-100 dark:bg-gray-900 flex flex-col">
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center"><button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300"><ChevronRight className="rotate-180" size={24}/></button><h2 className="flex-1 text-center font-bold text-lg pr-8 truncate">{selectedCourse.title}</h2></div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <MenuCard title="生词学习" subtitle={`${selectedCourse.vocabulary?.length || 0} 个生词`} icon={<Book size={24}/>} color="bg-blue-500" onClick={() => handleModuleClick('vocab')} />
                <MenuCard title="常用短句" subtitle={`${selectedCourse.sentences?.length || 0} 个实用句子`} icon={<Sparkles size={24}/>} color="bg-pink-500" onClick={() => handleModuleClick('sentences')} />
                <MenuCard title="语法解析" subtitle={`${selectedCourse.grammar?.length || 0} 个句型`} icon={<MessageCircle size={24}/>} color="bg-purple-500" onClick={() => handleModuleClick('grammar')} />
                <MenuCard title="课后练习" subtitle={`${selectedCourse.exercises?.length || 0} 道关卡`} icon={<PenTool size={24}/>} color="bg-orange-500" onClick={() => handleModuleClick('exercises')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 模块展示 */}
      <WordCard isOpen={activeModule === 'vocab'} words={selectedCourse?.vocabulary || []} onClose={handleBack} progressKey={`vocab-${selectedCourse?.id}`} />

      {activeModule === 'sentences' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             <InteractiveLesson lesson={transformSentencesToLesson(selectedCourse?.sentences)} />
         </div>
      )}

      {activeModule === 'grammar' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             <InteractiveLesson lesson={transformGrammarToLesson(selectedCourse?.grammar)} />
         </div>
      )}

      {activeModule === 'exercises' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm"><X size={20} className="text-gray-600 dark:text-gray-200" /></button>
             <InteractiveLesson lesson={transformExercisesToLesson(selectedCourse?.exercises)} />
         </div>
      )}
    </>
  );
};

const MenuCard = ({ title, subtitle, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 active:scale-95 transition-transform cursor-pointer">
        <div className={`w-14 h-14 rounded-full ${color} text-white flex items-center justify-center shadow-lg`}>{icon}</div>
        <div><h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3><p className="text-gray-500 dark:text-gray-400">{subtitle}</p></div><ChevronRight className="ml-auto text-gray-300" />
    </div>
);

export default SpeakingContentBlock;
