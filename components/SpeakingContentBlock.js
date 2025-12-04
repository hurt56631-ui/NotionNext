import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router'; 
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronRight, FaFacebook, FaTelegram, FaTiktok, FaLink, FaShareAlt, FaAngleUp, FaAngleDown } from "react-icons/fa";
import confetti from 'canvas-confetti';

// --- 1. 外部题型组件 (路径已修正：指向 Tixing 文件夹) ---
import XuanZeTi from './Tixing/XuanZeTi';
import PanDuanTi from './Tixing/PanDuanTi';
import PaiXuTi from './Tixing/PaiXuTi';
import LianXianTi from './Tixing/LianXianTi';
import GaiCuoTi from './Tixing/GaiCuoTi';
import DuiHua from './Tixing/DuiHua';
import TianKongTi from './Tixing/TianKongTi';
import GrammarPointPlayer from './Tixing/GrammarPointPlayer';

// --- 2. 学习卡片 (假设在当前 components 目录下，如果报错请改为 '../WordCard') ---
import WordCard from './WordCard';   
import PhraseCard from './PhraseCard'; 

// ---------------- Audio Manager (优化：语速变慢 -20%) ----------------
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };

const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null, onEnded = null;
  
  const stop = () => { 
    try { if (audioEl) { audioEl.pause(); audioEl = null; } } catch (e) {} 
    if (onEnded) { onEnded(); onEnded = null; } 
  };

  const playUrl = async (url, { onEnd = null } = {}) => { 
    stop(); 
    if (!url) return; 
    try { 
      const a = new Audio(url); 
      a.volume = 1.0; 
      a.preload = 'auto'; 
      a.onended = () => { if (onEnd) onEnd(); if (audioEl === a) { audioEl = null; onEnded = null; } }; 
      a.onerror = () => { if (onEnd) onEnd(); }; 
      audioEl = a; 
      onEnded = onEnd; 
      await a.play().catch(()=>{}); 
    } catch (e) { if (onEnd) onEnd(); } 
  };

  const blobCache = new Map();
  const fetchToBlobUrl = async (url) => { 
    try { 
      if (blobCache.has(url)) return blobCache.get(url); 
      const r = await fetch(url); 
      const b = await r.blob(); 
      const u = URL.createObjectURL(b); 
      blobCache.set(url, u); 
      return u; 
    } catch (e) { return url; } 
  };

  return { 
    stop, 
    // 修改：r='-20%' 降低语速，适合初学者
    playTTS: async (t, l='zh', r='-20%', cb=null) => { 
      if (!t) { if (cb) cb(); return; } 
      const v = ttsVoices[l]||ttsVoices.zh; 
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(t)}&v=${v}&r=${r}`;
      const u = await fetchToBlobUrl(url); 
      return playUrl(u, { onEnd: cb }); 
    }, 
    playDing: () => { try { new Audio('/sounds/click.mp3').play().catch(()=>{}); } catch(e){} } 
  };
})();

// ---------------- 3. 分享组件 ----------------
const ShareSheet = ({ isOpen, onClose, textToShare }) => {
  if (!isOpen) return null;
  
  const handleShare = (platform) => {
    const url = window.location.href;
    const text = textToShare || "快来跟我一起学中文！🇨🇳🇲🇲";
    let shareUrl = "";

    switch (platform) {
      case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
      case 'telegram': shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`; break;
      case 'tiktok': alert("TikTok အက်ပ်ကိုဖွင့်ပြီး မျှဝေပါ။"); return; 
      case 'copy': 
        navigator.clipboard.writeText(`${text} ${url}`);
        alert("လင့်ခ်ကို ကူးယူပြီးပါပြီ။"); 
        onClose();
        return;
    }
    if (shareUrl) window.open(shareUrl, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-6">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>
        <h3 className="text-center text-lg font-bold text-gray-700 font-padauk">သူငယ်ချင်းများနှင့် မျှဝေရန်</h3>
        <div className="grid grid-cols-4 gap-4 mt-6">
          <ShareBtn icon={<FaFacebook className="text-blue-600 text-3xl" />} label="Facebook" onClick={() => handleShare('facebook')} />
          <ShareBtn icon={<FaTelegram className="text-sky-500 text-3xl" />} label="Telegram" onClick={() => handleShare('telegram')} />
          <ShareBtn icon={<FaTiktok className="text-black text-3xl" />} label="TikTok" onClick={() => handleShare('tiktok')} />
          <ShareBtn icon={<FaLink className="text-gray-600 text-3xl" />} label="မိတ္တူကူးရန်" onClick={() => handleShare('copy')} />
        </div>
      </div>
    </div>
  );
};

const ShareBtn = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center shadow-sm border border-gray-100">
      {icon}
    </div>
    <span className="text-xs text-gray-500 font-padauk">{label}</span>
  </button>
);

