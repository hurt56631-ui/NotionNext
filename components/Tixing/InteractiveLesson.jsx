import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
// ❌ 删除了关闭图标引用
// import { IoMdClose } from "react-icons/io";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// ---------------- Audio Manager (保持不变) ----------------
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null, onEnded = null;
  const stop = () => { try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} if (onEnded) { onEnded(); onEnded = null; } };
  const playUrl = async (url, { onEnd = null } = {}) => { stop(); if (!url) return; try { const a = new Audio(url); a.preload = 'auto'; a.onended = () => { if (onEnd) onEnd(); if (audioEl === a) { audioEl = null; onEnded = null; } }; a.onerror = () => { if (onEnd) onEnd(); }; audioEl = a; onEnded = onEnd; await a.play().catch(()=>{}); } catch (e) { if (onEnd) onEnd(); } };
  const blobCache = new Map();
  const fetchToBlobUrl = async (url) => { try { if (blobCache.has(url)) return blobCache.get(url); const r = await fetch(url); const b = await r.blob(); const u = URL.createObjectURL(b); blobCache.set(url, u); return u; } catch (e) { return url; } };
  return { stop, playTTS: async (t, l='zh', r=0, cb=null) => { if (!t) { if (cb) cb(); return; } const v = ttsVoices[l]||ttsVoices.zh; const u = await fetchToBlobUrl(`https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`); return playUrl(u, { onEnd: cb }); }, playDing: () => { try { const A = window.AudioContext||window.webkitAudioContext; if(!A)return; const c=new A(),o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type='sine'; o.frequency.setValueAtTime(800,c.currentTime); o.frequency.exponentialRampToValueAtTime(400,c.currentTime+0.1); g.gain.setValueAtTime(0.3,c.currentTime); g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.1); o.start(c.currentTime); o.stop(c.currentTime+0.1); } catch(e){} } };
})();

