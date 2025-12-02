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

// --- 2. 新引入的学习卡片 ---
// 确保这些组件存在且路径正确
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

// ---------------- 3. 列表容器适配器 (核心修复) ----------------
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  // 确保 list 是数组，如果 data.words 不存在，尝试取 data 本身（如果是数组）
  const list = Array.isArray(data.words) ? data.words : (Array.isArray(data) ? data : []);

  if (list.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
        <p>暂无{isPhrase ? "短句" : "生词"}数据</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      {/* 标题 */}
      <div className="flex-none pt-6 pb-4 px-4 text-center z-10 bg-slate-50">
        <h2 className="text-2xl font-black text-slate-800">
          {data.title || (isPhrase ? "常用短句" : "核心生词")}
        </h2>
        <p className="text-slate-400 text-xs mt-1">共 {list.length} 个 • 点击卡片跟读</p>
      </div>

      {/* 列表区 */}
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            isPhrase ? (
              <PhraseCard 
                key={item.id || i} 
                phrase={item} 
                data={item} // 兼容传递
                onPlay={() => audioManager.playTTS(item.sentence || item.chinese)}
              />
            ) : (
              <WordCard 
                key={item.id || i} 
                word={item}
                data={item} // 兼容传递
                onPlay={() => audioManager.playTTS(item.word || item.chinese)}
              />
            )
          ))}
        </div>
      </div>
      
      {/* 底部大按钮 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-20">
        <button 
          onClick={onComplete} 
          className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all"
        >
          我学会了
        </button>
      </div>
    </div>
  );
};

// ... 其他辅助组件保持不变 ...
const CompletionBlock = ({ data, router }) => { useEffect(() => { audioManager?.playTTS("恭喜完成", 'zh'); setTimeout(() => router.back(), 2500); }, [router]); return <div className="flex flex-col items-center justify-center h-full animate-bounce-in"><div className="text-8xl mb-6">🎉</div><h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2></div>; };
const UnknownBlockHandler = ({ type, onSkip }) => <div onClick={onSkip} className="flex flex-col items-center justify-center h-full text-gray-400"><p>未知题型: {type}</p><button className="mt-4 text-blue-500 underline">点击跳过</button></div>;


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

  // 自动跳过 Teaching
  useEffect(() => {
    if (currentBlock && currentBlock.type === 'teaching') {
      const timer = setTimeout(() => {
        if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
      }, 50); 
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentBlock, totalBlocks]);

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
    
    const CommonWrapper = ({ children }) => <div className="w-full h-full flex flex-col items-center justify-center pt-4">{children}</div>;
    const FullHeightWrapper = ({ children }) => <div className="w-full h-full flex flex-col">{children}</div>;

    try {
      switch (type) {
        case 'teaching': return null; 

        // ✅ 单词和短句使用 FullHeightWrapper + CardListRenderer
        case 'word_study': 
          return <FullHeightWrapper><CardListRenderer data={props.data} type="word_study" onComplete={props.onComplete} /></FullHeightWrapper>;
        
        case 'phrase_study': 
        case 'sentences':
          return <FullHeightWrapper><CardListRenderer data={props.data} type="phrase_study" onComplete={props.onComplete} /></FullHeightWrapper>;

        case 'grammar_study': 
          if (!props.data.grammarPoints?.length) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={goNext} />;
          return (
             <div className="w-full h-full relative">
                <GrammarPointPlayer 
                    grammarPoints={props.data.grammarPoints} 
                    onComplete={props.onComplete} 
                />
             </div>
          );

        // 题型
        case 'choice': return <CommonWrapper><XuanZeTi {...props} question={{text: props.data.prompt, ...props.data}} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} explanation={props.data.explanation} /></CommonWrapper>;
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

  const type = currentBlock?.type?.toLowerCase();
  const hideBottomNav = ['word_study', 'phrase_study', 'sentences', 'grammar_study', 'teaching', 'complete', 'end'].includes(type);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; }`}</style>
      
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-4 py-3 z-30 pointer-events-none">
        {currentIndex < totalBlocks && (
          <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden mx-4 backdrop-blur-sm">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      {/* 主内容区 */}
      <main className="relative w-full h-full flex flex-col z-10 overflow-hidden">
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* 底部导航 */}
      {!hideBottomNav && currentIndex < totalBlocks && (
        <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-8 py-4 z-30 flex justify-between items-center pointer-events-none">
            <button onClick={goPrev} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/80 shadow-sm text-slate-400 flex items-center justify-center backdrop-blur-md ${currentIndex === 0 ? 'opacity-0' : 'opacity-100'}`}><FaChevronLeft /></button>
            <button onClick={() => setIsJumping(true)} className="pointer-events-auto px-4 py-2 rounded-xl active:bg-black/5 transition-colors"><span className="text-xs font-bold text-slate-400">{currentIndex + 1} / {totalBlocks}</span></button>
            <button onClick={goNext} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/80 shadow-sm text-slate-400 flex items-center justify-center backdrop-blur-md ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}><FaChevronRight /></button>
        </div>
      )}
      
      {/* 跳转弹窗 */}
      {isJumping && <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}><div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72"><form onSubmit={handleJump}><input type="number" autoFocus value={jumpValue} onChange={e => setJumpValue(e.target.value)} className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 outline-none py-2" /><button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold">GO</button></form></div></div>}
    </div>
  );
}
