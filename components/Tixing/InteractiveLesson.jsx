import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 学习卡片 ---
import WordCard from '../WordCard';
import PhraseCard from '../PhraseCard';

// --- Audio Manager ---
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

// --- 首页封面组件 ---
const CoverBlock = ({ data, onStart }) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-900">
      {data.image && (
        <img 
          src={data.image} 
          className="absolute inset-0 w-full h-full object-cover opacity-80" 
          alt="cover" 
        />
      )}
      {/* 渐变遮罩确保文字清晰 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      
      <div className="relative z-10 text-center px-8 flex flex-col items-center">
        <h1 className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] mb-4 leading-tight">
          {data.title || "开始学习"}
        </h1>
        {data.description && (
          <p className="text-lg text-white/90 drop-shadow-md mb-12 max-w-xs">
            {data.description}
          </p>
        )}
        
        <button 
          onClick={onStart}
          className="group relative flex items-center justify-center"
        >
          <div className="absolute -inset-2 bg-blue-500 rounded-full blur opacity-30 group-active:opacity-10 transition duration-1000"></div>
          <div className="relative px-12 py-5 bg-blue-600 text-white font-black text-xl rounded-full shadow-2xl active:scale-95 transition-all flex items-center gap-2">
            点击开始学习
          </div>
        </button>
      </div>
    </div>
  );
};

// --- 列表容器适配器 ---
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || data.vocabulary || []; 

  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      <div className="flex-none pt-12 pb-4 px-4 text-center z-10 bg-slate-50">
        <h2 className="text-2xl font-black text-slate-800">
          {data.title || (isPhrase ? "常用短句" : "核心生词")}
        </h2>
        <p className="text-slate-400 text-xs mt-1">共 {list.length} 个 • 点击卡片跟读</p>
      </div>
      <div className="flex-1 w-full overflow-y-auto px-4 pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            isPhrase ? (
              <PhraseCard 
                key={item.id || i} 
                phrase={item} 
                data={item}
                onPlay={() => audioManager.playTTS(item.sentence || item.chinese)}
              />
            ) : (
              <WordCard 
                key={item.id || i} 
                word={item}
                data={item}
                onPlay={() => audioManager.playTTS(item.word || item.chinese)}
              />
            )
          ))}
        </div>
      </div>
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

// --- 完成块 ---
const CompletionBlock = ({ data, router }) => { 
  useEffect(() => { 
    audioManager?.playTTS("恭喜完成", 'zh'); 
    setTimeout(() => router.back(), 2500); 
  }, [router]); 
  return (
    <div className="flex flex-col items-center justify-center h-full animate-bounce-in bg-white">
      <div className="text-8xl mb-6">🎉</div>
      <h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2>
      <p className="text-slate-400 mt-2">正在返回课程列表...</p>
    </div>
  ); 
};

const UnknownBlockHandler = ({ type, onSkip }) => <div onClick={onSkip} className="flex flex-col items-center justify-center h-full text-gray-400"><p>未知题型: {type}</p><button className="mt-4 text-blue-500 underline">点击跳过</button></div>;

// 辅助函数
const shuffleArray = (array) => {
  const newArray = [...array]; 
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; 
  }
  return newArray;
};

// ---------------- 主组件 ----------------
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);
  
  // 1. 读取进度的逻辑
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); 
      if (saved) {
        const savedIndex = parseInt(saved, 10);
        if (savedIndex < totalBlocks) {
          setCurrentIndex(savedIndex); 
        } else {
          setCurrentIndex(0);
          localStorage.removeItem(`lesson-progress-${lesson.id}`);
        }
      }
    } 
  }, [lesson, hasMounted, totalBlocks]);

  // 2. 进度保存逻辑
  useEffect(() => { 
    if (hasMounted && lesson?.id) {
        const isFinished = currentIndex >= totalBlocks || 
                           ['complete', 'end'].includes(blocks[currentIndex]?.type);

        if (isFinished) {
            localStorage.removeItem(`lesson-progress-${lesson.id}`);
        } else {
            localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
        }
    }
    audioManager?.stop(); 
  }, [currentIndex, lesson?.id, hasMounted, totalBlocks, blocks]);

  // 自动跳过 Teaching (非封面性质的静默块)
  useEffect(() => {
    if (currentBlock && currentBlock.type === 'teaching' && !currentBlock.content?.image) {
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

  const renderBlock = () => {
    if (!currentBlock) return <div className="text-slate-400 mt-20">Loading...</div>;
    const type = (currentBlock.type || '').toLowerCase();
    
    const commonProps = { 
      key: `${lesson.id}-${currentIndex}`, 
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
        // 如果是封面(teaching 且含有图片)
        case 'teaching': 
          if (currentBlock.content?.image) {
            return <CoverBlock data={currentBlock.content} onStart={goNext} />;
          }
          return null; 

        case 'cover':
          return <CoverBlock data={currentBlock.content} onStart={goNext} />;

        case 'word_study': 
        case 'phrase_study': 
        case 'sentences':
          return <FullHeightWrapper><CardListRenderer {...commonProps} type={type} /></FullHeightWrapper>;

        case 'grammar_study': 
          if (!commonProps.data.grammarPoints?.length) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={goNext} />;
          return (
             <div className="w-full h-full relative">
                <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={commonProps.onComplete} />
             </div>
          );

        case 'choice': {
            const { correctId } = commonProps.data;
            const correctAnswer = Array.isArray(correctId) ? correctId : (correctId != null ? [correctId] : []);
            return <CommonWrapper><XuanZeTi {...commonProps} data={{...commonProps.data, correctAnswer}} /></CommonWrapper>;
        }
        case 'lianxian': {
            const columnA = commonProps.data.pairs?.map(p => ({ id: p.id, content: p.left })) || [];
            const columnB = commonProps.data.pairs?.map(p => ({ id: `${p.id}_b`, content: p.right })) || [];
            const shuffledColumnB = shuffleArray(columnB);
            const pairsMap = commonProps.data.pairs?.reduce((acc, p) => { acc[p.id] = `${p.id}_b`; return acc }, {}) || {};
            
            return <CommonWrapper><LianXianTi {...commonProps} data={{...commonProps.data, columnA, columnB: shuffledColumnB, pairs: pairsMap}} /></CommonWrapper>;
        }
        case 'paixu': {
            const correctOrder = [...(commonProps.data.items || [])].sort((a,b) => a.order - b.order).map(i => i.id);
            return <CommonWrapper><PaiXuTi {...commonProps} data={{...commonProps.data, correctOrder}} /></CommonWrapper>;
        }
        
        case 'panduan': return <CommonWrapper><PanDuanTi {...commonProps} /></CommonWrapper>;
        case 'gaicuo': return <CommonWrapper><GaiCuoTi {...commonProps} /></CommonWrapper>;
        case 'image_match_blanks': return <CommonWrapper><TianKongTi {...commonProps} /></CommonWrapper>;
        case 'dialogue_cinematic': return <DuiHua {...commonProps} />;
        
        case 'complete': case 'end': return <CompletionBlock data={commonProps.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (e) { 
        console.error("Error rendering block:", type, e);
        return <UnknownBlockHandler type={`${type} Error`} onSkip={goNext} />; 
    }
  };

  if (!hasMounted) return null;

  const type = currentBlock?.type?.toLowerCase();
  const isCover = (type === 'teaching' && currentBlock?.content?.image) || type === 'cover';

  // 导航显隐控制
  const hideBottomNav = ['word_study', 'phrase_study', 'sentences', 'complete', 'end'].includes(type) || isCover;
  const hideTopProgressBar = ['dialogue_cinematic', 'complete', 'end'].includes(type) || isCover;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; } * { -webkit-tap-highlight-color: transparent; }`}</style>
      
      {/* 顶部进度条 - 更细更灵动 */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] z-30 pointer-events-none">
        {!hideTopProgressBar && currentIndex < totalBlocks && (
          <div className="h-[3px] bg-slate-200/40 w-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out" 
              style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} 
            />
          </div>
        )}
      </div>

      <main className="relative w-full h-full flex flex-col z-10 overflow-hidden">
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* 底部导航按钮 - 位置上移，且不显示页码 */}
      {!hideBottomNav && currentIndex < totalBlocks && (
        <div className="absolute bottom-10 left-0 right-0 px-8 z-30 flex justify-between items-center pointer-events-none">
            <button 
              onClick={goPrev} 
              className={`pointer-events-auto w-14 h-14 rounded-full bg-white/90 shadow-lg text-slate-600 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${currentIndex === 0 ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
            >
              <FaChevronLeft size={20} />
            </button>
            
            {/* 中间留空，不再显示页码 */}
            <div className="flex-1" />

            <button 
              onClick={goNext} 
              className={`pointer-events-auto w-14 h-14 rounded-full bg-white/90 shadow-lg text-slate-600 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 ${currentIndex >= totalBlocks - 1 && (type === 'complete' || type === 'end') ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
            >
              <FaChevronRight size={20} />
            </button>
        </div>
      )}
    </div>
  );
}
