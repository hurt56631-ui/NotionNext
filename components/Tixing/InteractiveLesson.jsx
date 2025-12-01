import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// ---------------- Audio Manager ----------------
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null, onEnded = null;
  const stop = () => { try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} if (onEnded) { onEnded(); onEnded = null; } };
  const playUrl = async (url, { onEnd = null } = {}) => { stop(); if (!url) return; try { const a = new Audio(url); a.volume = 1.0; a.preload = 'auto'; a.onended = () => { if (onEnd) onEnd(); if (audioEl === a) { audioEl = null; onEnded = null; } }; a.onerror = () => { if (onEnd) onEnd(); }; audioEl = a; onEnded = onEnd; await a.play().catch(()=>{}); } catch (e) { if (onEnd) onEnd(); } };
  const blobCache = new Map();
  const fetchToBlobUrl = async (url) => { try { if (blobCache.has(url)) return blobCache.get(url); const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b); blobCache.set(url, u); return u; } catch (e) { return url; } };
  return { 
    stop, 
    playTTS: async (t, l='zh', r=0, cb=null) => { 
      if (!t) { if (cb) cb(); return; } 
      const v = ttsVoices[l]||ttsVoices.zh; 
      const u = await fetchToBlobUrl(`https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`); 
      return playUrl(u, { onEnd: cb }); 
    }, 
    playDing: () => { try { new Audio('/sounds/click.mp3').play().catch(()=>{}); } catch(e){} } 
  };
})();

// ---------------- 👇 完整恢复的子组件 👇 ----------------

