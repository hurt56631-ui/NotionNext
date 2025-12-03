import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom'; 
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, X, Volume2, ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

// 导入目录数据
import speakingList from '@/data/speaking.json';

// --- 核心组件 ---
const InteractiveLesson = dynamic(() => import('@/components/Tixing/InteractiveLesson'), { ssr: false });

// --- 全屏传送门 ---
const FullScreenPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-gray-50 flex flex-col" style={{ touchAction: 'none' }}>
      {children}
    </div>,
    document.body
  );
};

// --- 音频缓存与播放逻辑 (单例缓存) ---
const audioBlobCache = new Map(); // 全局缓存，切换页面后依然有效（刷新失效）

const useAudioPlayer = () => {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const playAudio = async (id, text) => {
    // 停止当前正在播放的
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingId(id);

    try {
      let audioUrl;

      // 1. 检查缓存
      if (audioBlobCache.has(text)) {
        console.log("👉 命中音频缓存");
        audioUrl = audioBlobCache.get(text);
      } else {
        // 2. 如果没有缓存，发起请求 (这里演示用浏览器自带TTS，如果是API请求请替换 fetch 逻辑)
        // 真实场景示例：
        // const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
        // const blob = await res.blob();
        // audioUrl = URL.createObjectURL(blob);
        
        // --- 模拟生成音频 URL (实际项目中请替换为真实的 fetch) ---
        // 这里为了演示代码可用性，使用了 Web Speech API，但在逻辑上模拟了缓存过程
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; // 或目标语言
        u.onend = () => setPlayingId(null);
        window.speechSynthesis.speak(u);
        return; 
        // -----------------------------------------------------

        // 如果你有真实的音频URL，请解开下面注释并使用缓存逻辑：
        /*
        audioBlobCache.set(text, audioUrl);
        */
      }

      // 3. 播放音频 (针对 Blob URL)
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setPlayingId(null);
        audio.play();
      }
    } catch (err) {
      console.error("播放失败", err);
      setPlayingId(null);
    }
  };

  return { playingId, playAudio };
};

// --- 新增：列表式学习组件 (生词/短句专用) ---
const AudioListLesson = ({ data, title, onBack, isSentence = false }) => {
  const { playingId, playAudio } = useAudioPlayer();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm border-b z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 active:scale-90 transition-transform">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg text-gray-800">{title}</h2>
        <div className="w-8"></div> {/* 占位 */}
      </div>

      {/* 滚动列表区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {data?.map((item, index) => {
            const mainText = isSentence ? item.sentence : item.word;
            const isPlaying = playingId === item.id;

            return (
              <motion.div 
                key={item.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => playAudio(item.id, mainText)}
                className={`
                  relative bg-white p-4 rounded-xl border transition-all cursor-pointer select-none
                  ${isPlaying ? 'border-teal-500 shadow-md ring-1 ring-teal-100' : 'border-gray-100 shadow-sm active:scale-[0.99]'}
                `}
              >
                <div className="flex items-start gap-4">
                  {/* 序号 */}
                  <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isPlaying ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {index + 1}
                  </div>

                  {/* 内容区 */}
                  <div className="flex-1 space-y-1">
                    <h3 className={`text-lg font-medium leading-relaxed ${isPlaying ? 'text-teal-700' : 'text-gray-800'}`}>
                      {mainText}
                    </h3>
                    {(item.pinyin) && (
                      <p className="text-sm text-gray-400 font-mono">{item.pinyin}</p>
                    )}
                    <p className="text-sm text-gray-500 pt-1 border-t border-gray-50 mt-2">
                      {item.translation}
                    </p>
                  </div>

                  {/* 播放图标 */}
                  <div className={`p-2 rounded-full ${isPlaying ? 'text-teal-600 bg-teal-50' : 'text-gray-300'}`}>
                    {isPlaying ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                  </div>
                </div>
              </motion.div>
            );
        })}

        {(!data || data.length === 0) && (
          <div className="text-center text-gray-400 py-10">暂无内容</div>
        )}
        
        {/* 底部占位，防止最后一行被遮挡 */}
        <div className="h-10"></div>
      </div>
    </div>
  );
};


