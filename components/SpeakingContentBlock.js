import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, MessageCircle, Book, PenTool, X, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据 (只有标题和简介)
import speakingList from '@/data/speaking.json';

const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false });

const SpeakingContentBlock = () => {
  const router = useRouter();
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false); // 新增加载状态

  // 1. 点击课程 -> 异步加载详情数据
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    
    try {
      // 动态请求 public/data/lessons/ 下的 json 文件
      const res = await fetch(`/data/lessons/${courseSummary.id}.json`);
      if (!res.ok) throw new Error("Lesson data not found");
      
      const detailData = await res.json();
      
      // 合并目录信息和详情信息
      setSelectedCourse({ ...courseSummary, ...detailData });
      
      // 打开菜单
      router.push(router.asPath + '#course-menu', undefined, { shallow: true });
    } catch (error) {
      console.error("加载课程失败", error);
      alert(`无法加载第 ${courseSummary.id} 课的内容，请检查网络或数据文件是否存在。`);
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

  return (
    <>
      {/* 全屏加载遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium">正在加载课程...</span>
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

      {/* 课程菜单 */}
      <AnimatePresence>
        {selectedCourse && !activeModule && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-gray-100 dark:bg-gray-900 flex flex-col"
          >
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex items-center">
                <button onClick={handleBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
                    <ChevronRight className="rotate-180" size={24}/>
                </button>
                <h2 className="flex-1 text-center font-bold text-lg pr-8 truncate">
                    {selectedCourse.title}
                </h2>
            </div>

            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                <MenuCard 
                    title="生词学习" 
                    subtitle={`${selectedCourse.vocabulary?.length || 0} 个生词`}
                    icon={<Book size={24}/>}
                    color="bg-blue-500"
                    onClick={() => handleModuleClick('vocab')}
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

      {/* 具体内容 */}
      <WordCard 
        isOpen={activeModule === 'vocab'}
        words={selectedCourse?.vocabulary || []}
        onClose={handleBack}
        progressKey={`vocab-${selectedCourse?.id}`}
      />

      <ShortSentenceCard 
        isOpen={activeModule === 'grammar'}
        sentences={(selectedCourse?.grammar || []).map(g => ({
            id: g.id,
            sentence: g.sentence,
            pinyin: g.pinyin,
            translation: g.translation,
        }))}
        onClose={handleBack}
        progressKey={`grammar-${selectedCourse?.id}`}
      />

      <ExerciseView 
        isOpen={activeModule === 'exercises'} 
        exercises={selectedCourse?.exercises || []} 
        onClose={handleBack} 
      />
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

const ExerciseView = ({ isOpen, exercises, onClose }) => {
    const [revealedId, setRevealedId] = useState(null);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center z-10">
                <h2 className="font-bold text-lg">课后练习</h2>
                <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {exercises.length === 0 && <div className="text-center text-gray-500 mt-10">本课暂无练习题</div>}
                {exercises.map((ex, index) => (
                    <div 
                        key={ex.id} 
                        onClick={() => setRevealedId(revealedId === ex.id ? null : ex.id)}
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700 cursor-pointer transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <span className="bg-teal-100 text-teal-600 px-2 py-0.5 rounded text-sm font-bold">Q{index + 1}</span>
                            <p className="font-medium text-lg text-gray-800 dark:text-gray-100">{ex.question}</p>
                        </div>
                        <div className={`mt-4 pt-4 border-t dark:border-gray-700 transition-all overflow-hidden ${revealedId === ex.id ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'}`}>
                             <p className="text-teal-600 dark:text-teal-400 font-bold">答案：</p>
                             <p className="text-gray-600 dark:text-gray-300">{ex.answer}</p>
                        </div>
                        {revealedId !== ex.id && <p className="text-center text-xs text-gray-400 mt-4">点击查看答案</p>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SpeakingContentBlock;