// 1. 教学演示块 (TeachingBlock)
const TeachingBlock = ({ data, onComplete, settings }) => {
  useEffect(() => {
    if (data?.narrationScript && settings?.playTTS) {
      const timer = setTimeout(() => {
        settings.playTTS(data.narrationScript, data.narrationLang || 'my');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [data, settings]);

  const handleManualPlay = (e) => {
    e.stopPropagation();
    settings?.playTTS(data.displayText || data.narrationScript || '', 'zh');
  };

  return (
    <div className="w-full flex flex-col items-center animate-fade-in-up pb-20">
      {data.pinyin && <p className="text-lg text-slate-500 font-medium mb-4 font-mono">{data.pinyin}</p>}
      
      <div className="relative bg-white w-full rounded-[2rem] p-10 shadow-xl shadow-blue-100/50 border border-slate-100 flex flex-col items-center justify-center min-h-[220px] mb-8">
        <h1 className="text-5xl md:text-6xl font-black text-slate-800 text-center tracking-tight leading-tight">
          {data.displayText}
        </h1>
        <button 
          onClick={handleManualPlay} 
          className="absolute -bottom-7 bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-90 transition-transform"
        >
          <HiSpeakerWave className="text-2xl" />
        </button>
      </div>

      {data.translation && (
        <div className="bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl border border-slate-200/60 shadow-sm mt-4">
          <p className="text-xl text-slate-600 font-medium text-center leading-relaxed">
            {data.translation}
          </p>
        </div>
      )}

      <div className="mt-10 w-full px-4">
        <button onClick={onComplete} className="w-full py-4 bg-slate-800 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
          继续 <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

// 2. 生词学习块 (WordStudyBlock)
const WordStudyBlock = ({ data, onComplete, settings }) => {
  return (
    <div className="w-full h-full flex flex-col pb-24">
      <div className="text-center mb-6 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || "生词学习"}</h2>
        <p className="text-slate-400 text-sm mt-1">点击卡片听发音</p>
      </div>

      {/* 单词列表 - 允许滚动 */}
      <div className="flex-1 w-full">
        <div className="grid grid-cols-2 gap-4">
          {data.words?.map((word, i) => (
            <button
              key={word.id || i}
              onClick={() => settings?.playTTS(word.chinese, 'zh', word.rate || 0)}
              className="flex flex-col items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all hover:border-blue-300 hover:shadow-md"
            >
              <span className="text-xs text-slate-400 font-medium mb-1 font-mono">{word.pinyin}</span>
              <span className="text-2xl font-bold text-slate-800 mb-2">{word.chinese}</span>
              <span className="text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded-md w-full truncate text-center">{word.translation}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="mt-8 px-4 w-full">
        <button onClick={onComplete} className="w-full py-3.5 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
          我学会了
        </button>
      </div>
    </div>
  );
};

const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    audioManager?.playTTS("恭喜完成", 'zh');
    setTimeout(() => router.back(), 2500);
  }, [router]);
  
  return (
    <div className="flex flex-col items-center justify-center animate-bounce-in">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2>
    </div>
  );
};

const UnknownBlockHandler = ({ type, onSkip }) => (
  <div onClick={onSkip} className="text-center text-gray-400">
    未知题型: {type} <br/> 点击跳过
  </div>
);

// ---------------- Main Component ----------------

export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);
  useEffect(() => { if (lesson?.id && hasMounted) { const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); if (saved && parseInt(saved) < totalBlocks) setCurrentIndex(parseInt(saved)); } }, [lesson, hasMounted, totalBlocks]);
  useEffect(() => { if (hasMounted && lesson?.id && currentIndex > 0) localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString()); audioManager?.stop(); }, [currentIndex, lesson?.id, hasMounted]);

  const goNext = useCallback(() => { audioManager?.stop(); if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)); }, [currentIndex, totalBlocks]);
  const goPrev = useCallback(() => { audioManager?.stop(); if (currentIndex > 0) setCurrentIndex(prev => Math.max(prev - 1, 0)); }, [currentIndex]);
  
  const delayedNextStep = useCallback(() => {
    import('canvas-confetti').then(m => m.default({ particleCount: 80, spread: 60, origin: { y: 0.6 } })).catch(()=>{});
    setTimeout(() => setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)), 1200); 
  }, [totalBlocks]);

  const handleJump = (e) => { e.preventDefault(); const p = parseInt(jumpValue); if (p >= 1 && p <= totalBlocks) setCurrentIndex(p - 1); setIsJumping(false); setJumpValue(''); };

  const renderBlock = () => {
    if (!currentBlock) return <div className="text-slate-400">Loading...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    
    // 传递 props
    const props = { 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, 
      onNext: goNext, 
      settings: { playTTS: audioManager?.playTTS } 
    };
    
    // 通用容器：负责居中，但允许内容过长时滚动
    const CommonWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col items-center justify-center pt-4">
        {children}
      </div>
    );

    try {
      switch (type) {
        // Teaching 和 WordStudy 不用 CommonWrapper 强制居中，因为它们有自己的布局
        case 'teaching': return <TeachingBlock {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'grammar_study': return <div className="h-full w-full overflow-hidden"><GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} /></div>;

        // 题型组件使用 CommonWrapper 居中显示
        case 'choice': return <CommonWrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} /></CommonWrapper>;
        case 'panduan': return <CommonWrapper><PanDuanTi {...props} /></CommonWrapper>;
        case 'lianxian': const pairsMap = props.data.pairs?.reduce((acc,p)=>{acc[p.id]=`${p.id}_b`;return acc},{})||{}; return <CommonWrapper><LianXianTi title={props.data.prompt} columnA={props.data.pairs?.map(p=>({id:p.id,content:p.left}))} columnB={props.data.pairs?.map(p=>({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={pairsMap} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'paixu': return <CommonWrapper><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...props.data.items].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'gaicuo': return <CommonWrapper><GaiCuoTi {...props} /></CommonWrapper>;
        case 'image_match_blanks': return <CommonWrapper><TianKongTi {...props.data} onCorrect={props.onNext} /></CommonWrapper>;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        
        case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (e) { return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />; }
  };

  if (!hasMounted) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; }`}</style>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 pointer-events-none" />

      {/* 顶部进度条 */}
      <div className="relative flex-none pt-[env(safe-area-inset-top)] px-4 py-3 z-20">
        {currentIndex < totalBlocks && (
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mx-4">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 
         主内容区 
         1. overflow-y-auto: 允许生词列表等长内容滚动
         2. overscroll-contain: 防止滚动传播到 body
         3. touch-action-pan-y: 允许内部垂直滚动，但外层仍锁死
      */}
      <main 
        className="relative flex-1 w-full max-w-xl mx-auto flex flex-col z-10 px-4 pb-32 overflow-y-auto overscroll-contain"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="flex-1 flex flex-col justify-center min-h-full">
           {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
        </div>
      </main>

      {/* 底部导航 (只保留翻页) */}
      <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-8 py-4 z-30 flex justify-between items-center pointer-events-none">
          <button onClick={goPrev} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/50 shadow-sm text-slate-400 flex items-center justify-center border border-slate-100/50 ${currentIndex === 0 ? 'opacity-0' : 'opacity-100'}`}><FaChevronLeft /></button>
          
          <button onClick={() => setIsJumping(true)} className="pointer-events-auto px-4 py-2 rounded-xl active:bg-black/5 transition-colors">
            <span className="text-sm font-bold text-slate-400">{currentIndex + 1} / {totalBlocks}</span>
          </button>

          <button onClick={goNext} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/50 shadow-sm text-slate-400 flex items-center justify-center border border-slate-100/50 ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}><FaChevronRight /></button>
      </div>
      
      {isJumping && <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}><div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72"><form onSubmit={handleJump}><input type="number" autoFocus value={jumpValue} onChange={e => setJumpValue(e.target.value)} className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 outline-none py-2" /><button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold">GO</button></form></div></div>}
    </div>
  );
}
