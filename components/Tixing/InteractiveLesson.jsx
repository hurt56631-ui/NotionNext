import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaArrowRight } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 新引入的学习卡片 (生词/短句) ---
// ⚠️ 请确保 components 目录下有这俩文件，如果没有请创建或修改路径
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

// ---------------- 3. 子组件适配器 (关键修复) ----------------

// 生词/短句 列表容器
const StudyListContainer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences'; // 判断是否为短句
  
  return (
    <div className="w-full h-full flex flex-col pb-24">
      {/* 标题 */}
      <div className="text-center mb-6 shrink-0 pt-4">
        <h2 className="text-2xl font-bold text-slate-800">{data.title || (isPhrase ? "常用短句" : "生词学习")}</h2>
        <p className="text-slate-400 text-sm mt-1">点击卡片听发音</p>
      </div>

      {/* 滚动列表区域 */}
      <div className="flex-1 w-full overflow-y-auto px-1" style={{ scrollbarWidth: 'none' }}>
        <div className={`grid gap-4 pb-10 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {data.words?.map((item, i) => (
            isPhrase ? (
              // 短句使用 PhraseCard
              <PhraseCard 
                key={i} 
                phrase={item} 
                onPlay={() => audioManager.playTTS(item.chinese)}
              />
            ) : (
              // 生词使用 WordCard
              <WordCard 
                key={i} 
                word={item} 
                onPlay={() => audioManager.playTTS(item.chinese)}
              />
            )
          ))}
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="mt-auto pt-4 w-full px-4">
        <button onClick={onComplete} className="w-full py-3.5 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
          我学会了
        </button>
      </div>
    </div>
  );
};

// 结束页
const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    audioManager?.playTTS("恭喜完成", 'zh');
    setTimeout(() => router.back(), 2500);
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center animate-bounce-in h-full">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2>
    </div>
  );
};

const UnknownBlockHandler = ({ type, onSkip }) => (
  <div onClick={onSkip} className="flex flex-col items-center justify-center h-full text-gray-400">
    <p>未知题型: {type}</p>
    <button className="mt-4 text-blue-500 underline">跳过</button>
  </div>
);

// ---------------- 4. 主组件 ----------------

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
    if (!currentBlock) return <div className="text-slate-400 mt-20">Loading...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    
    const props = { 
      data: currentBlock.content, 
      onCorrect: delayedNextStep, 
      onComplete: goNext, 
      onNext: goNext, 
      settings: { playTTS: audioManager?.playTTS } 
    };
    
    // 布局容器：根据题型决定是否居中
    // 语法和单词列表通常内容较长，需要 h-full 和顶部对齐
    // 选择题等需要居中对齐
    const isScrollableType = ['word_study', 'grammar_study', 'phrase_study'].includes(type);
    
    const Wrapper = ({ children }) => (
      <div className={`w-full h-full flex flex-col ${isScrollableType ? 'justify-start' : 'justify-center items-center'}`}>
        {children}
      </div>
    );

    try {
      switch (type) {
        // ✅ 1. 忽略 Teaching 开头，直接跳过 (或者你可以选择 return null)
        case 'teaching': 
          // 如果不想显示开头，直接返回 null，并自动跳到下一页（需小心死循环，这里建议显示但简化）
          // 或者把 Teaching 当作一个普通的展示页
          return (
             <div onClick={goNext} className="w-full h-full flex flex-col items-center justify-center p-8 text-center cursor-pointer">
               <h1 className="text-4xl font-bold mb-4">{props.data.displayText}</h1>
               <p className="text-slate-400 animate-pulse">点击开始学习</p>
             </div>
          );

        // ✅ 2. 生词/短句：使用新适配器
        case 'word_study': 
          return <Wrapper><StudyListContainer data={props.data} type="word_study" onComplete={props.onComplete} /></Wrapper>;
        
        case 'phrase_study': // 如果你的 JSON 里短句类型叫这个
          return <Wrapper><StudyListContainer data={props.data} type="phrase_study" onComplete={props.onComplete} /></Wrapper>;

        // ✅ 3. 语法：给足高度
        case 'grammar_study': 
          return (
            <div className="w-full h-full overflow-hidden flex flex-col">
               <GrammarPointPlayer 
                  grammarPoints={props.data.grammarPoints} 
                  onComplete={props.onComplete} 
               />
            </div>
          );

        // 题型
        case 'choice': return <Wrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} /></Wrapper>;
        case 'panduan': return <Wrapper><PanDuanTi {...props} /></Wrapper>;
        case 'lianxian': const pairsMap = props.data.pairs?.reduce((acc,p)=>{acc[p.id]=`${p.id}_b`;return acc},{})||{}; return <Wrapper><LianXianTi title={props.data.prompt} columnA={props.data.pairs?.map(p=>({id:p.id,content:p.left}))} columnB={props.data.pairs?.map(p=>({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={pairsMap} onCorrect={props.onCorrect} /></Wrapper>;
        case 'paixu': return <Wrapper><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...props.data.items].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={props.onCorrect} /></Wrapper>;
        case 'gaicuo': return <Wrapper><GaiCuoTi {...props} /></Wrapper>;
        case 'image_match_blanks': return <Wrapper><TianKongTi {...props.data} onCorrect={props.onNext} /></Wrapper>;
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

      {/* Top Bar */}
      <div className="relative flex-none pt-[env(safe-area-inset-top)] px-4 py-3 z-20">
        {currentIndex < totalBlocks && (
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mx-4">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main 
        className="relative flex-1 w-full max-w-xl mx-auto flex flex-col z-10 px-4 pb-32 overflow-hidden" 
      >
        {/* 内容区域 */}
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* Bottom Bar */}
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
