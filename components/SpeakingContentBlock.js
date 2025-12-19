import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom'; 
import { ChevronRight, MessageCircle, Book, PenTool, Loader2, Sparkles, Volume2, ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { pinyin } from 'pinyin-pro'; 

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

// --- 全局音频缓存 (Blob URL) ---
const audioBlobCache = new Map();

// --- 音频播放 Hook ---
const useAudioPlayer = () => {
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  const playAudio = useCallback(async (id, text) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setPlayingId(id);

    try {
      let audioUrl;
      const cacheKey = text;

      if (audioBlobCache.has(cacheKey)) {
        audioUrl = audioBlobCache.get(cacheKey);
      } else {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const voice = 'zh-CN-XiaoyouNeural';
        const rateParam = 0;
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;

        const res = await fetch(apiUrl, { signal: controller.signal });
        if (!res.ok) throw new Error('TTS Network response was not ok');
        
        const blob = await res.blob();
        audioUrl = URL.createObjectURL(blob);
        audioBlobCache.set(cacheKey, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingId(null);
        abortControllerRef.current = null;
      };
      
      audio.onerror = (e) => {
        console.error("Audio playback error", e);
        setPlayingId(null);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') console.error("Audio play interrupted:", error);
        });
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("TTS Error:", err);
        setPlayingId(null);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return { playingId, playAudio };
};

// --- Ruby 文本渲染 ---
const RubyText = ({ text }) => {
  const segments = useMemo(() => {
    if (!text) return [];
    const segs = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const zhPart = match[1];
      const otherPart = match[2];

      if (zhPart) {
        const chars = zhPart.split('');
        const pinyins = pinyin(zhPart, { type: 'array', toneType: 'symbol' });
        chars.forEach((char, i) => {
          segs.push({ type: 'zh', char, py: pinyins[i] || '' });
        });
      } else if (otherPart) {
        segs.push({ type: 'other', text: otherPart });
      }
    }
    return segs;
  }, [text]);

  return (
    <div className="flex flex-wrap justify-center items-end gap-x-1 leading-normal">
      {segments.map((seg, i) => {
        if (seg.type === 'zh') {
          return (
            <div key={i} className="flex flex-col items-center mx-[1px] min-w-[1.2em]">
              <span className="text-[10px] sm:text-xs text-gray-500 font-mono mb-[-2px] select-none text-center w-full truncate">
                {seg.py}
              </span>
              <span className="text-xl sm:text-2xl font-bold text-gray-800 leading-none">
                {seg.char}
              </span>
            </div>
          );
        } else {
          return (
            <span key={i} className="text-lg sm:text-xl text-gray-800 pb-[2px] leading-none">
              {seg.text}
            </span>
          );
        }
      })}
    </div>
  );
};

// --- 列表式学习组件 ---
const AudioListLesson = ({ data, title, onBack, isSentence = false }) => {
  const { playingId, playAudio } = useAudioPlayer();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <style jsx global>{`
        .thin-scrollbar::-webkit-scrollbar { width: 4px; }
        .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .thin-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}</style>

      <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm border-b z-10 flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 active:scale-90 transition-transform">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg text-gray-800">{title}</h2>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 thin-scrollbar">
        {data?.map((item, index) => {
            const mainText = isSentence ? item.sentence : item.word;
            const itemId = item.id || `item-${index}`;
            const isPlaying = playingId === itemId;

            return (
              <motion.div 
                key={itemId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => playAudio(itemId, mainText)}
                className={`
                  relative bg-white p-6 rounded-2xl transition-all cursor-pointer select-none
                  flex flex-col items-center justify-center text-center
                  ${isPlaying ? 'border-2 border-teal-400 shadow-lg scale-[1.01]' : 'border border-gray-100 shadow-sm active:scale-[0.98]'}
                `}
              >
                <div className={`absolute top-3 right-3 transition-colors ${isPlaying ? 'text-teal-500' : 'text-gray-200'}`}>
                  {isPlaying ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
                </div>

                <div className="w-full mb-3 mt-1">
                   <RubyText text={mainText} />
                </div>

                <p className="text-sm text-gray-500 font-medium px-4 py-1 bg-gray-50 rounded-full">
                  {item.translation}
                </p>
              </motion.div>
            );
        })}
        {(!data || data.length === 0) && <div className="text-center text-gray-400 py-10">暂无内容</div>}
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

  // ==================== 1. 数据加载逻辑 (封装) ====================
  // 这个函数负责根据 ID 去 fetch 数据，不涉及路由跳转，方便复用
  const fetchCourseData = useCallback(async (courseSummary) => {
    if (!courseSummary) return null;
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
      return { 
        ...courseSummary, 
        vocabulary: vocabData, 
        grammar: grammarData, 
        sentences: sentencesData, 
        exercises: exercisesData 
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  // ==================== 2. 用户点击课程 ====================
  const handleCourseClick = async (courseSummary) => {
    setIsLoading(true);
    const data = await fetchCourseData(courseSummary);
    if (data) {
        setSelectedCourse(data);
        // 修改路由：添加 ?cid=xxx 参数，这样分享出去时，别人才能知道是哪一课
        router.push({
            pathname: router.pathname,
            query: { ...router.query, cid: courseSummary.id },
            hash: 'course-menu'
        }, undefined, { shallow: true });
    } else {
        alert("加载课程失败");
    }
    setIsLoading(false);
  };

  // ==================== 3. 深度链接 (Deep Linking) 支持 ====================
  // 处理：刷新页面、后退、或别人打开链接时的自动加载
  useEffect(() => {
    // 只有当路由准备好后才执行
    if (!router.isReady) return;

    const { cid } = router.query;
    const hash = window.location.hash;

    const initLoad = async () => {
        // 如果 URL 里有 cid，但当前没有数据，说明是刷新或新打开的
        if (cid && (!selectedCourse || String(selectedCourse.id) !== String(cid))) {
            const courseSummary = speakingList.find(c => String(c.id) === String(cid));
            if (courseSummary) {
                setIsLoading(true);
                const data = await fetchCourseData(courseSummary);
                if (data) {
                    setSelectedCourse(data);
                    // 数据加载完后，再根据 hash 设置模块
                    if (hash.includes('#course-vocab')) setActiveModule('vocab');
                    else if (hash.includes('#course-grammar')) setActiveModule('grammar');
                    else if (hash.includes('#course-sentences')) setActiveModule('sentences');
                    else if (hash.includes('#course-exercises')) setActiveModule('exercises');
                    else setActiveModule(null); // 默认为 menu
                }
                setIsLoading(false);
                return; // 加载完成后终止，避免下面的 hash 逻辑重复执行
            }
        }

        // 如果数据已经有了，或者 URL 里没有 cid，只处理纯 hash 切换
        if (hash.includes('#course-vocab')) setActiveModule('vocab');
        else if (hash.includes('#course-grammar')) setActiveModule('grammar');
        else if (hash.includes('#course-sentences')) setActiveModule('sentences');
        else if (hash.includes('#course-exercises')) setActiveModule('exercises');
        else if (hash.includes('#course-menu')) setActiveModule(null); 
        else {
            // 如果既没有 hash 也没有 cid，回到首页
            if (!cid) {
                setSelectedCourse(null); 
                setActiveModule(null);
            }
        }
    };

    initLoad();
    
    // 监听 hash 变化 (用于浏览器前进后退)
    const handlePopState = () => initLoad();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.cid, router.asPath]); // 依赖项加入 router.query.cid

  // ==================== 4. 模块点击与返回 ====================
  const handleModuleClick = (type) => {
    setActiveModule(type);
    // 保持 cid 参数，只修改 hash
    router.push({
        pathname: router.pathname,
        query: { ...router.query }, // 保持当前的 query 参数 (cid)
        hash: `course-${type}`
    }, undefined, { shallow: true });
  };

  const handleBack = () => router.back();

  // ==================== 5. 数据转换逻辑 ====================
  const transformGrammarToLesson = (data) => {
    if (!data || data.length === 0) return { blocks: [] };
    return {
      blocks: [
        {
          type: "grammar_study",
          content: {
            grammarPoints: data.map(g => {
              let finalExplanation = g['语法详解'] || g.visibleExplanation;
              if (!finalExplanation) {
                  const title = g['翻译'] || g.translation || '';
                  const exp = g['解释'] || g.explanation || '';
                  finalExplanation = `### ${title}\n\n${exp}`;
              }
              const usage = g['适用场景'] || g.usage;
              if (usage) finalExplanation += `\n\n${usage}`;
              return { id: g.id, ...g, visibleExplanation: finalExplanation };
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

  // ==================== 6. 渲染内容选择 ====================
  let renderContent = null;
  const baseId = selectedCourse ? selectedCourse.id : 'temp';

  if (selectedCourse) { // 确保有数据才渲染
      if (activeModule === 'grammar') {
          const lessonData = transformGrammarToLesson(selectedCourse.grammar);
          if(lessonData) lessonData.id = `${baseId}_grammar`;
          renderContent = <InteractiveLesson lesson={lessonData} />;
      }
      else if (activeModule === 'exercises') {
          const lessonData = transformExercisesToLesson(selectedCourse.exercises);
          if(lessonData) lessonData.id = `${baseId}_exercises`;
          renderContent = <InteractiveLesson lesson={lessonData} />;
      }
      else if (activeModule === 'vocab') {
          renderContent = (
            <AudioListLesson 
                data={selectedCourse.vocabulary} 
                title="核心生词" 
                onBack={handleBack} 
                isSentence={false}
            />
          );
      }
      else if (activeModule === 'sentences') {
          renderContent = (
            <AudioListLesson 
                data={selectedCourse.sentences} 
                title="常用短句" 
                onBack={handleBack} 
                isSentence={true}
            />
          );
      }
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

      {/* 全屏渲染区域 */}
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