// ---------------- 4. 美化后的卡片组件 ----------------

// 单词卡片
const BeautifulWordCard = ({ item, onPlay }) => {
  return (
    <div 
      onClick={onPlay}
      className="relative bg-white rounded-2xl p-4 shadow-md border border-slate-100 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all duration-200 hover:shadow-lg h-48"
    >
      {/* 拼音 */}
      <span className="text-xs font-medium text-slate-400 font-mono">{item.pinyin || ''}</span>
      
      {/* 中文大字 */}
      <h3 className="text-4xl font-black text-slate-800 tracking-wider mb-1">{item.word || item.chinese}</h3>
      
      {/* 缅文谐音 (模拟发音) */}
      {item.burmese_sound && (
        <div className="px-3 py-1 bg-orange-50 rounded-full text-orange-600 text-xs font-bold font-padauk border border-orange-100 shadow-sm">
          🔊 {item.burmese_sound}
        </div>
      )}

      {/* 缅文释义 */}
      <p className="text-sm font-bold text-slate-600 font-padauk text-center line-clamp-2 mt-2">
        {item.translation || item.burmese || "အဓိပ္ပာယ်"}
      </p>

      {/* 播放图标 */}
      <div className="absolute top-2 right-2 text-blue-400 opacity-20">
        <HiSpeakerWave size={20} />
      </div>
    </div>
  );
};

// 短句卡片
const BeautifulPhraseCard = ({ item, onPlay }) => {
  return (
    <div 
      onClick={onPlay}
      className="group relative bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3 active:scale-[0.98] transition-all duration-200 hover:shadow-md"
    >
      <div className="flex justify-between items-start">
        {/* 拼音 */}
        <span className="text-xs font-medium text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">{item.pinyin || ''}</span>
        <HiSpeakerWave className="text-blue-500 animate-pulse-slow" size={20} />
      </div>

      {/* 中文句子 */}
      <h3 className="text-xl font-bold text-slate-800 leading-relaxed">
        {item.sentence || item.chinese}
      </h3>

      <div className="h-px w-full bg-slate-50"></div>

      <div className="flex flex-col gap-1">
        {/* 缅文谐音 */}
        {item.burmese_sound && (
            <span className="text-xs text-orange-600 font-padauk font-semibold mb-1">
              [{item.burmese_sound}]
            </span>
        )}
        {/* 缅文翻译 */}
        <p className="text-base font-bold text-slate-600 font-padauk">
          {item.translation || item.burmese}
        </p>
      </div>
    </div>
  );
};

