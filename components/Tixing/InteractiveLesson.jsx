// components/Tixing/InteractiveLesson.jsx
'use client'; // 1. 必须添加：如果是 App Router，这行是必须的，因为使用了 useState

import React, { useState, useEffect, useCallback, useMemo } from 'react';
// 2. 路由修复：适配 Next.js 13+ App Router
import { useRouter } from 'next/navigation'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 外部组件引用 (请确保这些文件存在，否则请注释掉) ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 3. 样式注入：解决安全区域和动画问题 ---
// 将这些样式直接注入，避免依赖 tailwind.config.js 配置
const safeAreaStyle = {
  paddingTop: 'env(safe-area-inset-top, 20px)',
  paddingBottom: 'env(safe-area-inset-bottom, 20px)',
};

// --- TTS 模块 ---
const ttsVoices = {
  zh: 'zh-CN-XiaoyouNeural',
  my: 'my-MM-NilarNeural',
};
let currentAudio = null;

const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
  // 4. 防崩：确保在浏览器环境执行
  if (typeof window === 'undefined') return;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (!text) {
    if (onEndCallback) onEndCallback?.();
    return;
  }
  
  // 简单容错
  const voice = ttsVoices[lang] || ttsVoices['zh'];
  
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
      console.error("Audio failed:", e);
      onEnd();
    };
    await audio.play();
  } catch (e) {
    console.error(`Play error:`, e);
    if (onEndCallback) onEndCallback();
  }
};

