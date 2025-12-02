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

// --- 新引入的学习卡片组件 ---
// ⚠️ 请确保这些文件路径正确，如果不在上一级目录，请修改路径
import WordCard from '../WordCard';
import PhraseCard from '../PhraseCard';

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

// ---------------- 子组件适配器 ----------------

// 适配器：将 interactive lesson 的数据格式转换为 WordCard 需要的格式
const WordCardAdapter = ({ data, onComplete }) => {
  // 假设 data.words 是数组，我们渲染列表
  return (
    <div className="w-full h-full overflow-y-auto pb-20">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || "生词学习"}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {data.words?.map((word, i) => (
          <WordCard 
            key={i} 
            word={word} // 传递单个单词数据
            onPlay={() => audioManager.playTTS(word.chinese)}
          />
        ))}
      </div>
      <button onClick={onComplete} className="w-full mt-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95">
        我学会了
      </button>
    </div>
  );
};

// 适配器：将数据转换为 PhraseCard 需要的格式
const PhraseCardAdapter = ({ data, onComplete }) => {
  return (
    <div className="w-full h-full overflow-y-auto pb-20">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || "短句学习"}</h2>
      </div>
      <div className="flex flex-col gap-4">
        {data.words?.map((phrase, i) => (
          // 复用 WordCard 结构，或者使用 PhraseCard
          <PhraseCard 
            key={i} 
            phrase={phrase} 
            onPlay={() => audioManager.playTTS(phrase.chinese)}
          />
        ))}
      </div>
      <button onClick={onComplete} className="w-full mt-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95">
        我学会了
      </button>
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
  <div onClick={onSkip} className="text-center text-gray-400 p-10 border-2 border-dashed rounded-xl">
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
    
    const props = { 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, 
      onNext: goNext, 
      settings: { playTTS: audioManager?.playTTS } 
    };
    
    // 通用容器
    const CommonWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col items-center justify-center pt-4">
        {children}
      </div>
    );

    try {
      switch (type) {
        // ✅ 替换为新的组件适配器
        case 'word_study': return <WordCardAdapter {...props} />;
        
        // 如果你的数据里把短句也叫 word_study 但有区别，或者叫 phrase_study
        case 'phrase_study': return <PhraseCardAdapter {...props} />; 

        // ✅ 语法组件：给它一个撑满的高度，并且去掉 CommonWrapper 的强制居中，让它自己布局
        case 'grammar_study': 
          return (
            <div className="w-full h-full flex flex-col">
               <GrammarPointPlayer 
                  grammarPoints={props.data.grammarPoints} 
                  onComplete={props.onComplete} 
               />
            </div>
          );

        // 题型组件
        case 'choice': return <CommonWrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} /></CommonWrapper>;
        case 'panduan': return <CommonWrapper><PanDuanTi {...props} /></CommonWrapper>;
        case 'lianxian': const pairsMap = props.data.pairs?.reduce((acc,p)=>{acc[p.id]=`${p.id}_b`;return acc},{})||{}; return <CommonWrapper><LianXianTi title={props.data.prompt} columnA={props.data.pairs?.map(p=>({id:p.id,content:p.left}))} columnB={props.data.pairs?.map(p=>({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={pairsMap} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'paixu': return <CommonWrapper><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...props.data.items].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={props.onCorrect} /></CommonWrapper>;
        case 'gaicuo': return <CommonWrapper><GaiCuoTi {...props} /></CommonWrapper>;
        case 'image_match_blanks': return <CommonWrapper><TianKongTi {...props.data} onCorrect={props.onNext} /></CommonWrapper>;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        
        case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
        
        // 忽略 teaching 类型，如果遇到直接显示 Unknown 或者自动跳过
        case 'teaching': 
             // 如果想直接跳过教学页：
             // useEffect(() => { goNext(); }, []); return null;
             // 如果想显示但简化：
             return <div onClick={goNext} className="p-8 text-2xl font-bold text-center">{props.data.displayText}</div>;

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

      {/* 主内容区 */}
      <main 
        className="relative flex-1 w-full max-w-xl mx-auto flex flex-col z-10 px-4 pb-32 overflow-y-auto overscroll-contain"
        style={{ touchAction: 'pan-y' }}
      >
        {/* 
            关键修改：
            去掉 justify-center，改用 min-h-full 让内容自然排列。
            这样语法组件（通常很高）就不会被挤压或者不显示。
        */}
        <div className="flex-1 flex flex-col min-h-full">
           {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
        </div>
      </main>

      {/* 底部导航 */}
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
