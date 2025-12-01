import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave, HiArrowLeft, HiArrowRight, HiCheck } from "react-icons/hi2";
import confetti from 'canvas-confetti';

// --- 1. 导入子组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. TTS 工具 ---
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
let currentAudio = null;

const playTTS = async (text, lang = 'zh', rate = 0) => {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (!text) return;
    try {
        const voice = ttsVoices[lang] || ttsVoices['zh'];
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const audio = new Audio(url);
        currentAudio = audio;
        await audio.play();
    } catch (e) { console.error("TTS error:", e); }
};

// --- 3. 基础展示组件 (无内部按钮) ---

const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);
    return (
        <div className="flex flex-col items-center text-center">
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            <h1 className="text-4xl font-extrabold text-slate-800 mb-6">{data.displayText}</h1>
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="p-3 bg-white text-blue-500 rounded-full shadow-md border border-slate-100 active:scale-95 mb-6">
                <HiSpeakerWave className="w-8 h-8" /> 
            </button>
            {data.translation && (
                <div className="bg-white/80 px-6 py-4 rounded-xl border border-slate-100 text-slate-600 font-medium">
                    {data.translation}
                </div>
            )}
        </div>
    );
};

const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full flex flex-col items-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{data.title || "本课生词"}</h2>
            <div className="grid grid-cols-1 gap-4 w-full">
                {data.words && data.words.map((word) => (
                    <div key={word.id} onClick={() => playTTS(word.chinese, 'zh')} 
                         className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center active:scale-[0.99] transition-transform">
                        <span className="text-xs text-slate-400 mb-1">{word.pinyin}</span>
                        <span className="text-xl font-bold text-slate-800">{word.chinese}</span>
                        <span className="text-blue-500 text-sm mt-1">{word.translation}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        playTTS("恭喜完成", 'zh');
        confetti();
        setTimeout(() => router.push('/'), 3000);
    }, []);
    return (
        <div className="flex flex-col items-center justify-center h-64">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-slate-800">课程完成！</h2>
        </div>
    );
};

// --- 4. 核心页面组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // --- 逻辑控制 ---
    useEffect(() => {
        if (!currentBlock) return;
        
        // 1. 自动滚动回顶部 (切换题目时)
        window.scrollTo(0, 0);

        // 2. 判断当前页类型，有些类型天生就是“已完成”状态，不需要做题
        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        // 3. 自动播放读音
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    // 下一题逻辑
    const handleNext = useCallback(() => {
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length]);

    // 上一题逻辑
    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setIsBlockCompleted(true); // 往回翻默认解锁
            setCurrentIndex(p => p - 1);
        }
    }, [currentIndex]);

    // 做对题目的回调
    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        setIsBlockCompleted(true);
    }, []);

    // 渲染题目内容
    const renderContent = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} router={router} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: handleCorrect, // 统一触发完成状态
            onNext: handleCorrect,     // 兼容某些组件的命名
            settings: { playTTS }
        };

        // 注意：这里移除了原来外层的 flex center 布局，改由外部容器控制
        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={handleCorrect} />;
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={handleCorrect} />;
            
            case 'choice': 
                const choiceProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices||[], correctAnswer: props.data.correctId?[props.data.correctId]:[] };
                return <XuanZeTi {...choiceProps} />;
            
            case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={handleCorrect} />;
            
            case 'lianxian':
                const lp = props.data.pairs || [];
                const ansMap = lp.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <LianXianTi title={props.data.prompt} columnA={lp.map(p => ({id:p.id,content:p.left}))} columnB={lp.map(p => ({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={ansMap} onCorrect={handleCorrect} />;
            
            case 'paixu': 
                return <PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...(props.data.items||[])].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={handleCorrect} />;
            
            case 'panduan': return <PanDuanTi {...props} />;
            case 'gaicuo': return <GaiCuoTi {...props} />;
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <div>未知题型 {type}</div>;
        }
    };

    // 进度条百分比
    const progress = Math.min(((currentIndex + 1) / blocks.length) * 100, 100);

    return (
        // 容器：全屏高度 (h-[100dvh])，背景灰白
        <div className="min-h-[100dvh] w-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans">
            
            {/* 1. 顶部进度条 (没有关闭按钮 X) */}
            <div className="w-full h-1.5 bg-slate-200 sticky top-0 z-50">
                <div 
                    className="h-full bg-blue-500 transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            {/* 2. 主内容区域 */}
            {/* flex-1 让它占满剩余空间 */}
            {/* justify-center 让内容垂直居中 */}
            {/* pb-32 是关键：底部的 Padding 大于顶部，视觉上内容会“中偏上” */}
            <div className="flex-1 flex flex-col items-center justify-center px-5 pt-8 pb-32 w-full max-w-2xl mx-auto">
                
                {/* 题目组件渲染区 */}
                <div className="w-full">
                    {renderContent()}
                </div>

                {/* 3. 导航按钮区域 (跟随在题目下方) */}
                {/* mt-12 保证按钮和题目有足够间距 */}
                {/* 这个位置就是“中偏下”，因为它在内容下方，但又被外层 pb-32 顶起来了，不会贴底 */}
                {currentIndex < blocks.length && (
                    <div className="w-full mt-12 flex items-center justify-between gap-4">
                        
                        {/* 上一题 (圆形小按钮) */}
                        <button 
                            onClick={handlePrev} 
                            disabled={currentIndex === 0}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border transition-all
                                ${currentIndex === 0 
                                    ? 'border-slate-200 text-slate-300 opacity-0 cursor-default' // 第一页隐藏
                                    : 'border-slate-300 text-slate-500 bg-white hover:bg-slate-50 shadow-sm'}`}
                        >
                            <HiArrowLeft className="w-5 h-5" />
                        </button>

                        {/* 下一题 (长条大按钮) */}
                        <button 
                            onClick={handleNext}
                            disabled={!isBlockCompleted}
                            className={`flex-1 flex items-center justify-center space-x-2 h-12 rounded-full font-bold text-lg shadow-md transition-all active:scale-95
                                ${!isBlockCompleted 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' // 锁定状态：灰色
                                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-200'}`} // 解锁状态：蓝色
                        >
                            <span>{currentIndex === blocks.length - 1 ? "完成" : "下一题"}</span>
                            {isBlockCompleted && (
                                currentIndex === blocks.length - 1 ? <HiCheck className="w-5 h-5"/> : <HiArrowRight className="w-5 h-5"/>
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
