import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router'; 
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
// ... 其他引入保持不变

// ---------------- Audio Manager ----------------
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null, onEnded = null;
  const stop = () => { try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} if (onEnded) { onEnded(); onEnded = null; } };
  // 增加音量控制 volume=1.0
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
    playDing: () => { /* ...保持原样... */ } 
  };
})();

// ... Placeholders 保持不变 ...
const TeachingBlock = ({ data, onComplete }) => <div onClick={onComplete} className="p-8 text-center bg-white rounded-3xl shadow-lg border border-slate-100"><h1 className="text-3xl font-bold mb-4">{data.displayText}</h1><p className="text-slate-500">点击继续</p></div>;
const WordStudyBlock = ({ data, onComplete }) => <div onClick={onComplete} className="p-8 text-center bg-white rounded-3xl shadow-lg border border-slate-100"><h1 className="text-2xl font-bold mb-4">生词学习</h1><p className="text-slate-500">点击继续</p></div>;
const CompletionBlock = ({ data, router }) => { useEffect(() => { audioManager?.playTTS("恭喜完成", 'zh'); setTimeout(() => router.back(), 2500); }, [router]); return <div className="flex flex-col items-center justify-center animate-bounce-in"><div className="text-8xl mb-6">🎉</div><h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2></div>; };
const UnknownBlockHandler = ({ type, onSkip }) => <div onClick={onSkip} className="text-center text-gray-400">未知题型: {type}</div>;

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
    setTimeout(() => setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)), 1000); 
  }, [totalBlocks]);

  const handleJump = (e) => { e.preventDefault(); const p = parseInt(jumpValue); if (p >= 1 && p <= totalBlocks) setCurrentIndex(p - 1); setIsJumping(false); setJumpValue(''); };

  const renderBlock = () => {
    if (!currentBlock) return <div className="text-slate-400">Loading...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    
    // 关键：把 playTTS 传下去
    const props = { 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, 
      onNext: goNext, 
      settings: { playTTS: audioManager?.playTTS } 
    };
    
    const CommonWrapper = ({ children }) => <div className="w-full flex flex-col items-center justify-center">{children}</div>;

    try {
      switch (type) {
        case 'teaching': return <CommonWrapper><TeachingBlock {...props} /></CommonWrapper>;
        case 'word_study': return <CommonWrapper><WordStudyBlock {...props} /></CommonWrapper>;
        case 'choice': return <CommonWrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} /></CommonWrapper>;
        // ... 其他题型保持不变 ...
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (e) { return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />; }
  };

  if (!hasMounted) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; }`}</style>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 pointer-events-none" />

      {/* 顶部进度 */}
      <div className="relative flex-none pt-[env(safe-area-inset-top)] px-4 py-3 z-20">
        {currentIndex < totalBlocks && (
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mx-4">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 内容居中 */}
      <main className="relative flex-1 w-full max-w-xl mx-auto flex flex-col justify-center items-center z-10 px-6 pb-20">
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* 底部导航 (只保留前后翻页，不放提交按钮，提交按钮放题型组件里) */}
      <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-8 py-6 z-30 flex justify-between items-center pointer-events-none">
          <button onClick={goPrev} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/50 shadow-sm text-slate-400 flex items-center justify-center ${currentIndex === 0 ? 'opacity-0' : 'opacity-100'}`}><FaChevronLeft /></button>
          
          <button onClick={() => setIsJumping(true)} className="pointer-events-auto px-4 py-2 rounded-xl active:bg-black/5 transition-colors">
            <span className="text-sm font-bold text-slate-400">{currentIndex + 1} / {totalBlocks}</span>
          </button>

          <button onClick={goNext} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/50 shadow-sm text-slate-400 flex items-center justify-center ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}><FaChevronRight /></button>
      </div>
      
      {isJumping && <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}><div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72"><form onSubmit={handleJump}><input type="number" autoFocus value={jumpValue} onChange={e => setJumpValue(e.target.value)} className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 outline-none py-2" /><button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold">GO</button></form></div></div>}
    </div>
  );
}
