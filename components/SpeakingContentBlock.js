// components/SpeakingContentBlock.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据 (仅包含课程列表)
import speakingList from '@/data/speaking.json';

// --- 动态导入组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
//const ExerciseCard = dynamic(() => import('@/components/ExerciseCard'), { ssr: false });
// 导入全屏互动组件 (用于短句和语法)
const InteractiveLesson = dynamic(() => import('@/components/Tixing/InteractiveLesson'), { ssr: false });

const SpeakingContentBlock = () => {
  const router = useRouter();
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // ==================== 1. 数据加载逻辑 ====================
  // 点击课程时，并行请求该课程的 4 个数据文件
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    
    // 辅助函数：安全 fetch，失败返回空数组
    const fetchSafe = async (url) => {
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
    };

    try {
      // 并行请求：生词、语法、短句、练习
      const [vocabData, grammarData, sentencesData, exercisesData] = await Promise.all([
          fetchSafe(`/data/lessons/${lessonId}/vocabulary.json`),
          fetchSafe(`/data/lessons/${lessonId}/grammar.json`),
          fetchSafe(`/data/lessons/${lessonId}/sentences.json`),
          fetchSafe(`/data/lessons/${lessonId}/exercises.json`)
      ]);

      // 将所有数据整合到当前选中的课程对象中
      setSelectedCourse({
          ...courseSummary,
          vocabulary: vocabData,
          grammar: grammarData,
          sentences: sentencesData,
          exercises: exercisesData
      });
      
      // 打开课程菜单
      router.push(router.asPath + '#course-menu', undefined, { shallow: true });
    } catch (error) {
      console.error(error);
      alert("加载课程失败，请检查网络或数据文件配置。");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 2. 路由与状态同步 ====================
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
    // 监听浏览器后退/前进
    window.addEventListener('popstate', handleHashChange);
    // 初始化检查
    handleHashChange();
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  const handleBack = () => router.back();


  // ==================== 3. 数据转换逻辑 (核心) ====================

  /**
   * 将简单的短句 JSON 转换为 InteractiveLesson 需要的 Block 结构
   * 模式：word_study (滚动列表)
   */
  const transformSentencesToLesson = (sentences) => {
    if (!sentences || sentences.length === 0) return { blocks: [] };
    
    return {
      blocks: [
        {
          type: "word_study", // 复用生词的滚动布局，体验很好
          content: {
            title: "常用短句",
            words: sentences.map(s => ({
              id: s.id,
              chinese: s.sentence,    // 映射：sentence -> chinese
              pinyin: s.pinyin,
              translation: s.translation,
              rate: 0.85 // 句子语速稍慢，方便跟读
            }))
          }
        },
        {
          type: "complete",
          content: { 
              title: "完成！", 
              text: "你已掌握本课的常用短句。" 
          }
        }
      ]
    };
  };

  /**
   * 将语法 JSON 转换为 InteractiveLesson 需要的 Block 结构
   * 模式：grammar_study (GrammarPointPlayer)
   * 支持：富文本解释、例句播放
   */
  const transformGrammarToLesson = (grammarData) => {
    if (!grammarData || grammarData.length === 0) return { blocks: [] };
    
    return {
      blocks: [
        {
          type: "grammar_study",
          content: {
            title: "核心语法深度解析",
            grammarPoints: grammarData.map(g => {
              // 构造富文本解释：优先使用 visibleExplanation，没有则自动拼凑
              let finalExplanation = g.visibleExplanation;
              
              if (!finalExplanation) {
                  // 如果是简单数据，自动生成 HTML
                  finalExplanation = `
                      <div class="font-bold text-blue-600 mb-2">${g.translation || ''}</div>
                      <div>${g.explanation || ''}</div>
                  `;
              }
              // 追加用法说明
              if (g.usage) finalExplanation += g.usage;
              if (g.attention) finalExplanation += g.attention;

              return {
                id: g.id,
                grammarPoint: g.grammarPoint || g.sentence, // 标题 (兼容两种字段名)
                pattern: g.pattern || g.sentence,           // 句型结构
                visibleExplanation: finalExplanation,       // 最终 HTML
                examples: g.examples || []                  // 例句数组
              };
            })
          }
        },
        {
          type: "complete",
          content: { 
              title: "太棒了！", 
              text: "你已完成本课的语法要点学习。" 
          }
        }
      ]
    };
  };


  // ==================== 4. 渲染界面 ====================
  return (
    <>
      {/* 加载中遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium">正在加载资源...</span>
            </div>
        </div>
      )}

      {/* A. 课程列表 (主界面) */}
      <div className="space-y-4 pb-20">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">口语速成</h2>
            <p className="text-sm text-gray-500">共 {speakingList.length} 课精选内容</p>
        </div>

        {speakingList.map(course => (
          <div 
              key={course.id} 
              onClick={() => handleCourseClick(course)}
              className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 transition-all duration-300 flex items-center justify-between active:scale-[0.98]"
          >
             <div className="flex items-center">
                <div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4">
                    {course.id}
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3>
                    <p className="text-xs text-gray-500">{course.description}</p>
                </div>
             </div>
             <ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* B. 课程菜单 (从底部弹出) */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-gray-100 dark:bg-gray-900 flex flex-col"
          >
            {/* 菜单顶部导航 */}
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
                    <ChevronRight className="rotate-180" size={24}/>
                </button>
                <h2 className="flex-1 text-center font-bold text-lg pr-8 truncate">
                    {selectedCourse.title}
                </h2>
            </div>

            {/* 菜单选项列表 */}
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <MenuCard 
                    title="生词学习" 
                    subtitle={`${selectedCourse.vocabulary?.length || 0} 个生词`}
                    icon={<Book size={24}/>}
                    color="bg-blue-500"
                    onClick={() => handleModuleClick('vocab')}
                />
                
                <MenuCard 
                    title="常用短句" 
                    subtitle={`${selectedCourse.sentences?.length || 0} 个实用句子`}
                    icon={<Sparkles size={24}/>}
                    color="bg-pink-500"
                    onClick={() => handleModuleClick('sentences')}
                />

                <MenuCard 
                    title="语法解析" 
                    subtitle={`${selectedCourse.grammar?.length || 0} 个句型`}
                    icon={<MessageCircle size={24}/>}
                    color="bg-purple-500"
                    onClick={() => handleModuleClick('grammar')}
                />

                <MenuCard 
                    title="课后练习" 
                    subtitle={`${selectedCourse.exercises?.length || 0} 道练习题`}
                    icon={<PenTool size={24}/>}
                    color="bg-orange-500"
                    onClick={() => handleModuleClick('exercises')}
                />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* C. 各个模块的具体内容展示 */}

      {/* 1. 生词 -> WordCard 组件 */}
      <WordCard 
        isOpen={activeModule === 'vocab'}
        words={selectedCourse?.vocabulary || []}
        onClose={handleBack}
        progressKey={`vocab-${selectedCourse?.id}`}
      />

      {/* 2. 常用短句 -> InteractiveLesson (全屏滚动，无引导) */}
      {activeModule === 'sentences' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             {/* 独立的关闭按钮 */}
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <X size={20} className="text-gray-600 dark:text-gray-200" />
             </button>
             <InteractiveLesson lesson={transformSentencesToLesson(selectedCourse?.sentences)} />
         </div>
      )}

      {/* 3. 语法解析 -> InteractiveLesson (使用 GrammarPointPlayer) */}
      {activeModule === 'grammar' && (
         <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
             <button onClick={handleBack} className="fixed top-4 right-4 z-[60] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm">
                <X size={20} className="text-gray-600 dark:text-gray-200" />
             </button>
             <InteractiveLesson lesson={transformGrammarToLesson(selectedCourse?.grammar)} />
         </div>
      )}

      {/* 4. 练习 -> ExerciseCard 组件 */}
      <ExerciseCard 
        isOpen={activeModule === 'exercises'} 
        exercises={selectedCourse?.exercises || []} 
        onClose={handleBack} 
      />
    </>
  );
};

// 辅助子组件：菜单项卡片
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
