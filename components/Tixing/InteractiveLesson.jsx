import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { FaPlay, FaCheck, FaHome, FaRedo } from "react-icons/fa";

// --- 动态导入组件 ---
const GrammarPointPlayer = dynamic(() => import('./GrammarPointPlayer'), { ssr: false });
const WordStudyPlayer = dynamic(() => import('./WordStudyPlayer'), { ssr: false });
const XuanZeTi = dynamic(() => import('./XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('./PanDuanTi'), { ssr: false });
const DuiHua = dynamic(() => import('./DuiHua'), { ssr: false });

// --- 样式：隐藏滚动条但保留功能 ---
const scrollbarStyles = `
  ::-webkit-scrollbar { width: 0px; background: transparent; }
  * { scrollbar-width: none; -ms-overflow-style: none; }
`;

// --- Audio Manager ---
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return { stop:()=>{}, playTTS:async()=>{}, playDing:()=>{} };
  let audioEl = null;
  const stop = () => { try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} };
  const playUrl = async (url) => { stop(); if (!url) return; try { const a = new Audio(url); a.play().catch(()=>{}); audioEl = a; } catch (e) {} };
  return { 
    stop, 
    playTTS: async (t) => { 
        if(!t) return;
        const u = `https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${ttsVoices.zh}`; 
        playUrl(u); 
    }, 
    playDing: () => { try { new Audio('/sounds/click.mp3').play().catch(()=>{}); } catch(e){} } 
  };
})();

// --- 封面组件 ---
const CoverScreen = ({ title, subTitle, image, onStart }) => {
    const bgImage = image || "https://images.unsplash.com/photo-1548625361-9877015037d2?q=80&w=1920&auto=format&fit=crop";
    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-900">
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 transform scale-105 transition-transform duration-[20s] ease-linear hover:scale-110"
                style={{ backgroundImage: `url("${bgImage}")`, filter: 'brightness(0.6) blur(2px)' }}
            />
            <div className="relative z-10 p-8 flex flex-col items-center max-w-md mx-4 animate-in fade-in zoom-in duration-700">
                <div className="mb-8 w-16 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.8)]"></div>
                <h1 className="text-4xl md:text-5xl font-black text-white text-center leading-tight mb-6 drop-shadow-xl tracking-wide">
                    {title || "HSK 课程"}
                </h1>
                <p className="text-white/90 text-lg mb-12 font-medium tracking-widest font-sans text-center opacity-90">
                    {subTitle || "Interactive Learning"}
                </p>
                <button 
                    onClick={onStart}
                    className="group relative px-12 py-4 bg-white text-slate-900 font-black rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_40px_rgba(255,255,255,0.4)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center gap-3 overflow-hidden"
                >
                    <span className="relative z-10 text-xl tracking-wide">开始学习</span>
                    <FaPlay size={16} className="relative z-10 ml-1 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
};

// --- 完成页面 (优化版) ---
const CompletionBlock = ({ onExit, onRestart }) => { 
  useEffect(() => { 
    import('canvas-confetti').then(m => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;
        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            m.default(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            m.default(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    });
  }, []);
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 animate-in fade-in duration-500 p-6">
      <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg mb-8 animate-bounce">
          <FaCheck className="text-white text-4xl" />
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 text-center">恭喜完成！</h2>
      <p className="text-slate-500 mb-12 text-center max-w-xs text-lg">你已经完成了本节课的所有内容，掌握了新的知识点。</p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
          <button onClick={onExit} className="w-full px-6 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all flex items-center justify-center gap-2">
            <FaHome /> 返回课程列表
          </button>
          <button onClick={onRestart} className="w-full px-6 py-4 bg-white text-slate-600 font-bold rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
            <FaRedo /> 再学一次
          </button>
      </div>
    </div>
  ); 
};

