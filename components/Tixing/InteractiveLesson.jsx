// components/Tixing/InteractiveLesson.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 题型组件导入 ---
import PaiXuTi from '@/components/Tixing/PaiXuTi';
import LianXianTi from '@/components/Tixing/LianXianTi';
import GaiCuoTi from '@/components/Tixing/GaiCuoTi';

// --- 内置的辅助UI组件 ---
const TeachingBlock = ({ data, onComplete }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
        {data.pinyin && <p className="text-3xl text-slate-300 mb-2">{data.pinyin}</p>}
        <h1 className="text-7xl font-bold mb-4">{data.displayText}</h1>
        {data.translation && <p className="text-3xl text-slate-200">{data.translation}</p>}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
            <button onClick={onComplete} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                继续
            </button>
        </div>
    </div>
);

const CompletionBlock = ({ data, router }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
        <h1 className="text-7xl mb-4">🎉</h1>
        <h2 className="text-4xl font-bold mb-4">课程完成！</h2>
        <p className="text-xl">恭喜你，已经完成了所有学习内容。</p>
    </div>
);


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
                // 当到达最后一个块时，也增加索引以触发完成界面
                setCurrentIndex(prev => prev + 1);
            }
        }, 1200);
    }, [currentIndex, totalBlocks]);

    const renderBlock = () => {
        // 当索引超出所有块时，显示完成组件
        if (currentIndex >= totalBlocks) {
            return <CompletionBlock data={{}} router={router} />;
        }
        
        if (!currentBlock) {
            return <div className="text-white">正在加载...</div>;
        }

        const type = currentBlock.type.toLowerCase();
        const baseProps = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            settings: { ...settings /*, playTTS */ },
        };

        switch (type) {
            case 'teaching':
                return <TeachingBlock data={baseProps.data} onComplete={handleCorrect} />;

            // --- 新增的适配器逻辑 START ---

            case 'paixu': {
                // 适配器：将 LessonPlayer 的数据格式转换为 PaiXuTi 需要的 props
                const adapterProps = {
                    title: baseProps.data.prompt,
                    items: baseProps.data.items,
                    correctOrder: baseProps.data.correctOrder,
                    onComplete: baseProps.onCorrect, // 将 onCorrect 映射到 onComplete
                };
                return <PaiXuTi {...adapterProps} />;
            }

            case 'lianxian': {
                // 适配器：根据 JSON 数据动态生成 LianXianTi 需要的 props
                const { prompt, pairs } = baseProps.data;

                const columnA = pairs.map(p => ({ id: p.id, content: p.left }));
                
                // 复制并随机打乱 columnB
                const columnB = [...pairs.map(p => ({ id: p.id, content: p.right }))]
                    .sort(() => Math.random() - 0.5);
                
                // 将配对关系转换为 id -> id 的映射
                const correctPairs = pairs.reduce((acc, p) => {
                    acc[p.id] = p.id;
                    return acc;
                }, {});

                const adapterProps = {
                    title: prompt,
                    columnA: columnA,
                    columnB: columnB,
                    pairs: correctPairs,
                    onCorrect: baseProps.onCorrect,
                };
                return <LianXianTi {...adapterProps} />;
            }

            case 'gaicuo': {
                // 适配器：将 JSON 数据直接映射到 GaiCuoTi 的 props
                const { prompt, sentence, segmentationType, correctAnswers, explanation } = baseProps.data;
                const adapterProps = {
                    title: prompt,
                    sentence: sentence,
                    segmentationType: segmentationType,
                    correctAnswers: correctAnswers,
                    explanation: explanation,
                    onCorrect: baseProps.onCorrect,
                };
                return <GaiCuoTi {...adapterProps} />;
            }

            // --- 新增的适配器逻辑 END ---

            default:
                console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
                // 注意：在 render 函数中直接调用 useEffect 是不规范的，
                // 但此处为了完全遵循您提供的原始代码结构而保留。
                // 在实际项目中，建议将其重构为一个独立的组件。
                useEffect(() => {
                    // 使用一个极短的延迟来确保状态更新不会立即发生，以避免React警告
                    const timer = setTimeout(() => handleCorrect(), 50);
                    return () => clearTimeout(timer);
                }, [handleCorrect]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };
    
    // 计算进度
    const progress = totalBlocks > 0 ? ((currentIndex) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4">
            {/* 进度条 */}
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-4xl absolute top-4 px-4 z-10">
                    <div className="w-full bg-gray-600/50 rounded-full h-2.5">
                        <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
                    </div>
                </div>
            )}
            
            {/* 渲染当前题目/区块 */}
            <div className="w-full h-full flex items-center justify-center">
                {renderBlock()}
            </div>
        </div>
    );
}
