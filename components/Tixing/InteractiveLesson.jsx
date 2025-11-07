// components/Tixing/InteractiveLesson.jsx (全新的、自包含的互动课程组件)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

// --- 1. TTS 音频播放模块 (内置) ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
    if (!text) return;
    const cacheKey = `${text}|${voice}`;
    if (ttsCache.has(cacheKey)) {
        try {
            const blob = await (await fetch(ttsCache.get(cacheKey))).blob();
            new Audio(URL.createObjectURL(blob)).play();
            return;
        } catch(e) { console.error("从缓存播放失败", e); }
    }
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        ttsCache.set(cacheKey, objectUrl);
        new Audio(objectUrl).play();
    } catch (e) { console.error(`播放 "${text}" (${voice}) 失败:`, e); }
};


// --- 2. 所有题型的渲染组件 (全部内置) ---

const TeachingBlock = ({ content }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
        {content.pinyin && <p className="text-2xl text-slate-300 mb-2">{content.pinyin}</p>}
        <h1 className="text-6xl font-bold mb-4">{content.displayText}</h1>
        {content.translation && <p className="text-2xl text-slate-200">{content.translation}</p>}
    </div>
);

const ChoiceQuestion = ({ data, onCorrect }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);

    const handleSelect = (choiceId) => {
        if (isCorrect !== null) return; // 回答后不允许再选

        setSelectedId(choiceId);
        const correct = choiceId === data.correctId;
        setIsCorrect(correct);

        if (correct) {
            setTimeout(onCorrect, 1000);
        }
    };

    useEffect(() => {
        if (data.narrationText) {
            playTTS(data.narrationText);
        }
    }, [data.narrationText]);

    return (
        <div className="w-full max-w-md mx-auto p-6 bg-white/10 backdrop-blur-md rounded-2xl text-white animate-fade-in-up">
            <p className="text-xl font-semibold mb-6 text-center">{data.prompt}</p>
            <div className="space-y-4">
                {data.choices.map(choice => {
                    let bgColor = 'bg-white/20 hover:bg-white/30';
                    if (selectedId === choice.id) {
                        bgColor = isCorrect ? 'bg-green-500' : 'bg-red-500';
                    } else if (isCorrect !== null && choice.id === data.correctId) {
                        bgColor = 'bg-green-500';
                    }
                    return (
                        <button 
                            key={choice.id} 
                            onClick={() => handleSelect(choice.id)}
                            className={`w-full text-left p-4 rounded-lg text-lg font-medium transition-colors duration-300 ${bgColor}`}
                        >
                            {choice.text}
                        </button>
                    );
                })}
            </div>
            {isCorrect === false && <p className="text-red-300 text-center mt-4">{data.explanation || "再试一次吧！"}</p>}
        </div>
    );
};

const CourseCompleteBlock = ({ router }) => {
    useEffect(() => {
        const timer = setTimeout(() => router.push('/'), 5000);
        return () => clearTimeout(timer);
    }, [router]);
    
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
            <h1 className="text-6xl mb-4">🎉</h1>
            <h2 className="text-4xl font-bold mb-4">ဂုဏ်ယူပါတယ်။</h2>
            <p className="text-xl">သင်ခန်းစာပြီးဆုံးပါပြီ။ ပင်မစာမျက်နှာသို့ ပြန်သွားနေသည်...</p>
        </div>
    );
};
// 您可以在这里继续添加 LianXianTi, PaiXuTi 等其他题型组件的内置版本...


// --- 3. 主播放器组件 (核心逻辑) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    const goToNext = useCallback(() => {
        if (currentIndex < totalBlocks - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // 标记课程完成
            setCurrentIndex(prev => prev + 1); // 超出索引，显示完成页
        }
    }, [currentIndex, totalBlocks]);
    
    // 开场自动播放语音
    useEffect(() => {
        const firstBlock = blocks[0];
        if (firstBlock?.type === 'teaching' && firstBlock?.content?.narrationText) {
            playTTS(firstBlock.content.narrationText, settings.chineseVoice);
        }
    }, [blocks, settings.chineseVoice]);

    const renderBlock = () => {
        // 如果索引超出，则显示完成页面
        if (currentIndex >= totalBlocks) {
            return <CourseCompleteBlock router={router} />;
        }
        if (!currentBlock) {
            return <div className="text-white">正在加载...</div>;
        }

        const type = currentBlock.type.toLowerCase();
        
        // 所有组件都接收相同的基础 props
        const props = {
            data: currentBlock.content,
            onComplete: goToNext, // 所有互动组件都接收 onComplete 信号
            onCorrect: goToNext, // 兼容 onCorrect
            settings: settings,
        };

        switch (type) {
            case 'teaching':
                // TeachingBlock 是展示性的，需要一个按钮来手动进入下一页
                return (
                    <div>
                        <TeachingBlock content={props.data} />
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                            <button onClick={goToNext} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                                စတင်လေ့လာမည် (Start)
                            </button>
                        </div>
                    </div>
                );
            
            case 'choice':
                return <ChoiceQuestion {...props} />;
            
            // case 'lianxian':
            //     return <LianXianQuestion {...props} />;
            
            // case 'paixu':
            //     return <PaiXuQuestion {...props} />;
                
            default:
                // 对于尚未内置的题型，暂时跳过
                console.warn(`不支持的内置题型: "${type}", 自动跳过。`);
                useEffect(() => { goToNext(); }, [goToNext]);
                return <div className="text-white">正在加载下一题...</div>;
        }
    };
    
    const progress = totalBlocks > 0 ? ((currentIndex) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
            {/* 进度条 */}
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-4xl absolute top-4 px-4">
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
