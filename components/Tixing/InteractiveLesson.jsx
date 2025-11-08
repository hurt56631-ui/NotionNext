// components/Tixing/InteractiveLesson.jsx (最终完整版 - 适配所有题型)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 1. 动态导入所有题型组件 (按您的路径) ---
import XuanZeTi from '@/components/Tixing/XuanZeTi';
import PanDuanTi from '@/components/Tixing/PanDuanTi';
import PaiXuTi from '@/components/Tixing/PaiXuTi';
import LianXianTi from '@/components/Tixing/LianXianTi';
import GaiCuoTi from '@/components/Tixing/GaiCuoTi';
import DuiHua from '@/components/Tixing/DuiHua';
import GrammarPointPlayer from '@/components/Tixing/GrammarPointPlayer';

// --- 2. 统一的TTS模块 (采纳您验证过的方案) ---
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
const TeachingBlock = ({ data, onComplete }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
        {data.pinyin && <p className="text-3xl text-slate-300 mb-2">{data.pinyin}</p>}
        <h1 className="text-7xl font-bold mb-4">{data.displayText}</h1>
        {data.translation && <p className="text-3xl text-slate-200">{data.translation}</p>}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
            <button onClick={onComplete} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                နောက်တစ်ခု (Next)
            </button>
        </div>
    </div>
);

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

// --- 4. 主播放器组件 (核心逻辑 - “智能导演”) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const handleCorrect = useCallback(() => {
        // 播放庆祝效果
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        // 延迟一段时间后自动进入下一题
        setTimeout(() => {
            if (currentIndex < totalBlocks - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setCurrentIndex(prev => prev + 1); // 超出索引以显示完成页
            }
        }, 1200); // 延迟1.2秒，让用户看到反馈
    }, [currentIndex, totalBlocks]);

    // 开场自动播放语音
    useEffect(() => {
        if (currentIndex === 0) {
            const firstBlock = blocks[0];
            if (firstBlock?.type === 'teaching' && firstBlock?.content?.narrationText) {
                playTTS(firstBlock.content.narrationText, settings.chineseVoice);
            }
        }
    }, [blocks, currentIndex, settings.chineseVoice]);

    const renderBlock = () => {
        // 如果索引超出，显示完成页面
        if (currentIndex >= totalBlocks) {
            const lastBlockData = blocks[totalBlocks-1]?.content || {};
            return <CompletionBlock data={lastBlockData} router={router} />;
        }
        if (!currentBlock) {
            return <div className="text-white">正在加载...</div>;
        }

        const type = currentBlock.type.toLowerCase();
        
        // [核心] 所有子组件都遵循这个统一的 props 接口
        const baseProps = {
            data: currentBlock.content,
            onCorrect: handleCorrect, // 所有题型组件都使用 onCorrect 作为成功回调
            settings: { ...settings, playTTS },
        };

        switch (type) {
            case 'teaching': 
                return <TeachingBlock data={baseProps.data} onComplete={handleCorrect} />;
            
            case 'choice':
                const xuanZeTiProps = {
                    question: {
                        text: baseProps.data.prompt,
                        imageUrl: baseProps.data.imageUrl,
                        // ...其他媒体字段
                    },
                    options: baseProps.data.choices || [],
                    correctAnswer: baseProps.data.correctId ? [baseProps.data.correctId] : [],
                    explanation: baseProps.data.explanation,
                    onCorrect: baseProps.onCorrect,
                    onNext: baseProps.onCorrect,
                    isListeningMode: !!baseProps.data.narrationText,
                };
                if (xuanZeTiProps.isListeningMode) {
                    xuanZeTiProps.question.text = baseProps.data.narrationText;
                }
                return <XuanZeTi {...xuanZeTiProps} />;

            case 'panduan':
                return <PanDuanTi {...baseProps} />;
            
            case 'paixu':
                const paixuProps = {
                    title: baseProps.data.prompt,
                    items: baseProps.data.items || [],
                    correctOrder: baseProps.data.correctOrder || baseProps.data.items?.sort((a, b) => a.order - b.order).map(item => item.id),
                    onComplete: baseProps.onCorrect,
                };
                return <PaiXuTi {...paixuProps} />;

            case 'lianxian':
                 const lianXianTiProps = {
                    title: baseProps.data.prompt,
                    columnA: (baseProps.data.pairs || []).map(p => ({ id: p.id, content: p.left })),
                    columnB: [...(baseProps.data.pairs || [])].sort(() => 0.5 - Math.random()).map(p => ({ id: p.id, content: p.right })),
                    pairs: (baseProps.data.pairs || []).reduce((acc, p) => ({ ...acc, [p.id]: p.id }), {}),
                    onCorrect: baseProps.onCorrect,
                };
                return <LianXianTi {...lianXianTiProps} />;

            case 'gaicuo':
                const gaiCuoTiProps = {
                    title: baseProps.data.prompt,
                    sentence: baseProps.data.sentence,
                    segmentationType: baseProps.data.segmentationType,
                    correctAnswers: baseProps.data.correctAnswers,
                    explanation: baseProps.data.explanation,
                    onCorrect: baseProps.onCorrect,
                };
                return <GaiCuoTi {...gaiCuoTiProps} />;

            case 'dialogue_cinematic':
            case 'dialogue':
                return <DuiHua {...baseProps} />;

            case 'grammar':
                return <GrammarPointPlayer grammarPoints={baseProps.data.grammarPoints} onComplete={baseProps.onCorrect} />;
            
            case 'complete': 
            case 'end': 
                return <CompletionBlock data={baseProps.data} router={router} />;

            default:
                console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
                useEffect(() => { handleCorrect(); }, [handleCorrect]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
            {/* 进度条 */}
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-4xl absolute top-4 px-4 z-10">
                    <div className="w-full bg-gray-600/50 rounded-full h-2.5">
                        <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
                    </div>
                </div>
            )}
            
            {/* 渲染当前页面/题目 */}
            <div className="w-full h-full flex items-center justify-center">
                {renderBlock()}
            </div>
        </div>
    );
}
