// components/Tixing/InteractiveLesson.jsx (优化版 — 按钮切换、全屏居中、移除手势)
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 外部题型组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 统一的TTS模块（保留你原先的实现风格） ---
const ttsVoices = {
  zh: 'zh-CN-XiaoyouNeural',
  my: 'my-MM-NilarNeural',
};
let currentAudio = null;
const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (!text) {
    if (onEndCallback) onEndCallback?.();
    return;
  }
  const voice = ttsVoices[lang];
  if (!voice) {
    console.error(`Unsupported language for TTS: ${lang}`);
    if (onEndCallback) onEndCallback();
    return;
  }
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
    const audio = new Audio(url);
    currentAudio = audio;
    const onEnd = () => {
      if (currentAudio === audio) currentAudio = null;
      if (onEndCallback) onEndCallback();
    };
    audio.onended = onEnd;
    audio.onerror = (e) => {
      console.error("Audio element failed to play:", e);
      onEnd();
    };
    await audio.play();
  } catch (e) {
    console.error(`播放 "${text}" (lang: ${lang}, rate: ${rate}) 失败:`, e);
    if (onEndCallback) onEndCallback();
  }
};
const stopAllAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
};

// ---------------- 内置 UI Block（无手势，按钮控制） ----------------

// TeachingBlock (居中、按钮继续)
const TeachingBlock = ({ data, onComplete, settings }) => {
  useEffect(() => {
    if (data?.narrationScript) {
      const timer = setTimeout(() => {
        settings.playTTS(data.narrationScript, data.narrationLang || 'my');
      }, 1200);
      return () => clearTimeout(timer);
    }
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

// WordStudyBlock (卡片式、按钮继续)
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

// CompletionBlock (4秒返回首页)
const CompletionBlock = ({ data, router }) => {
  useEffect(() => {
    const textToPlay = data.title || "恭喜";
    playTTS(textToPlay, 'zh');

    if (typeof window !== 'undefined') {
      import('canvas-confetti').then(module => {
        const confetti = module.default;
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }).catch(() => {});
    }

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const router = useRouter();
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  // 缓存课程元数据（仅一次）
  useEffect(() => {
    if (lesson && lesson.id) {
      const storageKey = `lesson-cache-${lesson.id}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(lesson));
      } catch (error) {
        console.error("缓存课程数据失败:", error);
      }
    }
  }, [lesson]);

  // 恢复进度
  useEffect(() => {
    if (lesson?.id) {
      const storageKey = `lesson-progress-${lesson.id}`;
      const savedProgress = localStorage.getItem(storageKey);
      if (savedProgress) {
        const savedIndex = parseInt(savedProgress, 10);
        if (!isNaN(savedIndex) && savedIndex > 0 && savedIndex < totalBlocks) {
          setCurrentIndex(savedIndex);
        }
      }
    }
  }, [lesson?.id, totalBlocks]);

  // 保存进度
  useEffect(() => {
    if (lesson?.id) {
      const storageKey = `lesson-progress-${lesson.id}`;
      if (currentIndex > 0 && currentIndex < totalBlocks) {
        localStorage.setItem(storageKey, currentIndex.toString());
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [currentIndex, lesson?.id, totalBlocks]);

  // 停音/切换时停止所有播放
  useEffect(() => { stopAllAudio(); }, [currentIndex]);

  // 如果是选择题并且自带 narrationText，开场播放
  useEffect(() => {
    if (currentBlock && currentBlock.type === 'choice' && currentBlock.content?.narrationText) {
      const timer = setTimeout(() => { playTTS(currentBlock.content.narrationText, 'zh'); }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentBlock]);

  // 键盘支持（左右键）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, totalBlocks]);

  // 下一题 / 上一题
  const goNext = useCallback(() => {
    stopAllAudio();
    if (currentIndex < totalBlocks) {
      setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
    }
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => {
    stopAllAudio();
    if (currentIndex > 0) setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, [currentIndex]);

  // 带延迟的下一步（用于展示奖励动画再跳转）
  const delayedNextStep = useCallback(() => {
    if (typeof window !== 'undefined') {
      import('canvas-confetti').then(module => {
        const confetti = module.default;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }).catch(() => {});
    }
    setTimeout(() => {
      setCurrentIndex(prev => Math.min(prev + 1, totalBlocks));
    }, 4500);
  }, [totalBlocks]);

  // 跳转表单处理
  const handleJump = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalBlocks) {
      setCurrentIndex(pageNum - 1);
    }
    setIsJumping(false);
    setJumpValue('');
  };

  // 渲染题块分发
  const renderBlock = () => {
    if (currentIndex >= totalBlocks) {
      return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
    }
    if (!currentBlock) return <div className="text-white">正在加载...</div>;

    const type = currentBlock.type.toLowerCase();
    const props = { data: currentBlock.content, onCorrect: delayedNextStep, onComplete: goNext, settings: { playTTS } };

    try {
      switch (type) {
        case 'teaching': return <TeachingBlock {...props} />;
        case 'grammar_study':
          if (!props.data?.grammarPoints?.length) return <UnknownBlockHandler type="grammar_study (数据为空)" onSkip={goNext} />;
          return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
        case 'dialogue_cinematic': return <DuiHua {...props} />;
        case 'word_study': return <WordStudyBlock {...props} />;
        case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
        case 'choice': {
          const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
          if (xuanZeTiProps.data.narrationText) { xuanZeTiProps.isListeningMode = true; xuanZeTiProps.question.text = props.data.prompt; }
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

  return (
    <div className="fixed inset-0 w-full h-screen bg-cover bg-fixed bg-center flex flex-col" style={{ backgroundImage: "url(/background.jpg)" }}>
      {/* 顶部进度条 */}
      {currentIndex < totalBlocks && (
        <div className="fixed top-4 left-4 right-4 z-30 pointer-events-auto">
          <div className="max-w-5xl mx-auto">
            <div className="bg-gray-600/50 rounded-full h-1.5">
              <div
                className="bg-blue-400 h-1.5 rounded-full"
                style={{ width: `${(currentIndex + 1) / Math.max(totalBlocks, 1) * 100}%`, transition: 'width 0.5s ease' }}
                aria-hidden
              />
            </div>
          </div>
          <div className="absolute top-[-6px] right-0 px-3 py-1 bg-black/30 text-white text-sm rounded-full cursor-pointer whitespace-nowrap" onClick={() => setIsJumping(true)}>
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
                className="w-full px-4 py-2 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
            <button onClick={() => setIsJumping(false)} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"><IoMdClose size={24} /></button>
          </div>
        </div>
      )}

      {/* 主内容区域：垂直居中、全屏 */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="w-full h-full max-w-6xl max-h-[92vh] flex items-center justify-center">
            {renderBlock()}
          </div>
        </div>
      </main>

      {/* 底部左右按钮（A 方案） */}
      <div className="fixed bottom-6 left-6 right-6 pointer-events-none">
        <div className="max-w-6xl mx-auto relative">
          {/* 左按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={currentIndex <= 0}
            className={`pointer-events-auto absolute left-0 bottom-0 p-3 rounded-full shadow-xl flex items-center gap-2 ${currentIndex <= 0 ? 'opacity-40 cursor-not-allowed' : 'bg-white/90 hover:scale-105'}`}
            aria-label="上一题"
          >
            <FaChevronLeft className="h-5 w-5 text-slate-800" />
            <span className="hidden md:inline text-slate-800 font-semibold">上一题</span>
          </button>

          {/* 右按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={currentIndex >= totalBlocks}
            className={`pointer-events-auto absolute right-0 bottom-0 p-3 rounded-full shadow-xl flex items-center gap-2 ${currentIndex >= totalBlocks ? 'opacity-40 cursor-not-allowed' : 'bg-white/90 hover:scale-105'}`}
            aria-label="下一题"
          >
            <span className="hidden md:inline text-slate-800 font-semibold">下一题</span>
            <FaChevronRight className="h-5 w-5 text-slate-800" />
          </button>

          {/* 中央提示（可选） */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-1 text-sm text-white/90 bg-black/30 px-3 py-1 rounded-full">
            {currentIndex + 1} / {totalBlocks}
          </div>
        </div>
      </div>
    </div>
  );
}