// ---------------- 5. 列表容器适配器 ----------------
const CardListRenderer = ({ data, type, onComplete }) => {
  const isPhrase = type === 'phrase_study' || type === 'sentences';
  const list = data.words || data.sentences || [];
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const headerRef = useRef(null);
  
  return (
    <div className="w-full h-full flex flex-col relative bg-slate-50">
      {/* 顶部标题栏 */}
      <div 
        ref={headerRef}
        className={`flex-none w-full bg-white z-20 transition-all duration-300 shadow-sm rounded-b-3xl relative overflow-hidden ${isHeaderCollapsed ? 'h-12' : 'h-auto py-6'}`}
      >
        <div 
          onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          className="absolute bottom-0 left-0 right-0 h-8 flex items-center justify-center cursor-pointer active:bg-slate-50"
        >
          {isHeaderCollapsed ? <FaAngleDown className="text-slate-300" /> : <FaAngleUp className="text-slate-300" />}
        </div>

        <div className={`px-6 text-center transition-opacity duration-200 ${isHeaderCollapsed ? 'opacity-0' : 'opacity-100'}`}>
          <h2 className="text-2xl font-black text-slate-800 font-padauk">
            {data.title || (isPhrase ? "အသုံးများသော စကားစုများ" : "မရှိမဖြစ် ဝေါဟာရ")}
          </h2>
          <p className="text-slate-400 text-xs mt-2 font-padauk">
            စုစုပေါင်း {list.length} ခု • ကဒ်ကိုနှိပ်ပြီး လိုက်ဖတ်ပါ
          </p>
        </div>
      </div>

      {/* 列表区 */}
      <div className="flex-1 w-full overflow-y-auto px-4 pt-4 pb-32 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className={`grid gap-4 ${isPhrase ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {list.map((item, i) => (
            isPhrase ? (
              <BeautifulPhraseCard 
                key={item.id || i} 
                item={item} 
                onPlay={() => audioManager.playTTS(item.sentence || item.chinese)}
              />
            ) : (
              <BeautifulWordCard 
                key={item.id || i} 
                item={item}
                onPlay={() => audioManager.playTTS(item.word || item.chinese)}
              />
            )
          ))}
        </div>
      </div>
      
      {/* 底部按钮 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent z-20 pointer-events-none flex justify-between items-end">
        <button 
          onClick={onComplete} 
          className="pointer-events-auto flex-1 py-4 bg-blue-600 text-white font-bold text-lg rounded-full shadow-xl shadow-blue-200 active:scale-95 transition-all font-padauk mr-4"
        >
          လေ့လာပြီးပါပြီ (我学会了)
        </button>

        <button 
          onClick={() => setShareOpen(true)}
          className="pointer-events-auto w-14 h-14 bg-white text-blue-600 rounded-full shadow-lg border border-blue-50 flex items-center justify-center active:scale-90 transition-all"
        >
          <FaShareAlt size={20} />
        </button>
      </div>

      <ShareSheet isOpen={shareOpen} onClose={() => setShareOpen(false)} textToShare={data.title} />
    </div>
  );
};

// ... CompletionBlock & UnknownBlockHandler ...
const CompletionBlock = ({ data, router }) => { useEffect(() => { audioManager?.playTTS("恭喜完成", 'zh'); setTimeout(() => router.back(), 2500); }, [router]); return <div className="flex flex-col items-center justify-center h-full animate-bounce-in"><div className="text-8xl mb-6">🎉</div><h2 className="text-3xl font-black text-slate-800">{data.title||"完成！"}</h2></div>; };
const UnknownBlockHandler = ({ type, onSkip }) => <div onClick={onSkip} className="flex flex-col items-center justify-center h-full text-gray-400"><p>未知题型: {type}</p><button className="mt-4 text-blue-500 underline">点击跳过</button></div>;


// ---------------- 6. 主组件 ----------------

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
  
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`); 
      if (saved) {
        const savedIndex = parseInt(saved);
        if (savedIndex < totalBlocks) {
          setCurrentIndex(savedIndex); 
        } else {
          setCurrentIndex(0); 
          localStorage.removeItem(`lesson-progress-${lesson.id}`);
        }
      }
    } 
  }, [lesson, hasMounted, totalBlocks]);

  useEffect(() => { if (hasMounted && lesson?.id && currentIndex > 0) localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString()); audioManager?.stop(); }, [currentIndex, lesson?.id, hasMounted]);

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

  const type = currentBlock?.type?.toLowerCase();
  const hideBottomNav = ['word_study', 'phrase_study', 'sentences', 'grammar_study', 'teaching', 'complete', 'end'].includes(type);
  const hideTopProgressBar = [
    'grammar_study', 
    'choice', 
    'panduan', 
    'lianxian', 
    'paixu', 
    'gaicuo', 
    'image_match_blanks', 
    'dialogue_cinematic', 
    'complete', 
    'end'
  ].includes(type);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans select-none" style={{ touchAction: 'none' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&display=swap');
        .font-padauk { font-family: 'Padauk', sans-serif; }
        ::-webkit-scrollbar { display: none; } 
        * { -webkit-tap-highlight-color: transparent; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      
      {/* 顶部进度条 */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] px-4 py-3 z-30 pointer-events-none">
        {!hideTopProgressBar && currentIndex < totalBlocks && (
          <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden mx-4 backdrop-blur-sm">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
          </div>
        )}
      </div>

      <main className="relative w-full h-full flex flex-col z-10 overflow-hidden">
        {currentIndex >= totalBlocks ? <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} /> : renderBlock()}
      </main>

      {/* 底部导航 (练习题时显示) */}
      {!hideBottomNav && currentIndex < totalBlocks && (
        <div className="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] px-8 py-4 z-30 flex justify-between items-center pointer-events-none">
            {/* 隐藏左侧返回箭头，只留占位 */}
            <div className="w-12 h-12"></div>
            
            <button onClick={() => setIsJumping(true)} className="pointer-events-auto px-4 py-2 rounded-xl active:bg-black/5 transition-colors">
              <span className="text-xs font-bold text-slate-400">{currentIndex + 1} / {totalBlocks}</span>
            </button>

            <button onClick={goNext} className={`pointer-events-auto w-12 h-12 rounded-full bg-white/80 shadow-sm text-slate-400 flex items-center justify-center backdrop-blur-md ${currentIndex >= totalBlocks ? 'opacity-0' : 'opacity-100'}`}><FaChevronRight /></button>
        </div>
      )}
      
      {/* 跳转弹窗 */}
      {isJumping && <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsJumping(false)}><div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-2xl shadow-2xl w-72"><form onSubmit={handleJump}><input type="number" autoFocus value={jumpValue} onChange={e => setJumpValue(e.target.value)} className="w-full text-center text-2xl font-bold border-b-2 border-slate-200 outline-none py-2" /><button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-xl font-bold">GO</button></form></div></div>}
    </div>
  );
}
