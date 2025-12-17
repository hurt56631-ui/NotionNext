import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic'; // ✅ 1. 引入动态导入
import { FaChevronLeft, FaTimes } from "react-icons/fa";

// ✅ 2. 使用 dynamic 禁用 SSR (服务端渲染)
// 这样 Next.js 在打包时就会跳过这些组件的预渲染，彻底解决 "document is not defined"
const GrammarPointPlayer = dynamic(() => import('./GrammarPointPlayer'), { ssr: false });
const WordStudyPlayer = dynamic(() => import('./WordStudyPlayer'), { ssr: false });

// 题型组件也建议这样导入，防止里面有直接操作 DOM 的代码
const XuanZeTi = dynamic(() => import('./XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('./PanDuanTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('./PaiXuTi'), { ssr: false });
const LianXianTi = dynamic(() => import('./LianXianTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('./GaiCuoTi'), { ssr: false });
const DuiHua = dynamic(() => import('./DuiHua'), { ssr: false });
const TianKongTi = dynamic(() => import('./TianKongTi'), { ssr: false });

// 注意：canvas-confetti 是一个库，为了安全，我们在 useEffect 里动态导入使用，
// 或者确保它只在客户端执行。这里我们在回调函数里使用 import() 是安全的。

// --- Audio Manager (保持不变) ---
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  // ✅ 这里的检查非常重要
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

// --- 完成页面 ---
const CompletionBlock = ({ onExit }) => { 
  useEffect(() => { 
    // 动态导入 confetti，防止构建报错
    import('canvas-confetti').then(m => m.default({ particleCount: 150, spread: 70, origin: { y: 0.6 } })); 
  }, []);
  
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white animate-fade-in">
      <div className="text-8xl mb-6 animate-bounce">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-8">课程完成！</h2>
      <button onClick={onExit} className="px-8 py-3 bg-green-500 text-white font-bold rounded-full shadow-lg hover:bg-green-600 transition-colors">
        返回列表
      </button>
    </div>
  ); 
};

// --- 未知类型处理 ---
const UnknownBlockHandler = ({ type, onNext }) => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p>开发中: {type}</p>
        <button onClick={onNext} className="mt-4 text-blue-500 underline">跳过</button>
    </div>
);

// ---------------- 主组件 ----------------
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);

  // 进度保存
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
        const isFinished = currentIndex >= totalBlocks;
        if (isFinished) {
            localStorage.removeItem(`lesson-progress-${lesson.id}`);
        } else {
            localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
        }
    }
  }, [currentIndex, lesson?.id, hasMounted, totalBlocks]);

  const goNext = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex < totalBlocks) setCurrentIndex(prev => prev + 1); 
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1); 
  }, [currentIndex]);
  
  const handleCorrect = useCallback(() => {
    audioManager.playDing();
    import('canvas-confetti').then(m => m.default({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#2563eb', '#22c55e'] }));
    setTimeout(() => goNext(), 1000); 
  }, [goNext]);

  const handleExit = () => router.back();

  const renderBlock = () => {
    if (!currentBlock) return null;
    
    const commonProps = { 
      key: `${lesson.id}-${currentIndex}`, 
      data: currentBlock.content, 
      onCorrect: handleCorrect,
      onComplete: goNext,
      onNext: goNext,
      onPrev: goPrev,
      isFirst: currentIndex === 0, // 用于判断是否是整个课程的第一步
      isLast: currentIndex === totalBlocks - 1,
      settings: { playTTS: audioManager?.playTTS } 
    };

    // 容器样式
    const FullScreen = ({ children }) => <div className="w-full h-full">{children}</div>;
    const QuestionWrapper = ({ children }) => <div className="w-full h-full flex flex-col justify-center p-4 bg-slate-50">{children}</div>;

    const type = (currentBlock.type || '').toLowerCase();

    switch (type) {
      case 'word_study': 
        // ✅ 使用新的 WordStudyPlayer，并且不加 Padding，全屏显示
        return (
            <FullScreen>
                <WordStudyPlayer 
                    data={commonProps.data} 
                    onNext={goNext} 
                    onPrev={goPrev} 
                    isFirstBlock={commonProps.isFirst} // 传递是否是第一块，用于禁用返回按钮
                />
            </FullScreen>
        );

      case 'phrase_study': 
         // 如果你还没做 PhraseStudyPlayer，暂时用 WordStudyPlayer 顶替或显示开发中
         return <FullScreen><WordStudyPlayer {...commonProps} isFirstBlock={commonProps.isFirst} /></FullScreen>;

      case 'grammar_study': 
        return <FullScreen><GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} /></FullScreen>;

      // 互动题
      case 'choice': return <QuestionWrapper><XuanZeTi {...commonProps} /></QuestionWrapper>;
      case 'panduan': return <QuestionWrapper><PanDuanTi {...commonProps} /></QuestionWrapper>;
      case 'lianxian': return <QuestionWrapper><LianXianTi {...commonProps} /></QuestionWrapper>;
      case 'paixu': return <QuestionWrapper><PaiXuTi {...commonProps} /></QuestionWrapper>;
      case 'gaicuo': return <QuestionWrapper><GaiCuoTi {...commonProps} /></QuestionWrapper>;
      case 'tiankong': return <QuestionWrapper><TianKongTi {...commonProps} /></QuestionWrapper>;
      case 'dialogue': return <FullScreen><DuiHua {...commonProps} /></FullScreen>;
      
      default: return <UnknownBlockHandler type={type} onNext={goNext} />;
    }
  };

  // 必须确保客户端挂载后才渲染，避免 hydration mismatch
  if (!hasMounted) return null;

  if (currentIndex >= totalBlocks) {
      return <CompletionBlock onExit={handleExit} />;
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 py-3 pointer-events-none">
          <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden backdrop-blur-sm shadow-sm">
            <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${((currentIndex) / totalBlocks) * 100}%` }} 
            />
          </div>
      </div>

      {/* 退出按钮 */}
      <button 
        onClick={handleExit}
        className="absolute top-4 left-4 z-50 w-8 h-8 flex items-center justify-center bg-black/10 rounded-full text-slate-600 active:bg-black/20 backdrop-blur-md"
      >
        <FaTimes size={14} />
      </button>

      {/* 主内容 */}
      <main className="w-full h-full">
        {renderBlock()}
      </main>
    </div>
  );
}
