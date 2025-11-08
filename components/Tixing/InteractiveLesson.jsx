// components/Tixing/InteractiveLesson.jsx (最终修复版 - 解决音频自动播放问题)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 1. 动态导入所有题型组件 ---
import XuanZeTi from '@/components/Tixing/XuanZeTi';
import PanDuanTi from '@/components/Tixing/PanDuanTi';
import PaiXuTi from '@/components/Tixing/PaiXuTi';
import LianXianTi from '@/components/Tixing/LianXianTi';
import GaiCuoTi from '@/components/Tixing/GaiCuoTi';
import DuiHua from '@/components/Tixing/DuiHua';
import GrammarPointPlayer from '@/components/Tixing/GrammarPointPlayer';

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
        // [核心修复] 在用户点击时才播放语音
        if (data.narrationText) {
            playTTS(data.narrationText, settings.chineseVoice);
        }
        // 延迟一小段时间后进入下一页，给语音播放留出时间
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
const CompletionBlock = ({ data, router }) => { /* ... */ };


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
            if (currentIndex < totalBlocks - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setCurrentIndex(prev => prev + 1);
            }
        }, 1200);
    }, [currentIndex, totalBlocks]);
    
    // [核心修复] 移除了这里的自动播放 useEffect

    const renderBlock = () => {
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
            settings: { ...settings, playTTS },
        };

        switch (type) {
            case 'teaching': 
                // 将 onCorrect 作为 onComplete 传递给 TeachingBlock
                return <TeachingBlock data={props.data} onComplete={handleCorrect} settings={props.settings} />;
            
            // ... 您其他的 case ...
            case 'choice':
                 const xuanZeTiProps = {
                    question: { text: props.data.prompt, imageUrl: props.data.imageUrl, narrationText: props.data.narrationText },
                    options: props.data.choices || [],
                    correctAnswer: props.data.correctId ? [props.data.correctId] : [],
                    explanation: props.data.explanation,
                    onCorrect: props.onCorrect,
                    onNext: props.onCorrect,
                    isListeningMode: !!props.data.narrationText,
                };
                return <XuanZeTi {...xuanZeTiProps} />;
            
            default:
                console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
                useEffect(() => { handleCorrect(); }, [handleCorrect]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex) / totalBlocks) * 100 : 0;

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
