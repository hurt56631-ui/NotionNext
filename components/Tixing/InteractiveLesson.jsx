// components/Tixing/InteractiveLesson.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 外部题型组件（保持你现有接口） ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// ---------------- 全局音频管理器（单实例 + 运行时叮音） ----------------
const ttsVoices = {
  zh: 'zh-CN-XiaoyouNeural',
  my: 'my-MM-NilarNeural',
};

const audioManager = (() => {
  let audioEl = null;            // HTMLAudioElement for TTS / generic audio
  let currentUrl = null;
  let onEnded = null;

  const stop = () => {
    try {
      if (audioEl) {
        audioEl.pause();
        // release src to stop lingering fetch/playback
        try { audioEl.src = ''; } catch (_) {}
        audioEl = null;
        currentUrl = null;
      }
    } catch (e) {
      console.warn('audioManager.stop error', e);
    }
    if (typeof onEnded === 'function') {
      onEnded(); // notify if needed
      onEnded = null;
    }
  };

  const playUrl = async (url, { onEnd = null } = {}) => {
    stop();
    if (!url) return;
    try {
      const a = new Audio(url);
      a.preload = 'auto';
      a.onended = () => {
        if (onEnd) onEnd();
        if (audioEl === a) {
          audioEl = null;
          currentUrl = null;
          onEnded = null;
        }
      };
      a.onerror = (e) => {
        console.error('Audio playback error', e);
        // Try to gracefully stop
        try { a.pause(); a.src = ''; } catch (_) {}
        if (onEnd) onEnd();
        audioEl = null;
        currentUrl = null;
        onEnded = null;
      };
      audioEl = a;
      currentUrl = url;
      onEnded = onEnd;
      await a.play().catch(err => {
        // autoplay / user gesture issues - just log
        console.warn('Audio play() rejected:', err);
      });
    } catch (e) {
      console.error('playUrl failed', e);
      if (onEnd) onEnd();
    }
  };

  // Lightweight in-memory cache for fetched blob URLs to avoid re-fetch
  const blobCache = new Map();
  const fetchToBlobUrl = async (url) => {
    try {
      if (blobCache.has(url)) return blobCache.get(url);
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobCache.set(url, blobUrl);
      return blobUrl;
    } catch (e) {
      console.warn('fetchToBlobUrl failed, fallback to original url', e);
      return url;
    }
  };

  return {
    stop,
    playTTS: async (text, lang = 'zh', rate = 0, onEnd = null) => {
      if (!text) { if (onEnd) onEnd(); return; }
      const voice = ttsVoices[lang] || ttsVoices.zh;
      const rawUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
      const url = await fetchToBlobUrl(rawUrl);
      return playUrl(url, { onEnd });
    },
    // play an arbitrary URL (pre-fetched)
    playUrl: (url, opts) => playUrl(url, opts),
    // runtime-generated "ding" sound using WebAudio (no file needed)
    playDing: (() => {
      // keep a single AudioContext
      let ac = null;
      return (opts = {}) => {
        try {
          if (!ac) {
            ac = new (window.AudioContext || window.webkitAudioContext)();
          }
          const now = ac.currentTime;
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = opts.type || 'sine';
          osc.frequency.setValueAtTime(opts.freq || 880, now); // frequency
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.001);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.start(now);
          osc.stop(now + 0.26);
          // cleanup handled by GC; no reference kept
        } catch (e) {
          // fallback: tiny Audio beep using dataURL
          try {
            const fallback = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
            fallback.play().catch(() => {});
          } catch (err) {
            // ignore
          }
        }
      };
    })()
  };
})();

// ---------------- 内置 UI Blocks（无需手势，按钮触发） ----------------

