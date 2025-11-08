import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { SpeakerWaveIcon } from '@heroicons/react/24/solid'; // 引入图标

// --- 1. 导入所有“独立环节”组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
// [重要] WordCard.js 和 GrammarPointPlayer.jsx 已不再需要

// --- 2. 统一的TTS模块 ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural', rate = 0) => {
  ttsCache.forEach(a => { if (a && !a.paused) { a.pause(); a.currentTime = 0; } });
  if (!text) return;
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
    await audio.play();
  } catch (e) { console.error(`播放 "${text}" (${voice}, rate: ${rate}) 失败:`, e); }
};

// --- 3. 内置的辅助UI组件 (完整实现) ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    useEffect(() => {
        const textToPlay = data.narrationScript || data.displayText;
        if (textToPlay) {
            const timer = setTimeout(() => {
                settings.playTTS(textToPlay, settings.chineseVoice);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [data, settings]);

    const handleContinue = () => { onComplete(); };

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
            {data.pinyin && <p className="text-3xl text-slate-300 mb-2">{data.pinyin}</p>}
            <h1 className="text-7xl font-bold mb-4">{data.displayText}</h1>
            {data.translation && <p className="text-3xl text-slate-200">{data.translation}</p>}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <button onClick={handleContinue} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                    ဆက်လက်လုပ်ဆောင်ရန် (Continue)
                </button>
            </div>
        </div>
    );
};

const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        const textToPlay = data.title || "恭喜";
        playTTS(textToPlay);
        const timer = setTimeout(() => router.push('/'), 5000);
        return () => clearTimeout(timer);
    }, [data, router]);

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
            <h1 className="text-7xl mb-4">🎉</h1>
            <h2 className="text-4xl font-bold mb-4">{data.title || "ဂုဏ်ယူပါတယ်။"}</h2>
            <p className="text-xl">{data.text || "သင်ခန်းစာပြီးဆုံးပါပြီ။ ပင်မစာမျက်နှာသို့ ပြန်သွားနေသည်..."}</p>
        </div>
    );
};

const UnknownBlockHandler = ({ type, onSkip }) => {
    useEffect(() => {
        console.warn(`不支持的组件类型: "${type}", 将在1.2秒后自动跳过。`);
        const timer = setTimeout(onSkip, 1200);
        return () => clearTimeout(timer);
    }, [type, onSkip]);
    return <div className="text-white text-xl font-bold">不支持的题型，正在加载下一题...</div>;
};

const GrammarBlock = ({ data, onComplete, settings }) => {
    const { grammarPoint, pattern, visibleExplanation, examples, narrationScript, narrationRate } = data;
    const playNarration = () => {
        const textToPlay = (narrationScript || '').replace(/{{(.*?)}}/g, '$1');
        settings.playTTS(textToPlay, settings.chineseVoice, narrationRate || 0);
    };
    const handlePlayExample = (example) => {
        settings.playTTS(example.narrationScript || example.sentence, settings.chineseVoice, example.rate || 0);
    };
    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col justify-center text-white p-4 animate-fade-in">
            <div className="p-8 rounded-2xl shadow-2xl bg-gray-800/80 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-3xl font-bold">{grammarPoint}</h2>
                    {narrationScript && (
                        <button onClick={playNarration} className="p-2 rounded-full hover:bg-white/20 transition-colors"><SpeakerWaveIcon className="h-7 w-7" /></button>
                    )}
                </div>
                <p className="text-lg bg-black/20 px-3 py-1 rounded-md inline-block mb-4">{pattern}</p>
                <p className="text-slate-200 text-lg whitespace-pre-line mb-6">{visibleExplanation}</p>
                <div className="space-y-3">
                    {examples.map(example => (
                        <div key={example.id} className="bg-black/20 p-4 rounded-lg flex items-center justify-between hover:bg-black/30 transition-colors">
                            <div><p className="text-xl">{example.sentence}</p><p className="text-sm text-slate-400">{example.translation}</p></div>
                            <button onClick={() => handlePlayExample(example)} className="p-2 rounded-full hover:bg-white/20"><SpeakerWaveIcon className="h-6 w-6" /></button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-center mt-6">
                <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">继续</button>
            </div>
        </div>
    );
};

// [新增] 内置的生词学习组件
const WordStudyBlock = ({ data, onComplete, settings }) => {
    const { title, words } = data;

    const handlePlayWord = (word) => {
        settings.playTTS(word.chinese, settings.chineseVoice, word.rate || 0);
    };

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col text-white p-4 animate-fade-in">
            <h2 className="text-4xl font-bold text-center mb-6">{title || "生词"}</h2>
            <div className="bg-gray-800/70 backdrop-blur-md rounded-2xl p-4 flex-grow overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                    {words.map((word) => (
                        <div key={word.id} className="bg-black/20 p-4 rounded-lg flex items-center justify-between hover:bg-black/30 transition-colors">
                            <div className="flex-1">
                                <p className="text-sm text-slate-400 mb-1">{word.pinyin}</p>
                                <p className="text-2xl font-semibold">{word.chinese}</p>
                                <p className="text-lg text-yellow-300 mt-1">{word.translation}</p>
                            </div>
                            <button onClick={() => handlePlayWord(word)} className="ml-4 p-3 rounded-full hover:bg-white/20">
                                <SpeakerWaveIcon className="h-7 w-7" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex justify-center mt-6">
                <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                    我学会了
                </button>
            </div>
        </div>
    );
};


// --- 4. 主播放器组件 (核心逻辑) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const nextStep = useCallback(() => {
        if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); }
    }, [currentIndex, totalBlocks]);

    const delayedNextStep = useCallback(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
            if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); }
        }, 1200);
    }, [currentIndex, totalBlocks]);

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) {
            const lastBlockData = blocks[totalBlocks - 1]?.content || {};
            return <CompletionBlock data={lastBlockData} router={router} />;
        }
        if (!currentBlock) { return <div className="text-white">正在加载...</div>; }

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: delayedNextStep,
            onComplete: nextStep,
            settings: { ...settings, playTTS },
        };

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            
            // [新增] 使用新的“生词学习”环节
            case 'word_study': return <WordStudyBlock {...props} />;

            case 'grammar_study':
                const firstGrammarPoint = props.data.grammarPoints?.[0];
                if (!firstGrammarPoint) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={nextStep} />;
                return <GrammarBlock data={firstGrammarPoint} onComplete={props.onComplete} settings={props.settings} />;

            case 'dialogue_cinematic': return <DuiHua {...props} />;
            
            case 'image_match_blanks':
                 const tianKongTiProps = { ...props.data, onCorrect: props.onCorrect, onNext: props.onCorrect };
                 return <TianKongTi {...tianKongTiProps} />;
            
            case 'choice':
                const xuanZeTiProps = { question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], explanation: props.data.explanation, onCorrect: props.onCorrect, onNext: props.onCorrect, isListeningMode: !!props.data.narrationText, };
                if(xuanZeTiProps.isListeningMode){ xuanZeTiProps.question.text = props.data.narrationText; }
                return <XuanZeTi {...xuanZeTiProps} />;
            
            case 'lianxian': return <LianXianTi onComplete={props.onCorrect} {...props} />;
            case 'paixu': return <PaiXuTi onComplete={props.onCorrect} {...props} />;
            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            
            default: return <UnknownBlockHandler type={type} onSkip={nextStep} />;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex + 1) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
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
