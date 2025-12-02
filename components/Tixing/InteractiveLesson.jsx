import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
// 语法组件 (你提供的那个全屏 Portal 组件)
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 单词与短句卡片 (请确保路径正确) ---
// 假设这些组件在 components 根目录下
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

// ---------------- 3. 单词/短句 列表容器适配器 ----------------
// 负责把 data.words 数组渲染成一排排的 Card
const CardListRenderer = ({ data, type, onComplete }) => {
  // 根据类型决定用什么卡片、几列布局
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  
  return (
    <div className="w-full h-full flex flex-col">
      {/* 标题区 */}
      <div className="text-center mb-6 shrink-0 pt-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          {data.title || (isPhrase ? "常用短句" : "核心生词")}
        </h2>
        <p className="text-slate-400 text-sm mt-2">点击卡片听发音</p>
      </div>

      {/* 列表区 (允许滚动) */}
      <div className="flex-1 w-full overflow-y-auto px-2 pb-24 no-scrollbar">
        {/* 短句单列，单词双列 */}
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {data.words?.map((item, i) => (
            isPhrase ? (
              // 短句卡片
              <PhraseCard 
                key={item.id || i} 
                phrase={item} // 传入完整对象
                data={item}   // 兼容某些写法
                onPlay={() => audioManager.playTTS(item.chinese)}
              />
            ) : (
              // 单词卡片
              <WordCard 
                key={item.id || i} 
                word={item}   // 传入完整对象
                data={item}   // 兼容某些写法
                onPlay={() => audioManager.playTTS(item.chinese)}
              />
            )
          ))}
        </div>
      </div>
      
      {/* 底部按钮 (固定) */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent z-20">
        <div className="max-w-xl mx-auto">
          <button 
            onClick={onComplete} 
            className="w-full py-4 bg-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all"
          >
            我学会了
          </button>
        </div>
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
    <div className="flex flex-col items-center justify-center h-full animate-bounce-in">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2>
    </div>
  );
};

const UnknownBlockHandler = ({ type, onSkip }) => (
  <div onClick={onSkip} className="flex flex-col items-center justify-center h-full text-gray-400">
    <p>未知题型: {type}</p>
    <button className="mt-4 text-blue-500 underline">点击跳过</button>
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
  
  // 进度恢复
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); 
      if (saved && parseInt(saved) < totalBlocks) setCurrentIndex(parseInt(saved)); 
    } 
  }, [lesson, hasMounted, totalBlocks]);
  
  // 进度保存 & 音频停止
  useEffect(() => { 
    if (hasMounted && lesson?.id && currentIndex > 0) localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString()); 
    audioManager?.stop(); 
  }, [currentIndex, lesson?.id, hasMounted]);

  // ✅ 自动跳过 Teaching 开头
  useEffect(() => {
    if (currentBlock && currentBlock.type === 'teaching') {
      // 这里的延时是为了防止 render 循环，确保跳转顺滑
      const timer = setTimeout(() => {
        if (currentIndex < totalBlocks) setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
      }, 100); 
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
    
    // 普通题型的居中容器
    const CommonWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col items-center justify-center pt-4">
        {children}
      </div>
    );

    // 列表类（单词/语法）的全高容器，不强制居中，允许顶部对齐
    const FullHeightWrapper = ({ children }) => (
      <div className="w-full h-full flex flex-col">
        {children}
      </div>
    );

    try {
      switch (type) {
        // ✅ 1. Teaching: 这里返回 null，配合上面的 useEffect 自动跳过
        case 'teaching': 
          return null; 

        // ✅ 2. 生词: 使用 CardListRenderer + WordCard
        case 'word_study': 
          return <FullHeightWrapper><CardListRenderer data={props.data} type="word_study" onComplete={props.onComplete} /></FullHeightWrapper>;
        
        // ✅ 3. 短句: 使用 CardListRenderer + PhraseCard (假设类型叫 phrase_study 或 sentences)
        case 'phrase_study': 
        case 'sentences':
          return <FullHeightWrapper><CardListRenderer data={props.data} type="phrase_study" onComplete={props.onComplete} /></FullHeightWrapper>;

        // ✅ 4. 语法: 你的组件本身就是全屏 Portal，这里只需要渲染它
        // 注意：这里不需要 Wrapper，因为它自己会 createPortal 到 body
        case 'grammar_study': 
          // 确保数据存在，否则显示错误
          if (!props.data.grammarPoints || props.data.grammarPoints.length === 0) {
             return <UnknownBlockHandler type="grammar_study (无数据)" onSkip={goNext} />;
          }
          return (
             <GrammarPointPlayer 
                grammarPoints={props.data.grammarPoints} 
                onComplete={props.onComplete} 
             />
          );

        // 题型
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
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; } .no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
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
        className="relative flex-1 w-full max-w-xl mx-auto flex flex-col z-10 px-4 pb-0 overflow-hidden" 
      >
        {/* 内容区域 */}
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* 底部导航 (只在非列表页显示，或者一直显示？列表页有自己的大按钮，这里可以隐藏或者保留翻页) */}
      {/* 这里的逻辑：如果是生词/语法页，通常不需要底部的左右翻页，因为它们有自己的流程。但保留也可以作为强制跳转 */}
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