const TeachingBlock = ({ data, onComplete, settings }) => {
  const autoplayTimerRef = useRef(null);
  useEffect(() => {
    // 自动播读（短延迟）
    if (data?.narrationScript) {
      autoplayTimerRef.current = setTimeout(() => {
        settings.playTTS(data.narrationScript, data.narrationLang || 'my');
      }, 900);
    }
    return () => {
      clearTimeout(autoplayTimerRef.current);
    };
  }, [data, settings]);

  const handleManualPlay = (e) => {
    e.stopPropagation();
    settings.playTTS(data.displayText || data.narrationScript || '', 'zh');
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-black/60 rounded-2xl p-8 text-center text-white shadow-xl">
        {data.pinyin && <p className="text-xl text-slate-300 mb-2">{data.pinyin}</p>}
        <div className="flex items-center justify-center gap-4">
          <h1 className="text-5xl md:text-6xl font-bold">{data.displayText}</h1>
          <button onClick={handleManualPlay} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="播放">
            <HiSpeakerWave className="h-8 w-8 md:h-9 md:w-9" />
          </button>
        </div>
        {data.translation && <p className="text-lg text-slate-200 mt-4 leading-relaxed">{data.translation}</p>}
        <div className="mt-8">
          <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold rounded-full shadow hover:scale-105 transition-transform">
            继续
          </button>
        </div>
      </div>
    </div>
  );
};

const WordStudyBlock = ({ data, onComplete, settings }) => {
  const handlePlayWord = (word) => {
    settings.playTTS(word.chinese, 'zh', word.rate || 0);
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-black/60 rounded-2xl p-6 text-white shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold">{data.title || "生词学习"}</h2>
          <p className="text-slate-300 mt-1">点击生词听发音，或使用底部按钮切换</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {data.words?.map(word => (
            <button
              key={word.id}
              onClick={() => handlePlayWord(word)}
              className="w-40 p-4 rounded-lg shadow-md transition-transform transform bg-slate-700 hover:bg-slate-600 hover:-translate-y-1 focus:outline-none text-center"
            >
              <div className="text-sm text-slate-300">{word.pinyin}</div>
              <div className="text-2xl font-semibold mt-1">{word.chinese}</div>
              <div className="text-base text-yellow-300 mt-2">{word.translation}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold rounded-full shadow hover:scale-105 transition-transform">
            继续
          </button>
        </div>
      </div>
    </div>
  );
};

const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    const textToPlay = data.title || "恭喜";
    audioManager.playTTS(textToPlay, 'zh').catch(()=>{});
    try {
      import('canvas-confetti').then(module => { module.default({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); }).catch(()=>{});
    } catch (e) {}
    const timer = setTimeout(() => router.push('/'), 4000);
    return () => clearTimeout(timer);
  }, [data, router]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="text-center text-white">
        <h1 className="text-7xl mb-4">🎉</h1>
        <h2 className="text-4xl font-bold mb-4">{data.title || "ဂုဏ်ယူပါတယ်။"}</h2>
        <p className="text-xl">{data.text || "သင်ခန်းစာပြီးဆုံးပါပြီ。 正在返回主页..."}</p>
      </div>
    </div>
  );
};

const UnknownBlockHandler = ({ type, onSkip }) => {
  useEffect(() => {
    console.error(`不支持的组件类型或渲染失败: "${type}", 将在1.2秒后自动跳过。`);
    const timer = setTimeout(onSkip, 1200);
    return () => clearTimeout(timer);
  }, [type, onSkip]);
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-red-400 text-xl font-bold bg-black/50 p-4 rounded-lg">错误：不支持的题型 ({type})</div>
    </div>
  );
};