// --- 主组件 ---
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 从 lesson 对象中读取 blocks
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);

  const goNext = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex < blocks.length) setCurrentIndex(prev => prev + 1); 
  }, [currentIndex, blocks.length]);

  const goPrev = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1); 
  }, [currentIndex]);

  const handleRestart = () => {
      setCurrentIndex(0);
      setIsStarted(false); // 可选：是否回到封面
  };
  
  const handleCorrect = useCallback(() => {
    audioManager.playDing();
    import('canvas-confetti').then(m => m.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } }));
  }, []);

  const handleExit = () => router.back();

  if (!hasMounted) return null;

  // 1. 封面状态
  if (!isStarted) {
      return (
        <div className="fixed inset-0 w-screen h-screen bg-slate-900 font-sans">
             <style>{scrollbarStyles}</style>
             <CoverScreen 
                title={lesson?.title} 
                subTitle={lesson?.description} 
                image={lesson?.coverImage}     
                onStart={() => { audioManager.playDing(); setIsStarted(true); }} 
             />
        </div>
      );
  }

  // 2. 完成状态 (当索引超出 blocks 长度时)
  if (currentIndex >= blocks.length) {
      return (
        <div className="fixed inset-0 w-screen h-screen bg-white font-sans">
            <style>{scrollbarStyles}</style>
            <CompletionBlock onExit={handleExit} onRestart={handleRestart} />
        </div>
      );
  }

  // 3. 学习内容渲染
  // 通用 props
  const commonProps = { 
    key: `${lesson.id}-${currentIndex}`, 
    // 数据透传
    data: currentBlock.content,
    // 互动题特定字段
    question: currentBlock.content.question, 
    options: currentBlock.content.options,
    correctAnswer: currentBlock.content.correctAnswer, 
    // 回调
    onCorrect: handleCorrect,
    onComplete: goNext, // 语法/单词学完后调用
    onNext: goNext,     // 互动题做完后调用
    onPrev: goPrev,
    isFirst: currentIndex === 0
  };

  const type = (currentBlock.type || '').toLowerCase();
  
  // 容器组件
  // FullScreen: 用于单词、语法、对话等全屏展示的内容，强制 overflow-y-auto 防止截断
  const FullScreen = ({ children }) => (
      <div className="w-full h-full animate-in fade-in slide-in-from-right-8 duration-300 overflow-y-auto bg-slate-50">
          {children}
      </div>
  );

  // QuestionWrapper: 用于选择题等，居中显示
  const QuestionWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50 animate-in fade-in duration-300 relative overflow-y-auto">
         <div className="w-full max-w-md z-10 my-auto">{children}</div>
      </div>
  );

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-800">
      <style>{scrollbarStyles}</style>
      
      {/* 隐藏的顶部栏，用于放置返回按钮(可选) */}
      <div className="absolute top-0 left-0 p-4 z-50 pointer-events-none">
         {/* 如果需要返回按钮可以放这里，目前为空保持全屏沉浸 */}
      </div>

      <main className="w-full h-full relative">
        {type === 'word_study' && (
            <FullScreen>
                <WordStudyPlayer 
                    data={commonProps.data} 
                    onNext={goNext} 
                    onPrev={goPrev} 
                    isFirstBlock={commonProps.isFirst} 
                />
            </FullScreen>
        )}
        
        {type === 'grammar_study' && (
            <FullScreen>
                <GrammarPointPlayer 
                    // 确保传递的是 grammarPoints 数组
                    grammarPoints={commonProps.data.grammarPoints} 
                    onComplete={goNext} 
                />
            </FullScreen>
        )}
        
        {type === 'choice' && (
            <QuestionWrapper>
                <XuanZeTi {...commonProps} />
            </QuestionWrapper>
        )}
        
        {type === 'panduan' && (
            <QuestionWrapper>
                <PanDuanTi {...commonProps} />
            </QuestionWrapper>
        )}
        
        {type === 'dialogue' && (
            <FullScreen>
                <DuiHua {...commonProps} />
            </FullScreen>
        )}
        
        {/* 未知类型处理 */}
        {!['word_study','grammar_study','choice','panduan','dialogue'].includes(type) && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p>Unknown Module: {type}</p>
                <button onClick={goNext} className="mt-4 text-blue-500">Skip</button>
            </div>
        )}
      </main>
    </div>
  );
}
