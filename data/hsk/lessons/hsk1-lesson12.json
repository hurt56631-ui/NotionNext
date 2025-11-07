// components/Tixing/InteractiveLesson.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';

// --- 题型组件占位符 (你将在这里添加正确的导入) ---
import PaiXuTi from '@/components/Tixing/PaiXuTi';
import LianXianTi from '@/components/Tixing/LianXianTi';
import GaiCuoTi from '@/components/Tixing/GaiCuoTi';

// --- 内置的辅助UI组件 ---
const TeachingBlock = ({ data, onComplete }) => { /* ... */ };
const CompletionBlock = ({ data, router }) => { /* ... */ };

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

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) { /* ... */ }
        if (!currentBlock) { /* ... */ }

        const type = currentBlock.type.toLowerCase();
        const baseProps = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            settings: { ...settings /*, playTTS */ },
        };

        switch (type) {
            case 'teaching': 
                return <TeachingBlock data={baseProps.data} onComplete={handleCorrect} />;
            
            // 你将在这里为其他题型组件添加 case 和适配器逻辑
            
            case 'paixu': {
                // 适配器逻辑：将 data 中的 prompt 映射到 title，onCorrect 映射到 onComplete
                const adapterProps = {
                    title: baseProps.data.prompt,
                    items: baseProps.data.items,
                    correctOrder: baseProps.data.correctOrder,
                    onComplete: baseProps.onCorrect,
                };
                return <PaiXuTi {...adapterProps} />;
            }

            case 'lianxian': {
                // 适配器逻辑：处理 LianXianTi 需要的特殊数据结构
                const { prompt, pairs } = baseProps.data;

                // 1. 提取 Column A
                const columnA = pairs.map(p => ({ id: p.id, content: p.left }));

                // 2. 提取并打乱 Column B
                const columnB = [...pairs.map(p => ({ id: p.id, content: p.right }))]
                    .sort(() => Math.random() - 0.5);
                
                // 3. 转换配对关系为 ID 映射对象
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
                // 适配器逻辑：将 data 中的 prompt 映射到 title，其他数据直接传递
                const { prompt, ...restOfData } = baseProps.data;
                const adapterProps = {
                    ...restOfData, // 传递 sentence, segmentationType 等
                    title: prompt,
                    onCorrect: baseProps.onCorrect,
                };
                return <GaiCuoTi {...adapterProps} />;
            }

            default:
                console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
                useEffect(() => { handleCorrect(); }, [handleCorrect]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };
    
    return ( /* ... JSX ... */ );
}