// ---------------- 主播放器组件 ----------------
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  const currentBlock = blocks[currentIndex];

  // timers / refs
  const choiceAutoTimerRef = useRef(null);

  // persist lesson metadata
  useEffect(() => {
    if (lesson?.id) {
      try { localStorage.setItem(`lesson-cache-${lesson.id}`, JSON.stringify(lesson)); } catch(e){ console.warn(e); }
    }
  }, [lesson]);

  // restore progress
  useEffect(() => {
    if (lesson?.id) {
      const saved = localStorage.getItem(`lesson-progress-${lesson.id}`);
      if (saved) {
        const si = parseInt(saved, 10);
        if (!isNaN(si) && si > 0 && si < totalBlocks) setCurrentIndex(si);
      }
    }
  }, [lesson?.id, totalBlocks]);

  // save progress
  useEffect(() => {
    if (lesson?.id) {
      if (currentIndex > 0 && currentIndex < totalBlocks) localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
      else localStorage.removeItem(`lesson-progress-${lesson.id}`);
    }
  }, [currentIndex, lesson?.id, totalBlocks]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      // stop any playing audio
      audioManager.stop();
      if (choiceAutoTimerRef.current) clearTimeout(choiceAutoTimerRef.current);
    };
  }, []);

  // stop audio whenever index changes (defensive)
  useEffect(() => {
    audioManager.stop();
    if (choiceAutoTimerRef.current) {
      clearTimeout(choiceAutoTimerRef.current);
      choiceAutoTimerRef.current = null;
    }
    // If the block is a 'choice' and has narrationText, schedule its playback
    if (currentBlock && currentBlock.type === 'choice' && currentBlock.content?.narrationText) {
      choiceAutoTimerRef.current = setTimeout(() => {
        audioManager.playTTS(currentBlock.content.narrationText, 'zh').catch(()=>{});
      }, 400);
    }
  }, [currentIndex, currentBlock]);

  // keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, totalBlocks]);

  // next / prev
  const goNext = useCallback(() => {
    audioManager.stop();
    audioManager.playDing(); // subtle click
    setCurrentIndex(prev => {
      const next = Math.min(prev + 1, totalBlocks);
      return next;
    });
  }, [totalBlocks]);

  const goPrev = useCallback(() => {
    audioManager.stop();
    audioManager.playDing();
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // delayed next (for correctness/confetti)
  const delayedNextStep = useCallback(() => {
    try {
      import('canvas-confetti').then(m => { m.default({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }).catch(()=>{});
    } catch(e){}
    setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
    }, 1400); // shorten delay for snappier UX (was 4500)
  }, [totalBlocks]);

  const handleJump = (e) => {
    e?.preventDefault();
    const pageNum = parseInt(jumpValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalBlocks) {
      setCurrentIndex(pageNum - 1);
    }
    setIsJumping(false);
    setJumpValue('');
  };

  // render block dispatcher
  const renderBlock = () => {
    if (currentIndex >= totalBlocks) {
      return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
    }
    if (!currentBlock) return <div className="text-white">正在加载...</div>;

    const type = (currentBlock.type || '').toLowerCase();
    const props = { data: currentBlock.content, onCorrect: delayedNextStep, onComplete: goNext, settings: { playTTS: audioManager.playTTS } };

    try {
      switch (type) {
        case 'teaching': return <TeachingBlock {...props} />;
        case 'grammar_study':
          if (!props.data?.grammarPoints?.length) return <UnknownBlockHandler type="grammar_study (数据为空)" onSkip={goNext} />;
          // GrammarPointPlayer 内部如使用 Howler，建议那边也 stop；我们已在切换点调用 audioManager.stop()
          return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
        case 'choice': {
          const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
          if (xuanZeTiProps.data?.narrationText) { xuanZeTiProps.isListeningMode = true; xuanZeTiProps.question.text = props.data.prompt; }
          return <XuanZeTi {...xuanZeTiProps} />;
        }
        case 'lianxian': {
          if (!props.data.pairs?.length) return <UnknownBlockHandler type="lianxian (no pairs data)" onSkip={goNext} />;
          const columnA = props.data.pairs.map(p => ({ id: p.id, content: p.left }));
          const columnB_temp = props.data.pairs.map(p => ({ id: `${p.id}_b`, content: p.right }));
          const columnB = [...columnB_temp].sort(() => Math.random() - 0.5);
          const correctPairsMap = props.data.pairs.reduce((acc, p) => { acc[p.id] = `${p.id}_b`; return acc; }, {});
          return <LianXianTi title={props.data.prompt} columnA={columnA} columnB={columnB} pairs={correctPairsMap} onCorrect={props.onCorrect} />;
        }
        case 'paixu': {
          if (!props.data.items) return <UnknownBlockHandler type="paixu (no items)" onSkip={goNext} />;
          const paiXuProps = { title: props.data.prompt, items: props.data.items, correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id), onCorrect: props.onCorrect, onComplete: props.onComplete, settings: props.settings };
          return <PaiXuTi {...paiXuProps} />;
        }
        case 'panduan': return <PanDuanTi {...props} />;
        case 'gaicuo': return <GaiCuoTi {...props} />;
        case 'complete':
        case 'end': return <CompletionBlock data={props.data} router={router} />;
        default: return <UnknownBlockHandler type={type} onSkip={goNext} />;
      }
    } catch (error) {
      console.error(`渲染环节 "${type}" 时发生错误:`, error);
      return <UnknownBlockHandler type={`${type} (渲染失败)`} onSkip={goNext} />;
    }
  };

  // layout: true full-screen using safe viewport units (svh/dvh) - plus Tailwind classes
  // use inline style height to ensure svh/dvh used even if Tailwind config lacks it
  return (
    <div
      className="fixed inset-0 w-full bg-fixed bg-center flex flex-col"
      style={{
        // pure color background as you requested
        background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)',
        // full safe viewport height (double insurance)
        minHeight: '100svh',
        height: '100dvh',
      }}
    >
      {/* 顶部进度条 */}
      {currentIndex < totalBlocks && (
        <div className="fixed top-4 left-4 right-4 z-40 pointer-events-auto">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gray-600/30 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-1.5 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, ((currentIndex + 1) / Math.max(totalBlocks, 1)) * 100))}%`, transition: 'width 0.35s ease' }}
                aria-hidden
              />
            </div>
          </div>
          <div
            className="absolute top-[-6px] right-0 px-3 py-1 bg-black/40 text-white text-sm rounded-full cursor-pointer whitespace-nowrap"
            onClick={() => setIsJumping(true)}
          >
            {currentIndex + 1} / {totalBlocks}
          </div>
        </div>
      )}

      {/* 跳转 Modal */}
      {isJumping && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setIsJumping(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-gray-800 p-6 rounded-lg shadow-xl relative w-80">
            <h3 className="text-white text-lg mb-4">跳转到第几页？ (1-{totalBlocks})</h3>
            <form onSubmit={handleJump}>
              <input
                type="number"
                autoFocus
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                className="w-full px-4 py-2 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </form>
            <button onClick={() => setIsJumping(false)} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"><IoMdClose size={24} /></button>
          </div>
        </div>
      )}

      {/* 主内容：垂直居中、真全屏 */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="w-full h-full max-w-6xl max-h-[94vh] flex items-center justify-center">
            {renderBlock()}
          </div>
        </div>
      </main>

      {/* 底部左右按钮 */}
      <div className="fixed bottom-6 left-6 right-6 pointer-events-none z-30">
        <div className="max-w-6xl mx-auto relative">
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={currentIndex <= 0}
            className={`pointer-events-auto absolute left-0 bottom-0 p-3 rounded-full shadow-xl flex items-center gap-2 ${currentIndex <= 0 ? 'opacity-40 cursor-not-allowed' : 'bg-white/90 hover:scale-105'}`}
            aria-label="上一题"
          >
            <FaChevronLeft className="h-5 w-5 text-slate-800" />
            <span className="hidden md:inline text-slate-800 font-semibold">上一题</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={currentIndex >= totalBlocks}
            className={`pointer-events-auto absolute right-0 bottom-0 p-3 rounded-full shadow-xl flex items-center gap-2 ${currentIndex >= totalBlocks ? 'opacity-40 cursor-not-allowed' : 'bg-white/90 hover:scale-105'}`}
            aria-label="下一题"
          >
            <span className="hidden md:inline text-slate-800 font-semibold">下一题</span>
            <FaChevronRight className="h-5 w-5 text-slate-800" />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-1 text-sm text-white/90 bg-black/30 px-3 py-1 rounded-full">
            {currentIndex + 1} / {totalBlocks}
          </div>
        </div>
      </div>
    </div>
  );
}
