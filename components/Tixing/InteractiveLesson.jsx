import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import confetti from 'canvas-confetti';

// --- 1. 导入子组件 (路径请确保正确) ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. TTS 语音模块 ---
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

// --- 3. 页面组件 ---

// [TeachingBlock] 首页
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center pb-32 px-6 text-center select-none relative animate-fade-in">
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-5 drop-shadow-sm leading-tight">{data.displayText}</h1>
            
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="mb-8 p-3 bg-white text-blue-500 rounded-full shadow-md border border-blue-50 active:scale-95 transition-transform">
                <HiSpeakerWave className="w-6 h-6" /> 
            </button>

            {data.translation && (
                <div className="bg-white/60 px-5 py-4 rounded-xl backdrop-blur-sm border border-slate-100/50">
                    <p className="text-lg text-slate-600 font-medium">{data.translation}</p>
                </div>
            )}
            
            <div className="absolute bottom-20 opacity-40 flex flex-col items-center animate-pulse pointer-events-none">
                <span className="text-xs mb-1">上滑开始</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
            </div>
        </div>
    );
};

// [WordStudyBlock] 生词 - 滚动式布局
const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full min-h-full flex flex-col p-4 pb-48">
            <div className="py-8 text-center shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
                <p className="text-slate-400 text-xs mt-2">点击发音，上滑继续</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto w-full shrink-0">
                {data.words && data.words.map((word) => (
                    <div key={word.id} onClick={(e) => { e.stopPropagation(); playTTS(word.chinese, 'zh', word.rate || 0); }} 
                         className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer">
                        <span className="text-xs text-slate-400 mb-1 font-mono">{word.pinyin}</span>
                        <span className="text-2xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                        <span className="text-blue-500 text-sm font-medium">{word.translation}</span>
                        {word.example && <div className="mt-3 pt-3 border-t border-slate-50 w-full text-xs text-slate-400 text-left leading-relaxed">{word.example}</div>}
                    </div>
                ))}
            </div>
            
            <div className="mt-8 text-center opacity-30 shrink-0">
                <div className="w-1 h-8 bg-slate-300 mx-auto rounded-full mb-2"></div>
                <span className="text-xs">继续上滑</span>
            </div>
        </div>
    );
};

// [CompletionBlock]
const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        playTTS(data.title || "恭喜", 'zh');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => router.push('/'), 4000);
    }, []);
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-2">{data.text || "正在返回..."}</p>
        </div>
    );
};

// --- 4. 底部浮层 (只有解锁后显示) ---
const SwipeOverlay = ({ isVisible, onNext }) => {
    if (!isVisible) return null;
    return (
        <div onClick={onNext} className="fixed bottom-0 left-0 w-full h-40 z-50 flex flex-col items-center justify-end pb-12 bg-gradient-to-t from-gray-100/90 via-gray-100/60 to-transparent cursor-pointer pointer-events-none animate-fade-in">
            <style>{`
                @keyframes bounce-up-light { 0%, 100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(-15px); opacity: 0.7; } }
                .animate-bounce-up-light { animation: bounce-up-light 2s infinite ease-in-out; }
            `}</style>
            <div className="flex flex-col items-center animate-bounce-up-light">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#3b82f6" style={{ width: '2.5rem', height: '2.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                <span className="text-blue-500 font-bold text-sm mt-2 tracking-widest">上滑继续</span>
            </div>
        </div>
    );
};

// --- 5. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    // 手势相关状态
    const touchStartY = useRef(0);
    const containerRef = useRef(null);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // --- 禁止下拉刷新 & 全局设置 ---
    useEffect(() => {
        document.body.style.overscrollBehaviorY = 'contain';
        return () => {
            document.body.style.overscrollBehaviorY = 'auto';
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        };
    }, []);

    // --- 页面切换逻辑 ---
    useEffect(() => {
        if (!currentBlock) return;
        const type = currentBlock.type.toLowerCase();
        // 这些页面默认就是“完成”状态，允许直接上滑翻页
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        // 自动读题
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    const handleNext = useCallback(() => {
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

    // --- [核心] 原生手势处理逻辑 ---
    const onTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const distance = touchStartY.current - touchEndY; // 正数表示向上滑
        
        // 阈值设为 60px，避免轻微误触
        if (distance > 60) {
            // 特殊逻辑：如果是生词页 (WordStudy)，检查是否滚到了底部
            if (currentBlock?.type === 'word_study' && containerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
                // 允许 10px 的误差
                const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 10;
                
                if (!isAtBottom) {
                    // 如果没到底，不翻页，让它自然滚动
                    return; 
                }
            }

            // 通用逻辑：只有解锁了才能翻页
            if (isBlockCompleted) {
                handleNext();
            } else {
                // 可选：在这里加一个“请先完成题目”的晃动动画
            }
        }
    };

    const renderBlock = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} router={router} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: handleNext,
            onNext: handleCorrect,
            settings: { playTTS }
        };

        const QuizContainer = ({ children }) => (
            <div className="w-full h-full flex flex-col items-center justify-center pb-32 px-4 animate-fade-in">
                {children}
            </div>
        );

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={handleNext} />;
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={handleNext} />;
            
            case 'choice': 
                const choiceProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices||[], correctAnswer: props.data.correctId?[props.data.correctId]:[] };
                return <QuizContainer><XuanZeTi {...choiceProps} /></QuizContainer>;
            
            case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={handleCorrect} />;
            
            case 'lianxian':
                const lp = props.data.pairs || [];
                const ansMap = lp.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <QuizContainer><LianXianTi title={props.data.prompt} columnA={lp.map(p => ({id:p.id,content:p.left}))} columnB={lp.map(p => ({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={ansMap} onCorrect={handleCorrect} /></QuizContainer>;
            
            case 'paixu': 
                return <QuizContainer><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...(props.data.items||[])].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={handleCorrect} /></QuizContainer>;
            
            case 'panduan': return <QuizContainer><PanDuanTi {...props} /></QuizContainer>;
            case 'gaicuo': return <QuizContainer><GaiCuoTi {...props} /></QuizContainer>;
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <div>Unknown {type}</div>;
        }
    };

    return (
        <div 
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans overflow-y-auto overflow-x-hidden"
            // touchAction: 'pan-y' 非常重要，它允许内容内部滚动，但我们 JS 会监听是否到底
            style={{ touchAction: 'pan-y' }}
        >
            {/* 顶部进度条 */}
            {currentIndex < blocks.length && (
                <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top">
                    <div className="h-1 bg-gray-200 w-full">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / blocks.length) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* 主内容 */}
            <div className="flex-1 w-full min-h-full">
                {renderBlock()}
            </div>

            {/* 页码 - 底部居中 */}
            {currentIndex < blocks.length && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-slate-200/60 backdrop-blur-md text-[10px] font-bold text-slate-400 rounded-full select-none">
                    {currentIndex + 1} / {blocks.length}
                </div>
            )}

            {/* 提示浮层 */}
            <SwipeOverlay isVisible={isBlockCompleted} onNext={handleNext} />
        </div>
    );
}
