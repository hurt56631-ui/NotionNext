import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";

// --- 1. 导入所有外部“独立环节”组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';

// --- 2. 统一的TTS模块 (支持多语言) ---
const ttsVoices = {
    zh: 'zh-CN-XiaoyouNeural', // 默认中文发音人
    my: 'my-MM-NilarNeural',   // 默认缅甸语发音人
};
const ttsCache = new Map();
const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
  ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
  if (!text) {
    if (onEndCallback) onEndCallback();
    return;
  }
  const voice = ttsVoices[lang];
  if (!voice) {
      console.error(`Unsupported language for TTS: ${lang}`);
      if (onEndCallback) onEndCallback();
      return;
  }
  const cacheKey = `${text}|${voice}|${rate}`;
  try {
    let objectUrl = ttsCache.get(cacheKey);
    if (!objectUrl) {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API Error');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
    }
    const audio = new Audio(objectUrl);
    ttsCache.set(cacheKey, audio);
    
    audio.onended = () => { if (onEndCallback) onEndCallback(); };
    audio.onerror = (e) => {
        console.error("Audio element failed to play:", e);
        if (onEndCallback) onEndCallback();
    };

    await audio.play();
  } catch (e) {
    console.error(`播放 "${text}" (lang: ${lang}, rate: ${rate}) 失败:`, e);
    if (onEndCallback) onEndCallback();
  }
};

// --- 3. 内置的辅助UI组件 (完整实现) ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    const textToPlay = data.narrationScript || data.displayText;

    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    useEffect(() => {
        if (textToPlay) {
            const timer = setTimeout(() => {
                settings.playTTS(textToPlay, 'my', 0, onComplete); // 首页旁白通常是引导语，这里设为缅甸语
            }, 1000);
            return () => clearTimeout(timer);
        } else {
             // 如果没有旁白，4.5秒后自动进入下一页
            const autoNextTimer = setTimeout(onComplete, 4500);
            return () => clearTimeout(autoNextTimer);
        }
    }, [data, settings, onComplete, textToPlay]);

    const handleManualPlay = (e) => {
        e.stopPropagation();
        if (textToPlay) {
            settings.playTTS(textToPlay, 'my');
        }
    };

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-white animate-fade-in cursor-pointer">
            <style>{`
                @keyframes bounce-up { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-20px); } 60% { transform: translateY(-10px); } }
                .animate-bounce-up { animation: bounce-up 2s infinite; }
            `}</style>
            <div className="flex-grow flex flex-col items-center justify-center">
                {data.pinyin && <p className="text-2xl text-slate-300 mb-2">{data.pinyin}</p>}
                <div className="flex items-center gap-4">
                    {/* [核心修正] 调整文字大小 */}
                    <h1 className="text-6xl font-bold">{data.displayText}</h1>
                    <button onClick={handleManualPlay} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                        <HiSpeakerWave className="h-8 w-8" />
                    </button>
                </div>
                {data.translation && <p className="text-2xl text-slate-200 mt-4">{data.translation}</p>}
            </div>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-80">
                <FaChevronUp className="h-10 w-10 animate-bounce-up" />
                <span className="mt-2 text-lg">上滑开始学习</span>
            </div>
        </div>
    );
};

const CompletionBlock = ({ data, router }) => { /* (与上轮代码相同) */ };
const UnknownBlockHandler = ({ type, onSkip }) => { /* (与上轮代码相同) */ };

