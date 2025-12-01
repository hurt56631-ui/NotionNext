// components/Tixing/InteractiveLesson.jsx (全屏浅色系美化版)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
import { IoMdClose, IoMdRefresh } from "react-icons/io";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 统一的TTS模块 ---
const ttsVoices = {
  zh: 'zh-CN-XiaoyouNeural',
  my: 'my-MM-NilarNeural',
};
let currentAudio = null;

const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (!text) {
    if (onEndCallback) onEndCallback?.();
    return;
  }
  const voice = ttsVoices[lang];
  if (!voice) {
    console.error(`Unsupported language for TTS: ${lang}`);
    if (onEndCallback) onEndCallback();
    return;
  }
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
    const audio = new Audio(url);
    currentAudio = audio;
    const onEnd = () => {
      if (currentAudio === audio) currentAudio = null;
      if (onEndCallback) onEndCallback();
    };
    audio.onended = onEnd;
    audio.onerror = (e) => {
      console.error("Audio element failed to play:", e);
      onEnd();
    };
    await audio.play();
  } catch (e) {
    console.error(`播放失败:`, e);
    if (onEndCallback) onEndCallback();
  }
};

const stopAllAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

// ---------------- 内置 UI Block (白底卡片风格) ----------------

// 1. 教学演示块
const TeachingBlock = ({ data, onComplete, settings }) => {
  useEffect(() => {
    if (data?.narrationScript) {
      const timer = setTimeout(() => {
        settings.playTTS(data.narrationScript, data.narrationLang || 'my');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data, settings]);

  const handleManualPlay = (e) => {
    e.stopPropagation();
    settings.playTTS(data.displayText || data.narrationScript || '', 'zh');
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in-up">
      {/* 拼音/注音 */}
      {data.pinyin && <p className="text-lg text-slate-500 font-medium mb-3 tracking-wide">{data.pinyin}</p>}
      
      {/* 核心大字 */}
      <div className="relative bg-white rounded-3xl p-8 shadow-xl shadow-blue-100/50 border border-slate-100 w-full max-w-sm flex flex-col items-center justify-center min-h-[200px] mb-8">
         <h1 className="text-5xl md:text-6xl font-black text-slate-800 tracking-tight">{data.displayText}</h1>
         <button 
           onClick={handleManualPlay} 
           className="absolute -bottom-6 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-500/30 hover:scale-110 hover:bg-blue-700 transition-all active:scale-95"
           aria-label="播放"
         >
            <HiSpeakerWave className="h-6 w-6" />
         </button>
      </div>

      {/* 释义 */}
      {data.translation && (
        <p className="text-xl text-slate-600 font-medium text-center mt-4 px-4 leading-relaxed bg-white/60 backdrop-blur-sm py-2 px-6 rounded-full border border-slate-200/50">
          {data.translation}
        </p>
      )}

      {/* 继续按钮 (移动端大按钮) */}
      <div className="mt-12 w-full max-w-xs">
        <button onClick={onComplete} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2">
          继续 <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

// 2. 生词学习块
const WordStudyBlock = ({ data, onComplete, settings }) => {
  const handlePlayWord = (word) => {
    settings.playTTS(word.chinese, 'zh', word.rate || 0);
  };

  return (
    <div className="w-full flex flex-col h-full animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || "生词学习"}</h2>
        <p className="text-slate-500 text-sm mt-1">点击卡片听发音</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 pr-1 scrollbar-hide">
        <div className="grid grid-cols-2 gap-4 content-start">
          {data.words?.map(word => (
            <button
              key={word.id}
              onClick={() => handlePlayWord(word)}
              className="group relative flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-95 hover:shadow-md hover:border-blue-200"
            >
              <div className="text-xs text-slate-400 font-medium mb-1">{word.pinyin}</div>
              <div className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{word.chinese}</div>
              <div className="text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded-md w-full truncate">{word.translation}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 shrink-0 w-full">
        <button onClick={onComplete} className="w-full py-3.5 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
          学完了
        </button>
      </div>
    </div>
  );
};

// 3. 完成块
const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    const textToPlay = data.title || "恭喜";
    playTTS(textToPlay, 'zh');
    if (typeof window !== 'undefined') {
      import('canvas-confetti').then(module => {
        module.default({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }).catch(() => {});
    }
    const timer = setTimeout(() => router.push('/'), 4000);
    return () => clearTimeout(timer);
  }, [data, router]);

  return (
    <div className="flex flex-col items-center justify-center text-center animate-bounce-in">
      <div className="text-8xl mb-6 drop-shadow-sm">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-3">{data.title || "太棒了！"}</h2>
      <p className="text-lg text-slate-500">{data.text || "正在保存进度并返回主页..."}</p>
      <div className="mt-8 w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
};

const UnknownBlockHandler = ({ type, onSkip }) => {
  useEffect(() => { const timer = setTimeout(onSkip, 1000); return () => clearTimeout(timer); }, [onSkip]);
  return <div className="text-slate-400 text-sm bg-slate-100 px-4 py-2 rounded-full">加载中... ({type})</div>;
};

// ---------------- 主播放器组件 ----------------
export default function InteractiveLesson({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const router = useRouter();
  
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  // 缓存与进度逻辑
  useEffect(() => {
    if (lesson?.id) {
      try { localStorage.setItem(`lesson-cache-${lesson.id}`, JSON.stringify(lesson)); } catch (e) {}
    }
  }, [lesson]);

  useEffect(() => {
    if (lesson?.id) {
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`);
      if (saved) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx > 0 && idx < totalBlocks) setCurrentIndex(idx);
      }
    }
  }, [lesson?.id, totalBlocks]);

  useEffect(() => {
    if (lesson?.id && currentIndex > 0 && currentIndex < totalBlocks) {
      localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
    }
  }, [currentIndex, lesson?.id, totalBlocks]);

  // 切换题目时停止音频
  useEffect(() => { stopAllAudio(); }, [currentIndex]);

  // 选择题自动朗读
  useEffect(() => {
    if (currentBlock?.type === 'choice' && currentBlock.content?.narrationText) {
      const timer = setTimeout(() => { playTTS(currentBlock.content.narrationText, 'zh'); }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentBlock]);

  const goNext = useCallback(() => {
    stopAllAudio();
    if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => {
    stopAllAudio();
    if (currentIndex > 0) setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, [currentIndex]);

  const delayedNextStep = useCallback(() => {
    if (typeof window !== 'undefined') {
      import('canvas-confetti').then(module => module.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } })).catch(() => {});
    }
    setTimeout(() => { setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)); }, 1500); // 缩短等待时间，提升体感
  }, [totalBlocks]);

  const handleJump = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalBlocks) {
      setCurrentIndex(pageNum - 1);
    }
    setIsJumping(false);
    setJumpValue('');
  };

  const renderBlock = () => {
    if (currentIndex >= totalBlocks) return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
    if (!currentBlock) return <div className="text-slate-500 flex flex-col items-center"><div className="animate-spin mb-2 text-2xl">⏳</div>准备中...</div>;

    const type = currentBlock.type.toLowerCase();
    const props = { data: currentBlock.content, onCorrect: delayedNextStep, onComplete: goNext, settings: { playTTS } };

    // 包装器：为所有题型提供统一的浅色背景容器样式，如果题型组件本身没有自带背景
    const ContentWrapper = ({ children }) => <div className="w-full">{children}</div>;

    try {
      switch (type) {
        case 'teaching': return <TeachingBlock {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'grammar_study':
          return <div className="h-[80vh] w-full"><GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} /></div>;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
        case 'choice':
          return (
            <ContentWrapper>
              <XuanZeTi 
                {...props} 
                question={{ text: props.data.prompt, ...props.data }} 
                options={props.data.choices || []} 
                correctAnswer={props.data.correctId ? [props.data.correctId] : []} 
                onNext={props.onCorrect} 
                isListeningMode={!!props.data.narrationText}
              />
            </ContentWrapper>
          );
        case 'lianxian':
          const columnA = props.data.pairs?.map(p => ({ id: p.id, content: p.left })) || [];
          const columnB = props.data.pairs?.map(p => ({ id: `${p.id}_b`, content: p.right })).sort(() => Math.random() - 0.5) || [];
          const pairsMap = props.data.pairs?.reduce((acc, p) => { acc[p.id] = `${p.id}_b`; return acc; }, {}) || {};
          return <LianXianTi title={props.data.prompt} columnA={columnA} columnB={columnB} pairs={pairsMap} onCorrect={props.onCorrect} />;
        case 'paixu':
           return <PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...props.data.items].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={props.onCorrect} onComplete={props.onComplete} settings={props.settings} />;
        case 'panduan': return <PanDuanTi {...props} />;
        case 'gaicuo': return <GaiCuoTi {...props} />;
        case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (error) {
      console.error(`渲染错误: ${type}`, error);
      return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />;
    }
  };

  return (
    // 1. 全屏、高层级容器，覆盖底部导航，浅色背景
    <div className="fixed inset-0 w-full h-[100dvh] bg-gradient-to-b from-blue-50 to-slate-100 text-slate-800 z-[5000] flex flex-col font-sans overflow-hidden">
      
      {/* 2. 顶部导航与进度条 */}
      {currentIndex < totalBlocks && (
        <div className="flex-none px-6 pt-safe-top pb-2 w-full z-20 bg-white/50 backdrop-blur-sm border-b border-white/50">
           <div className="flex items-center justify-between h-12">
             <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
               <IoMdClose className="text-2xl" />
             </button>
             
             {/* 进度条 */}
             <div className="flex-1 mx-4 h-2 bg-slate-200 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                 style={{ width: `${((currentIndex + 1) / Math.max(totalBlocks, 1)) * 100}%` }}
               />
             </div>
             
             <button onClick={() => setIsJumping(true)} className="text-sm font-bold text-slate-500 tabular-nums px-2 py-1 bg-slate-100 rounded-lg">
               {currentIndex + 1} / {totalBlocks}
             </button>
           </div>
        </div>
      )}

      {/* 跳转浮层 (Modal) */}
      {isJumping && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[6000] flex items-center justify-center animate-fade-in" onClick={() => setIsJumping(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72 transform transition-all scale-100">
            <h3 className="text-slate-800 font-bold text-lg mb-4 text-center">跳转至题目</h3>
            <form onSubmit={handleJump} className="relative">
              <input
                type="number"
                autoFocus
                value={jumpValue}
                placeholder={`1 - ${totalBlocks}`}
                onChange={(e) => setJumpValue(e.target.value)}
                className="w-full px-4 py-3 text-center bg-slate-50 text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xl font-bold"
              />
              <button type="submit" className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold">确定</button>
            </form>
          </div>
        </div>
      )}

      {/* 3. 主内容区域 - 居中偏上显示 */}
      {/* justify-start + pt-[10vh] 实现偏上，避免被视线低处遮挡 */}
      <main className="flex-1 flex flex-col items-center justify-start pt-[5vh] md:pt-[10vh] px-6 w-full max-w-2xl mx-auto overflow-y-auto pb-32">
        {renderBlock()}
      </main>

      {/* 4. 底部控制栏 (悬浮极简风格) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-safe-bottom bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between pointer-events-auto">
          {/* 上一题 */}
          <button
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              currentIndex <= 0 
                ? 'opacity-0 translate-y-4' 
                : 'bg-white shadow-md border border-slate-100 text-slate-600 active:scale-95'
            }`}
          >
            <FaChevronLeft />
          </button>

          {/* 如果是互动题（如选择题）通常有自己的“下一步”，这里只在部分页面显示强制下一步，或者始终显示辅助跳转 */}
          <button
            onClick={goNext}
            disabled={currentIndex >= totalBlocks}
            className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg transition-all active:scale-95 ${
              currentIndex >= totalBlocks 
                ? 'opacity-0' 
                : 'bg-white text-slate-800 border border-slate-100 hover:bg-slate-50'
            }`}
          >
            <span className="font-bold">跳过 / 下一步</span>
            <FaChevronRight className="text-xs opacity-60" />
          </button>
        </div>
      </div>
    </div>
  );
}
