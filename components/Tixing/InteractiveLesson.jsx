// components/Tixing/InteractiveLesson.jsx (最终版 - 已适配 GrammarPointPlayer)

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
// ... TTS 代码保持不变 ...

// --- 3. 内置的辅助UI组件 ---
const TeachingBlock = ({ data, onComplete }) => { /* ... */ };
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
                setCurrentIndex(prev => prev + 1); // 超出索引以显示完成页
            }
        }, 1200);
    }, [currentIndex, totalBlocks]);

    // ... useEffect for auto-playing TTS, etc. ...

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) {
            const lastBlockContent = blocks[totalBlocks-1]?.content || {};
            return <CompletionBlock data={lastBlockContent} router={router} />;
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
            
            case 'choice':
                // ... 选择题的适配器逻辑保持不变 ...
                const xuanZeTiProps = {
                    question: { text: baseProps.data.prompt, ... },
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

            // [核心修复] 为语法组件创建正确的适配器
            case 'grammar_study': // 确保 JSON 中的 type 是 "grammar_study"
            case 'grammar': // 兼容旧的 "grammar" 类型
                // 1. 从 data 中提取 grammarPoints 数组
                const grammarData = baseProps.data?.grammarPoints || [];
                // 2. 将 onCorrect 连接到 onComplete prop
                const onGrammarComplete = baseProps.onCorrect;

                return <GrammarPointPlayer 
                           grammarPoints={grammarData} 
                           onComplete={onGrammarComplete} 
                       />;

            default:
                console.warn(`不支持的组件类型: "${type}", 自动跳过。`);
                useEffect(() => { handleCorrect(); }, [handleCorrect]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
            {/* 进度条 */}
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-4xl absolute top-4 px-4 z-10">
                    {/* ... 进度条 JSX ... */}
                </div>
            )}
            <div className="w-full h-full flex items-center justify-center">
                {renderBlock()}
            </div>
        </div>
    );
}