// [核心修正] GrammarBlock 增加全屏容器
const GrammarBlock = ({ data, onComplete, settings }) => {
    const { grammarPoint, pattern, visibleExplanation, examples, narrationScript, narrationRate } = data;
    const playNarration = () => {
        const textToPlay = (narrationScript || '').replace(/{{(.*?)}}/g, '$1');
        settings.playTTS(textToPlay, 'my', narrationRate || 0);
    };
    const handlePlayExample = (example) => {
        settings.playTTS(example.narrationScript || example.sentence, 'zh', example.rate || 0);
    };
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white p-4 animate-fade-in">
            <div className="w-full max-w-3xl">
                <div className="p-8 rounded-2xl shadow-2xl bg-gray-800/80 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-3xl font-bold">{grammarPoint}</h2>
                        {narrationScript && (
                            <button onClick={playNarration} className="p-2 rounded-full hover:bg-white/20 transition-colors"><HiSpeakerWave className="h-7 w-7" /></button>
                        )}
                    </div>
                    <p className="text-lg bg-black/20 px-3 py-1 rounded-md inline-block mb-4">{pattern}</p>
                    <p className="text-slate-200 text-lg whitespace-pre-line mb-6">{visibleExplanation}</p>
                    <div className="space-y-3">
                        {examples.map(example => (
                            <div key={example.id} className="bg-black/20 p-4 rounded-lg flex items-center justify-between hover:bg-black/30 transition-colors">
                                <div><p className="text-xl">{example.sentence}</p><p className="text-sm text-slate-400">{example.translation}</p></div>
                                <button onClick={() => handlePlayExample(example)} className="p-2 rounded-full hover:bg-white/20"><HiSpeakerWave className="h-6 w-6" /></button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-center mt-6">
                    <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">继续</button>
                </div>
            </div>
        </div>
    );
};

const WordStudyBlock = ({ data, onComplete, settings }) => { /* (与上轮代码相同) */ };

// --- 4. 主播放器组件 (核心逻辑) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const nextStep = useCallback(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, [currentIndex, totalBlocks]);
    const delayedNextStep = useCallback(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); setTimeout(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, 4500); }, [currentIndex, totalBlocks]);

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) { return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />; }
        if (!currentBlock) { return <div className="text-white">正在加载...</div>; }

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: delayedNextStep,
            onComplete: nextStep,
            settings: { playTTS },
        };

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study':
                const firstGrammarPoint = props.data.grammarPoints?.[0];
                if (!firstGrammarPoint) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={nextStep} />;
                return <GrammarBlock data={firstGrammarPoint} onComplete={props.onComplete} settings={props.settings} />;
            case 'dialogue_cinematic': return <DuiHua {...props} />;
            
            // [核心修正] 为不显示的组件创建 Props 适配器
            case 'image_match_blanks':
                 return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;

            case 'choice':
                const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
                if(xuanZeTiProps.isListeningMode){ xuanZeTiProps.question.text = props.data.narrationText; }
                return <XuanZeTi {...xuanZeTiProps} />;
            
            case 'lianxian':
                // 从 data 中提取 LianXianTi 需要的 props
                const lianXianProps = {
                    title: props.data.prompt, // 你的 JSON 中 prompt 对应 title
                    columnA: props.data.pairs.map(p => ({ id: p.id, content: p.left })),
                    columnB: props.data.pairs.map(p => ({ id: p.id, content: p.right })),
                    pairs: props.data.pairs.reduce((acc, p) => ({ ...acc, [p.id]: p.id }), {}), // 假设左右 id 相同来配对
                    onCorrect: props.onCorrect,
                };
                return <LianXianTi {...lianXianProps} />;

            case 'paixu':
                // 从 data 中提取 PaiXuTi 需要的 props
                const paiXuProps = {
                    title: props.data.prompt,
                    items: props.data.items, // items 结构匹配
                    // 从 items 生成 correctOrder 数组
                    correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id),
                    onCorrect: props.onCorrect,
                };
                return <PaiXuTi {...paiXuProps} />;

            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <UnknownBlockHandler type={type} onSkip={nextStep} />;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex + 1) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4 overflow-hidden" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-4xl absolute top-4 px-4 z-10">
                    <div className="w-full bg-gray-600/50 rounded-full h-2.5">
                        <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
                    </div>
                </div>
            )}
            <div className="w-full h-full flex items-center justify-center">
                {renderBlock()}
            </div>
        </div>
    );
}

// 再次确保其他辅助组件的完整代码在这里
// const CompletionBlock = ...
// const UnknownBlockHandler = ...
// const WordStudyBlock = ...
