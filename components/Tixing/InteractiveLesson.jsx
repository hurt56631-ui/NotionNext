// components/Tixing/InteractiveLesson.jsx (最终完整版 - 解决 React Error #310)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 1. 动态导入所有题型组件 (请确保这些文件都存在于 './' 目录下) ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import GrammarPointPlayer from './GrammarPointPlayer';
import QuizPlayer from './QuizPlayer'; // 确保 QuizPlayer 也被导入

// --- 2. 统一的TTS模块 ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  if (!text) return;
  const cacheKey = `${text}|${voice}`;
  try {
    let objectUrl = ttsCache.get(cacheKey);
    if (!objectUrl) {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API Error');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      ttsCache.set(cacheKey, objectUrl);
    }
    new Audio(objectUrl).play();
  } catch (e) { console.error(`播放 "${text}" (${voice}) 失败:`, e); }
};

// --- 3. 内置的辅助UI组件 ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    const handleStart = () => {
        if (data.narrationText) {
            playTTS(data.narrationText, settings.chineseVoice);
        }
        setTimeout(onComplete, 800);
    };

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
            {data.pinyin && <p className="text-3xl text-slate-300 mb-2">{data.pinyin}</p>}
            <h1 className="text-7xl font-bold mb-4">{data.displayText}</h1>
            {data.translation && <p className="text-3xl text-slate-200">{data.translation}</p>}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <button onClick={handleStart} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                    စတင်လေ့လာမည် (Start)
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


// --- 4. 主播放器组件 (核心逻辑) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
            // 使用 < totalBlocks 而不是 <= totalBlocks-1 来确保能到达完成页
            if (currentIndex < totalBlocks) { 
                setCurrentIndex(prev => prev + 1);
            }
        }, 1200);
    }, [currentIndex, totalBlocks]);

    // 用于安全地跳过未知组件的特殊组件
    const UnknownBlockHandler = ({ type }) => {
        // [核心修复] 将状态更新逻辑放在 useEffect 中，这才是安全的方式
        useEffect(() => {
            console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
            // 调用 handleCorrect 来进入下一页
            handleCorrect();
        }, []); // 空依赖数组确保这个 effect 只运行一次

        return <div className="text-white text-xl font-bold">正在加载下一题...</div>;
    };


    const renderBlock = () => {
        // 如果索引超出或等于总数，显示完成页面
        if (currentIndex >= totalBlocks) {
            const lastBlockData = blocks[totalBlocks-1]?.content || {};
            return <CompletionBlock data={lastBlockData} router={router} />;
        }
        if (!currentBlock) {
            return <div className="text-white">正在加载...</div>;
        }

        const type = currentBlock.type.toLowerCase();
        
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: handleCorrect, // 统一完成信号
            settings: { ...settings, playTTS },
        };

        switch (type) {
            case 'teaching': 
                return <TeachingBlock {...props} />;
            
            case 'grammar_study':
                if (!props.data || !props.data.grammarPoints || props.data.grammarPoints.length === 0) {
                    return <UnknownBlockHandler type="grammar_study (no data)" />;
                }
                return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;

            case 'practice_session':
                if (!props.data || !props.data.questions || props.data.questions.length === 0) {
                    return <UnknownBlockHandler type="practice_session (no data)" />;
                }
                return <QuizPlayer {...props} />;
            
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
            
            case 'lianxian': return <LianXianTi {...props} />;
            case 'paixu': return <PaiXuTi {...props} />;
            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
            case 'dialogue_cinematic': return <DuiHua {...props} />;
                
            case 'complete': case 'end': 
                return <CompletionBlock data={props.data} router={router} />;

            default:
                // [核心修复] 使用一个安全的组件来处理未知类型，而不是直接调用 useEffect
                return <UnknownBlockHandler type={type} />;
        }
    };

    const progress = totalBlocks > 0 ? (currentIndex / totalBlocks) * 100 : 0;

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