// ---------------- Sub Components (保持不变) ----------------
// ... (此处省略子组件代码，复制时请保留你原来的 TeachingBlock, WordStudyBlock 等) ...
const TeachingBlock = ({ data, onComplete, settings }) => {
  useEffect(() => { if (data?.narrationScript && settings?.playTTS) { const timer = setTimeout(() => { settings.playTTS(data.narrationScript, data.narrationLang || 'my'); }, 600); return () => clearTimeout(timer); } }, [data, settings]);
  const handleManualPlay = (e) => { e.stopPropagation(); settings?.playTTS(data.displayText || data.narrationScript || '', 'zh'); };
  return ( <div className="w-full flex flex-col items-center animate-fade-in-up"> {data.pinyin && <p className="text-lg text-slate-500 font-medium mb-4">{data.pinyin}</p>} <div className="relative bg-white w-full rounded-[2rem] p-10 shadow-xl shadow-blue-100/50 border border-slate-100 flex flex-col items-center justify-center min-h-[220px] mb-8"> <h1 className="text-5xl md:text-6xl font-black text-slate-800 text-center tracking-tight leading-tight"> {data.displayText} </h1> <button onClick={handleManualPlay} className="absolute -bottom-7 bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-90 transition-transform"> <HiSpeakerWave className="text-2xl" /> </button> </div> {data.translation && ( <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-2xl border border-slate-200/60 shadow-sm mt-4"> <p className="text-xl text-slate-600 font-medium text-center leading-relaxed"> {data.translation} </p> </div> )} <div className="mt-auto w-full pt-10"> <button onClick={onComplete} className="w-full py-4 bg-slate-800 text-white font-bold text-lg rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"> 继续 <FaArrowRight /> </button> </div> </div> );
};
const WordStudyBlock = ({ data, onComplete, settings }) => ( <div className="w-full h-full flex flex-col"> <div className="text-center mb-6 shrink-0"> <h2 className="text-2xl font-bold text-slate-800">{data.title || "生词学习"}</h2> <p className="text-slate-400 text-sm mt-1">点击卡片听发音</p> </div> <div className="flex-1 overflow-y-auto pb-4 px-1" style={{ scrollbarWidth: 'none' }}> <div className="grid grid-cols-2 gap-4 pb-20"> {data.words?.map((word, i) => ( <button key={word.id || i} onClick={() => settings?.playTTS(word.chinese, 'zh', word.rate || 0)} className="flex flex-col items-center p-5 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-all hover:border-blue-300 hover:shadow-md"> <span className="text-xs text-slate-400 font-medium mb-1">{word.pinyin}</span> <span className="text-2xl font-bold text-slate-800 mb-2">{word.chinese}</span> <span className="text-sm text-slate-500 bg-slate-50 px-2 py-1 rounded-md w-full truncate text-center">{word.translation}</span> </button> ))} </div> </div> <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent"> <button onClick={onComplete} className="w-full py-3.5 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">我学会了</button> </div> </div> );
const CompletionBlock = ({ data, router }) => { useEffect(() => { audioManager?.playTTS(data.title || "恭喜", 'zh'); import('canvas-confetti').then(m => m.default({ particleCount: 150, spread: 70, origin: { y: 0.6 } })).catch(()=>{}); const timer = setTimeout(() => router.back(), 3000); return () => clearTimeout(timer); }, [data, router]); return (<div className="flex flex-col items-center justify-center h-full pb-20 animate-bounce-in"><div className="text-8xl mb-6 drop-shadow-md">🎉</div><h2 className="text-3xl font-black text-slate-800 mb-3">{data.title || "完成！"}</h2><p className="text-lg text-slate-500">{data.text || "即将返回..."}</p></div>); };
const UnknownBlockHandler = ({ type, onSkip }) => <div onClick={onSkip} className="text-center text-gray-400 mt-10">Unknown type: {type}</div>;

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

  // Sync Progress
  useEffect(() => {
    if (lesson?.id && hasMounted) {
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`);
      if (saved && parseInt(saved) < totalBlocks) setCurrentIndex(parseInt(saved));
    }
  }, [lesson, hasMounted, totalBlocks]);

  useEffect(() => {
    if (hasMounted && lesson?.id && currentIndex > 0) localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
    audioManager?.stop();
  }, [currentIndex, lesson?.id, hasMounted]);

  const goNext = useCallback(() => { audioManager?.stop(); audioManager?.playDing(); if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)); }, [currentIndex, totalBlocks]);
  const goPrev = useCallback(() => { audioManager?.stop(); audioManager?.playDing(); if (currentIndex > 0) setCurrentIndex(prev => Math.max(prev - 1, 0)); }, [currentIndex]);
  
  const delayedNextStep = useCallback(() => {
    import('canvas-confetti').then(m => m.default({ particleCount: 60, spread: 50, origin: { y: 0.7 } })).catch(()=>{});
    setTimeout(() => setCurrentIndex(prev => Math.min(prev + 1, totalBlocks)), 1200);
  }, [totalBlocks]);

  const handleJump = (e) => { e.preventDefault(); const p = parseInt(jumpValue); if (p >= 1 && p <= totalBlocks) setCurrentIndex(p - 1); setIsJumping(false); setJumpValue(''); };

  const renderBlock = () => {
    if (!currentBlock) return <div className="text-slate-400 mt-20">Loading...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    const props = { data: currentBlock.content, onCorrect: delayedNextStep, onComplete: goNext, onNext: goNext, settings: { playTTS: audioManager?.playTTS } };
    const CommonWrapper = ({ children }) => <div className="w-full bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 min-h-[50vh] flex flex-col justify-between">{children}</div>;

    try {
      switch (type) {
        case 'teaching': return <TeachingBlock {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'choice': return <CommonWrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} /></CommonWrapper>;
        case 'panduan': return <CommonWrapper><PanDuanTi {...props} /></CommonWrapper>;
        case 'lianxian': const pairsMap = props.data.pairs?.reduce((acc,p)=>{acc[p.id]=`${p.id}_b`;return acc},{})||{}; return <CommonWrapper><LianXianTi title={props.data.prompt} columnA={props.data.pairs?.map(p=>({id:p.id,content:p.left}))} columnB={props.data.pairs?.map(p=>({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={pairsMap} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'paixu': return <CommonWrapper><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...props.data.items].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'gaicuo': return <CommonWrapper><GaiCuoTi {...props} /></CommonWrapper>;
        case 'image_match_blanks': return <CommonWrapper><TianKongTi {...props.data} onCorrect={props.onNext} /></CommonWrapper>;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        case 'grammar_study': return <div className="h-[80vh] w-full"><GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} /></div>;
        case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (e) { return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />; }
  };

  if (!hasMounted) return null;

  return (
    // ✅ 1. 添加 overscroll-none 防止整个页面橡皮筋回弹
    // ✅ 2. touch-none 在非滚动区域禁止默认触摸行为 (如果内部不需要滚动)
    <div className="w-full h-full bg-slate-50 flex flex-col overflow-hidden font-sans relative overscroll-none">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 pointer-events-none" />

      {/* --- Top Bar: 极简模式，只有进度条 --- */}
      <div className="relative flex-none pt-[env(safe-area-inset-top)] px-4 py-3 z-20 flex items-center justify-between">
        {/* ❌ 删除了左上角关闭按钮 */}
        {/* ❌ 删除了右上角页码 */}
        
        {/* 进度条：加粗加高，视觉更清晰 */}
        {currentIndex < totalBlocks && (
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden mx-2">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="relative flex-1 w-full max-w-2xl mx-auto px-5 pt-[1vh] md:pt-[2vh] pb-32 overflow-y-auto overflow-x-hidden no-scrollbar z-10 overscroll-contain">
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* --- Bottom Bar: 大按钮 + 居中页码 --- */}
      <div className="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-6 py-4 pointer-events-none z-30">
        <div className="max-w-xl mx-auto flex justify-between items-center pointer-events-auto mb-4">
          
          {/* 左侧：上一题 (大尺寸) */}
          <button onClick={goPrev} 
            className={`w-16 h-16 rounded-2xl bg-white shadow-xl shadow-slate-200 border border-slate-100 text-slate-500 flex items-center justify-center transition-all active:scale-90 active:bg-slate-50 ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <FaChevronLeft className="text-xl" />
          </button>
          
          {/* 中间：页码 (点击可跳转) */}
          <button onClick={() => setIsJumping(true)} className="flex flex-col items-center justify-center px-4 py-2 rounded-xl active:bg-black/5 transition-colors">
            <span className="text-2xl font-black text-slate-300 tracking-widest font-mono">
              {currentIndex + 1}<span className="text-sm text-slate-200 mx-1">/</span>{totalBlocks}
            </span>
          </button>

          {/* 右侧：下一题 (大尺寸 + 强调色) */}
          <button onClick={goNext} 
            className={`w-16 h-16 rounded-2xl bg-white shadow-xl shadow-slate-200 border border-slate-100 text-slate-600 flex items-center justify-center transition-all active:scale-90 active:bg-slate-50 ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}
          >
             <FaChevronRight className="text-xl" />
          </button>

        </div>
      </div>

      {/* Jump Modal */}
      {isJumping && (
        <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72"><h3 className="text-center font-bold text-slate-800 mb-4">跳转至页面</h3><form onSubmit={handleJump}><input type="number" autoFocus value={jumpValue} onChange={e => setJumpValue(e.target.value)} placeholder={`1 - ${totalBlocks}`} className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 text-slate-800 bg-transparent" /><button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold active:scale-95 transition-transform">GO</button></form></div>
        </div>
      )}
    </div>
  );
}