// --- 主组件 ---
const SpeakingContentBlock = () => {
  const router = useRouter();
  
  const [selectedCourse, setSelectedCourse] = useState(null); 
  const [activeModule, setActiveModule] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  // ==================== 1. 数据加载 ====================
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const lessonId = courseSummary.id;
    const fetchSafe = async (url) => {
        try { const res = await fetch(url); return res.ok ? await res.json() : []; } 
        catch (e) { return []; }
    };
    try {
      const [vocabData, grammarData, sentencesData, exercisesData] = await Promise.all([
          fetchSafe(`/data/lessons/${lessonId}/vocabulary.json`),
          fetchSafe(`/data/lessons/${lessonId}/grammar.json`),
          fetchSafe(`/data/lessons/${lessonId}/sentences.json`),
          fetchSafe(`/data/lessons/${lessonId}/exercises.json`)
      ]);
      setSelectedCourse({ ...courseSummary, vocabulary: vocabData, grammar: grammarData, sentences: sentencesData, exercises: exercisesData });
      router.push(router.asPath + '#course-menu', undefined, { shallow: true });
    } catch (error) {
      console.error(error);
      alert("加载课程失败");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 2. 状态与路由同步 ====================
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
      else if (hash.includes('#course-menu')) setActiveModule(null); 
      else { setSelectedCourse(null); setActiveModule(null); }
    };
    window.addEventListener('popstate', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('popstate', handleHashChange);
  }, []);

  // ==================== 3. 旧的数据转换 (仅保留给语法和练习使用) ====================
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
                narrationScript: g.narrationScript,
                examples: g.examples || [],
                usage: g.usage,
                attention: g.attention
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
  
  // 辅助函数：判断是否使用新版列表组件
  const isListComponent = activeModule === 'vocab' || activeModule === 'sentences';
  
  // 准备数据
  let renderContent = null;
  const baseId = selectedCourse ? selectedCourse.id : 'temp';

  if (activeModule === 'grammar') {
      const lessonData = transformGrammarToLesson(selectedCourse?.grammar);
      if(lessonData) lessonData.id = `${baseId}_grammar`;
      renderContent = <InteractiveLesson lesson={lessonData} />;
  }
  else if (activeModule === 'exercises') {
      const lessonData = transformExercisesToLesson(selectedCourse?.exercises);
      if(lessonData) lessonData.id = `${baseId}_exercises`;
      renderContent = <InteractiveLesson lesson={lessonData} />;
  }
  else if (activeModule === 'vocab') {
      // ✅ 生词：使用新组件
      renderContent = (
        <AudioListLesson 
            data={selectedCourse?.vocabulary} 
            title="核心生词" 
            onBack={handleBack} 
            isSentence={false}
        />
      );
  }
  else if (activeModule === 'sentences') {
      // ✅ 短句：使用新组件
      renderContent = (
        <AudioListLesson 
            data={selectedCourse?.sentences} 
            title="常用短句" 
            onBack={handleBack} 
            isSentence={true}
        />
      );
  }
  
  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="animate-spin text-teal-600" />
                <span className="font-medium">正在加载...</span>
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
          <div key={course.id} onClick={() => handleCourseClick(course)} className="bg-white dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/50 cursor-pointer hover:shadow-lg hover:border-teal-500 transition-all flex items-center justify-between active:scale-[0.98]">
             <div className="flex items-center"><div className="w-12 h-12 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xl mr-4">{course.id}</div><div><h3 className="font-bold text-gray-800 dark:text-gray-100">{course.title}</h3><p className="text-xs text-gray-500">{course.description}</p></div></div><ChevronRight className="text-gray-300"/>
          </div>
        ))}
      </div>

      {/* 课程菜单 */}
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

      {/* ✅ 全屏渲染区域：统一入口 */}
      {activeModule && renderContent && (
         <FullScreenPortal>
             {renderContent}
         </FullScreenPortal>
      )}
    </>
  );
};

// 菜单卡片组件
const MenuCard = ({ title, subtitle, icon, color, onClick }) => (
    <div onClick={onClick} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6 active:scale-95 transition-transform cursor-pointer">
        <div className={`w-14 h-14 rounded-full ${color} text-white flex items-center justify-center shadow-lg`}>{icon}</div>
        <div><h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3><p className="text-gray-500 dark:text-gray-400">{subtitle}</p></div><ChevronRight className="ml-auto text-gray-300" />
    </div>
);

export default SpeakingContentBlock;
