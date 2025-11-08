// components/Tixing/InteractiveLesson.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 1. 导入所有“独立环节”组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 统一的TTS模块 ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  if (!text) return;
  const cacheKey = `${text}|${voice}`;
  try {
    // 停止当前所有正在播放的音频
    ttsCache.forEach(cachedAudio => {
        if (cachedAudio && !cachedAudio.paused) {
            cachedAudio.pause();
            cachedAudio.currentTime = 0;
        }
    });

    let objectUrl = ttsCache.get(cacheKey);
    if (!objectUrl) {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API Error');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
    }
    const audio = new Audio(objectUrl);
    ttsCache.set(cacheKey, audio); // 将 audio 对象存入缓存，以便后续控制
    await audio.play();
  } catch (e) { console.error(`播放 "${text}" (${voice}) 失败:`, e); }
};

// --- 3. 内置的辅助UI组件 (完整实现) ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    const handleStart = () => {
        const textToPlay = data.narrationScript || data.displayText;
        if (textToPlay) {
            settings.playTTS(textToPlay, settings.chineseVoice);
        }
        setTimeout(onComplete, 1200);
    };

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
            {data.pinyin && <p className="text-3xl text-slate-300 mb-2">{data.pinyin}</p>}
            <h1 className="text-7xl font-bold mb-4">{data.displayText}</h1>
            {data.translation && <p className="text-3xl text-slate-200">{data.translation}</p>}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <button onClick={handleStart} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                    စတင်လေ့လာမည်
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
        const timer = setTimeout(() => {
            onSkip();
        }, 1200);
        return () => clearTimeout(timer);
    }, [type, onSkip]);

    return <div className="text-white text-xl font-bold">不支持的题型，正在加载下一题...</div>;
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
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
            if (currentIndex < totalBlocks) {
                setCurrentIndex(prev => prev + 1);
            }
        }, 1200);
    }, [currentIndex, totalBlocks]);


    const renderBlock = () => {
        if (currentIndex >= totalBlocks) {
            const lastBlockData = blocks[totalBlocks - 1]?.content || {};
            return <CompletionBlock data={lastBlockData} router={router} />;
        }
        if (!currentBlock) {
            return <div className="text-white">正在加载...</div>;
        }

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: nextStep,
            onComplete: nextStep, // 统一完成信号
            settings: { ...settings, playTTS },
        };

        switch (type) {
            // --- 教学环节 ---
            case 'teaching': 
                return <TeachingBlock {...props} />;

            case 'grammar_study': 
                return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} settings={props.settings}/>;
            
            case 'dialogue_cinematic': 
                return <DuiHua data={props.data} onComplete={props.onComplete} settings={props.settings} />;
            
            // --- 独立练习题环节 (不再有 practice_session) ---
            case 'image_match_blanks':
                 const tianKongTiProps = { ...props.data, onCorrect: props.onCorrect, onNext: props.onComplete };
                 return <TianKongTi {...tianKongTiProps} />;

            case 'choice':
                const xuanZeTiProps = {
                    question: { text: props.data.prompt, ...props.data },
                    options: props.data.choices || [],
                    correctAnswer: props.data.correctId ? [props.data.correctId] : [],
                    explanation: props.data.explanation,
                    onCorrect: props.onCorrect,
                    onNext: props.onComplete, // [重要] 确保 onNext 指向 onComplete
                    isListeningMode: !!props.data.narrationText,
                };
                if(xuanZeTiProps.isListeningMode){
                   xuanZeTiProps.question.text = props.data.narrationText;
                }
                return <XuanZeTi {...xuanZeTiProps} />;
            
            case 'lianxian': return <LianXianTi {...props} />;
            case 'paixu': return <PaiXuTi {...props} />;
            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
                
            // --- 结束环节 ---
            case 'complete': case 'end':
                return <CompletionBlock data={props.data} router={router} />;

            default:
                return <UnknownBlockHandler type={type} onSkip={nextStep} />;
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