const stopAllAudio = () => {
  if (typeof window !== 'undefined' && currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

// --- Block 组件 ---

const TeachingBlock = ({ data, onComplete, settings }) => {
  useEffect(() => {
    if (data?.narrationScript) {
      const timer = setTimeout(() => {
        settings.playTTS(data.narrationScript, data.narrationLang || 'my');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data, settings]);

  return (
    <div className="w-full flex flex-col items-center animate-pulse-fade-in">
      {data.pinyin && <p className="text-lg text-slate-500 font-medium mb-3 tracking-wide">{data.pinyin}</p>}
      <div className="relative bg-white rounded-3xl p-8 shadow-xl shadow-blue-100/50 border border-slate-100 w-full max-w-sm flex flex-col items-center justify-center min-h-[200px] mb-8">
         <h1 className="text-5xl md:text-6xl font-black text-slate-800 tracking-tight text-center">{data.displayText}</h1>
         <button 
           onClick={(e) => { e.stopPropagation(); settings.playTTS(data.displayText, 'zh'); }}
           className="absolute -bottom-6 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-500/30 hover:scale-110 active:scale-95 transition-transform"
         >
            <HiSpeakerWave className="h-6 w-6" />
         </button>
      </div>
      {data.translation && (
        <p className="text-xl text-slate-600 font-medium text-center mt-4 px-6 py-2 bg-white/60 backdrop-blur-sm rounded-full border border-slate-200/50">
          {data.translation}
        </p>
      )}
      <div className="mt-12 w-full max-w-xs">
        <button onClick={onComplete} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-2xl shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2">
          继续 <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

const WordStudyBlock = ({ data, onComplete, settings }) => {
  return (
    <div className="w-full flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || "生词学习"}</h2>
        <p className="text-slate-500 text-sm mt-1">点击卡片听发音</p>
      </div>
      <div className="flex-1 overflow-y-auto pb-4 pr-1" style={{ scrollbarWidth: 'none' }}>
        <div className="grid grid-cols-2 gap-4 content-start">
          {data.words?.map(word => (
            <button
              key={word.id}
              onClick={() => settings.playTTS(word.chinese, 'zh', word.rate || 0)}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform"
            >
              <div className="text-xs text-slate-400 font-medium mb-1">{word.pinyin}</div>
              <div className="text-2xl font-bold text-slate-800 mb-2 text-center">{word.chinese}</div>
              <div className="text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded-md w-full truncate text-center">{word.translation}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 shrink-0 w-full">
        <button onClick={onComplete} className="w-full py-3.5 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg active:scale-95 transition-all">
          学完了
        </button>
      </div>
    </div>
  );
};

const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    playTTS(data.title || "恭喜", 'zh');
    // 动态导入 canvas-confetti，防止 SSR 报错
    import('canvas-confetti').then(module => {
      module.default({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }).catch(err => console.log("Confetti load failed", err));
    
    // 5. 修复路由跳转
    const timer = setTimeout(() => router.push('/'), 4000);
    return () => clearTimeout(timer);
  }, [data, router]);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-3">{data.title || "太棒了！"}</h2>
      <p className="text-lg text-slate-500">{data.text || "正在返回主页..."}</p>
      <div className="mt-8 w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
};

// 6. 占位组件：当遇到未知的 type 或者组件缺失时显示
const UnknownBlockHandler = ({ type, onSkip }) => (
  <div className="flex flex-col items-center justify-center h-64">
    <div className="text-slate-400 mb-4">暂不支持的题型: {type}</div>
    <button onClick={onSkip} className="text-blue-500 underline">跳过此题</button>
  </div>
);

// --- 主组件 ---
export default function InteractiveLesson({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const router = useRouter();
  
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  // 7. 解决 Hydration Mismatch (SSR不匹配) 问题
  useEffect(() => {
    setMounted(true);
  }, []);

  // 缓存逻辑
  useEffect(() => {
    if (mounted && lesson?.id) {
      try { localStorage.setItem(`lesson-cache-${lesson.id}`, JSON.stringify(lesson)); } catch (e) {}
    }
  }, [lesson, mounted]);

  useEffect(() => {
    if (mounted && lesson?.id) {
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`);
      if (saved) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx > 0 && idx < totalBlocks) setCurrentIndex(idx);
      }
    }
  }, [lesson?.id, totalBlocks, mounted]);

  useEffect(() => {
    if (mounted && lesson?.id && currentIndex > 0) {
      localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
    }
  }, [currentIndex, lesson?.id, mounted]);

  useEffect(() => { stopAllAudio(); }, [currentIndex]);

  const goNext = useCallback(() => {
    stopAllAudio();
    if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => {
    stopAllAudio();
    if (currentIndex > 0) setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, [currentIndex]);

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
    if (!mounted) return null; // 防止服务端渲染不一致
    if (currentIndex >= totalBlocks) return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
    if (!currentBlock) return <div className="text-slate-500 animate-pulse">加载中...</div>;

    const type = currentBlock.type?.toLowerCase();
    const props = { 
      data: currentBlock.content, 
      onCorrect: () => setTimeout(goNext, 1000), 
      onComplete: goNext, 
      onNext: goNext, // 兼容某些组件的 props
      settings: { playTTS } 
    };

    // 使用 try-catch 包裹渲染，防止某个子组件崩溃导致全站白屏
    try {
      switch (type) {
        case 'teaching': return <TeachingBlock {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'choice': 
          return <XuanZeTi {...props} question={{ text: props.data.prompt, ...props.data }} options={props.data.choices || []} correctAnswer={props.data.correctId ? [props.data.correctId] : []} />;
        case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onNext} />;
        case 'lianxian': 
        case 'paixu': 
        case 'panduan': 
        case 'gaicuo':
          // 这里检查组件是否导入，如果导入了就渲染
          // 这里的判断仅作示例，实际上如果 import 失败构建时就会报错
          if (type === 'paixu') return <PaiXuTi {...props} title={props.data.prompt} items={props.data.items} correctOrder={props.data.correctOrder} />;
          if (type === 'lianxian') return <LianXianTi {...props} />;
          if (type === 'panduan') return <PanDuanTi {...props} />;
          if (type === 'gaicuo') return <GaiCuoTi {...props} />;
          return <UnknownBlockHandler type={type} onSkip={goNext} />;
        case 'complete': 
        case 'end': return <CompletionBlock data={props.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (err) {
      console.error("Block render error:", err);
      return <UnknownBlockHandler type={`${type} (Error)`} onSkip={goNext} />;
    }
  };

  if (!mounted) return <div className="fixed inset-0 bg-white" />;

  return (
    // 8. 样式修复：使用 Tailwind 任意值 [100dvh] 解决移动端地址栏遮挡问题
    <div className="fixed inset-0 w-full h-[100dvh] bg-gradient-to-b from-blue-50 to-slate-100 text-slate-800 z-[5000] flex flex-col font-sans overflow-hidden">
      
      {/* 顶部导航 */}
      {currentIndex < totalBlocks && (
        <div className="flex-none w-full z-20 bg-white/50 backdrop-blur-sm border-b border-white/50" style={{ paddingTop: safeAreaStyle.paddingTop }}>
           <div className="flex items-center justify-between h-12 px-4">
             <button onClick={() => router.back()} className="p-2 text-slate-500 hover:text-slate-800">
               <IoMdClose className="text-2xl" />
             </button>
             <div className="flex-1 mx-4 h-2 bg-slate-200 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                 style={{ width: `${((currentIndex + 1) / Math.max(totalBlocks, 1)) * 100}%` }}
               />
             </div>
             <button onClick={() => setIsJumping(true)} className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-lg">
               {currentIndex + 1}/{totalBlocks}
             </button>
           </div>
        </div>
      )}

      {/* 跳转 Modal */}
      {isJumping && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[6000] flex items-center justify-center" onClick={() => setIsJumping(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72">
            <h3 className="text-slate-800 font-bold text-lg mb-4 text-center">跳转至</h3>
            <form onSubmit={handleJump}>
              <input
                type="number"
                autoFocus
                value={jumpValue}
                placeholder={`1 - ${totalBlocks}`}
                onChange={(e) => setJumpValue(e.target.value)}
                className="w-full px-4 py-3 text-center bg-slate-50 text-slate-800 rounded-xl border border-slate-200 text-xl font-bold mb-4"
              />
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold">确定</button>
            </form>
          </div>
        </div>
      )}

      {/* 主内容：justify-start + padding-top 确保视觉重心偏上 */}
      <main className="flex-1 flex flex-col items-center justify-start pt-[5vh] md:pt-[10vh] px-4 w-full max-w-3xl mx-auto overflow-y-auto" style={{ paddingBottom: '120px' }}>
        {renderBlock()}
      </main>

      {/* 底部控制栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-10" style={{ paddingBottom: safeAreaStyle.paddingBottom }}>
        <div className="px-6 pb-6 pt-4 flex items-center justify-between pointer-events-auto max-w-3xl mx-auto">
          <button
            onClick={goPrev}
            disabled={currentIndex <= 0}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-slate-200 shadow-sm ${
              currentIndex <= 0 ? 'opacity-0' : 'bg-white text-slate-600 active:scale-95'
            }`}
          >
            <FaChevronLeft />
          </button>

          <button
            onClick={goNext}
            className="flex items-center gap-2 px-6 py-3 rounded-full shadow-lg bg-white text-slate-800 border border-slate-100 active:scale-95 hover:bg-slate-50 transition-all"
          >
            <span className="font-bold">下一步 / 跳过</span>
            <FaChevronRight className="text-xs opacity-60" />
          </button>
        </div>
      </div>
    </div>
  );
}
