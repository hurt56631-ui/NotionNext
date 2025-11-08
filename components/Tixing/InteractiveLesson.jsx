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
// [重要] GrammarPointPlayer 组件已不再需要，被彻底移除

// --- 2. 统一的TTS模块 ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  // 播放新音频前，停止所有正在播放的音频
  ttsCache.forEach(cachedAudio => {
    if (cachedAudio && !cachedAudio.paused) {
      cachedAudio.pause();
      cachedAudio.currentTime = 0;
    }
  });

  if (!text) return;
  const cacheKey = `${text}|${voice}`;
  try {
    let objectUrl = ttsCache.get(cacheKey);
    if (!objectUrl) {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API Error');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
    }
    const audio = new Audio(objectUrl);
    ttsCache.set(cacheKey, audio);
    await audio.play();
  } catch (e) { console.error(`播放 "${text}" (${voice}) 失败:`, e); }
};

// --- 3. 内置的辅助UI组件 (完整实现) ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    // [核心修正] 增加 useEffect 来处理自动播放
    useEffect(() => {
        const textToPlay = data.narrationScript || data.displayText;
        if (textToPlay) {
            // 延迟一点播放，给页面加载和动画留出时间
            const timer = setTimeout(() => {
                settings.playTTS(textToPlay, settings.chineseVoice);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [data, settings]); // 依赖 data, 确保内容变化时能重新触发

    const handleContinue = () => {
        // 点击按钮时，立即进入下一个环节
        onComplete();
    };

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

// --- 4. 主播放器组件 (核心逻辑) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const nextStep = useCallback(() => {
        // 不再使用 confetti，因为 Continue 按钮是即时响应的
        if (currentIndex < totalBlocks) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, totalBlocks]);

    // 对于需要延迟的完成（如答题正确后）
    const delayedNextStep = useCallback(() => {
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
            onCorrect: delayedNextStep, // 答对题，延迟跳转
            onComplete: nextStep,       // 点击 Continue 或对话结束，立即跳转
            settings: { ...settings, playTTS },
        };

        switch (type) {
            case 'teaching': 
                return <TeachingBlock {...props} />;
            
            case 'dialogue_cinematic': 
                return <DuiHua {...props} />;
            
            case 'image_match_blanks':
                 const tianKongTiProps = { ...props.data, onCorrect: props.onCorrect, onNext: props.onCorrect }; // onNext 也用延迟
                 return <TianKongTi {...tianKongTiProps} />;

            case 'choice':
                const xuanZeTiProps = {
                    question: { text: props.data.prompt, ...props.data },
                    options: props.data.choices || [],
                    correctAnswer: props.data.correctId ? [props.data.correctId] : [],
                    explanation: props.data.explanation,
                    onCorrect: props.onCorrect,
                    onNext: props.onCorrect,
                    isListeningMode: !!props.data.narrationText,
                };
                if(xuanZeTiProps.isListeningMode){
                   xuanZeTiProps.question.text = props.data.narrationText;
                }
                return <XuanZeTi {...xuanZeTiProps} />;
            
            case 'lianxian': return <LianXianTi onComplete={props.onCorrect} {...props} />; // 连线题完成也应该延迟
            case 'paixu': return <PaiXuTi onComplete={props.onCorrect} {...props} />; // 排序题完成也应该延迟
            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
                
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
