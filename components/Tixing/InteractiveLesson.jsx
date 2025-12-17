import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { FaPlay } from "react-icons/fa";

// --- 动态导入组件 ---
const GrammarPointPlayer = dynamic(() => import('./GrammarPointPlayer'), { ssr: false });
const WordStudyPlayer = dynamic(() => import('./WordStudyPlayer'), { ssr: false });
const XuanZeTi = dynamic(() => import('./XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('./PanDuanTi'), { ssr: false });
const DuiHua = dynamic(() => import('./DuiHua'), { ssr: false });

// --- 样式 ---
const scrollbarStyles = `
  ::-webkit-scrollbar { width: 0px; background: transparent; }
  * { scrollbar-width: none; }
`;

// --- Audio Manager (保持不变) ---
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

// --- 封面组件 (已修正：接收 externalImage 参数) ---
const CoverScreen = ({ title, subTitle, image, onStart }) => {
    // 默认兜底图，防止数据没配图片时一片黑
    const bgImage = image || "https://images.unsplash.com/photo-1548625361-9877015037d2?q=80&w=1920&auto=format&fit=crop";

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-900">
            {/* 1. 背景图 */}
            <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 transform scale-105 transition-transform duration-[10s] ease-linear hover:scale-110"
                style={{ 
                    backgroundImage: `url("${bgImage}")`,
                    filter: 'brightness(0.7) blur(2px)' //稍微压暗和模糊，突出文字
                }}
            />
            
            {/* 2. 内容卡片 */}
            <div className="relative z-10 p-8 md:p-14 flex flex-col items-center max-w-md mx-4 animate-in fade-in zoom-in duration-500">
                
                {/* 装饰线条 */}
                <div className="mb-8 w-20 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_15px_rgba(250,204,21,0.6)]"></div>
                
                {/* 标题 */}
                <h1 className="text-4xl md:text-5xl font-black text-white text-center leading-tight mb-4 drop-shadow-2xl tracking-wide">
                    {title || "HSK 课程"}
                </h1>
                
                {/* 副标题/描述 */}
                <p className="text-white/90 text-lg mb-12 font-medium tracking-wider font-['Padauk'] text-center">
                    {subTitle || "开始你的中文学习之旅"}
                </p>
                
                {/* 开始按钮 */}
                <button 
                    onClick={onStart}
                    className="group relative px-10 py-4 bg-white text-slate-900 font-black rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.25)] hover:shadow-[0_15px_30px_rgba(255,255,255,0.3)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center gap-3 overflow-hidden"
                >
                    <span className="relative z-10 text-xl tracking-wide">开始学习</span>
                    <FaPlay size={16} className="relative z-10 ml-1 text-blue-600 group-hover:scale-110 transition-transform" />
                    
                    {/* 按钮光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out skew-x-12"></div>
                </button>
            </div>
            
            <div className="absolute bottom-10 text-white/30 text-xs tracking-[0.2em] uppercase font-bold">
                Interactive Learning
            </div>
        </div>
    );
};

// --- 完成页面 ---
const CompletionBlock = ({ onExit }) => { 
  useEffect(() => { 
    import('canvas-confetti').then(m => m.default({ particleCount: 150, spread: 70, origin: { y: 0.6 } })); 
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 animate-in fade-in duration-500">
      <div className="text-8xl mb-6 animate-bounce">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-2">课程完成！</h2>
      <button onClick={onExit} className="px-10 py-3 mt-8 bg-white border border-slate-200 text-slate-700 font-bold rounded-full shadow-sm hover:shadow-md transition-all">
        返回列表
      </button>
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
  
  const handleCorrect = useCallback(() => {
    audioManager.playDing();
    import('canvas-confetti').then(m => m.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } }));
  }, []);

  const handleExit = () => router.back();

  if (!hasMounted) return null;

  // 1. 封面状态：读取 lesson.coverImage
  if (!isStarted) {
      return (
        <div className="fixed inset-0 w-screen h-screen bg-slate-900 font-sans">
             <style>{scrollbarStyles}</style>
             <CoverScreen 
                title={lesson?.title} 
                subTitle={lesson?.description} // 如果数据里有描述
                image={lesson?.coverImage}     // ✅ 关键修改：从数据读取图片
                onStart={() => { audioManager.playDing(); setIsStarted(true); }} 
             />
        </div>
      );
  }

  // 2. 完成状态
  if (currentIndex >= blocks.length) {
      return <div className="fixed inset-0 w-screen h-screen bg-white"><CompletionBlock onExit={handleExit} /></div>;
  }

  // 3. 学习内容渲染
  const commonProps = { 
    key: `${lesson.id}-${currentIndex}`, 
    data: currentBlock.content,
    // 透传互动题所需参数 
    question: currentBlock.content.question, 
    options: currentBlock.content.options,
    correctAnswer: currentBlock.content.correctAnswer, 
    onCorrect: handleCorrect,
    onComplete: goNext,
    onNext: goNext,
    onPrev: goPrev,
    isFirst: currentIndex === 0
  };

  const type = (currentBlock.type || '').toLowerCase();
  
  // 容器
  const FullScreen = ({ children }) => <div className="w-full h-full animate-in fade-in slide-in-from-right-4 duration-300">{children}</div>;
  const QuestionWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-50 animate-in fade-in duration-300 relative">
         <div className="w-full max-w-md z-10">{children}</div>
      </div>
  );

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans">
      <style>{scrollbarStyles}</style>
      <main className="w-full h-full relative">
        {type === 'word_study' && <FullScreen><WordStudyPlayer data={commonProps.data} onNext={goNext} onPrev={goPrev} isFirstBlock={commonProps.isFirst} /></FullScreen>}
        {type === 'grammar_study' && <FullScreen><GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} /></FullScreen>}
        {type === 'choice' && <QuestionWrapper><XuanZeTi {...commonProps} question={currentBlock.content.question} /></QuestionWrapper>}
        {type === 'panduan' && <QuestionWrapper><PanDuanTi {...commonProps} /></QuestionWrapper>}
        {type === 'dialogue' && <FullScreen><DuiHua {...commonProps} /></FullScreen>}
        {!['word_study','grammar_study','choice','panduan','dialogue'].includes(type) && (
            <div className="flex items-center justify-center h-full text-gray-400"><button onClick={goNext}>跳过未知模块: {type}</button></div>
        )}
      </main>
    </div>
  );
    }
