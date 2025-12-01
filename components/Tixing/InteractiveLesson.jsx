// components/Tixing/InteractiveLesson.js (最终修复版 - createPortal 全屏)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom'; // ✅ 1. 导入 createPortal
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaCheck, FaTimes } from "react-icons/fa"; // 引入 X 图标
import confetti from 'canvas-confetti';
import dynamic from 'next/dynamic';
import { useTransition, animated } from '@react-spring/web';

// --- 子组件导入 (保持不变) ---
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false });
const TianKongTi = dynamic(() => import('@/components/Tixing/TianKongTi'), { ssr: false });
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });

// ... TTS 和其他页面组件代码保持不变 ...
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

const TeachingBlock = ({ data }) => {
    useEffect(() => { if (data.narrationScript) setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800); }, [data]);
    return (
        <div className="w-full h-full flex flex-col items-center justify-center pb-24 px-6 text-center select-none relative animate-fade-in">
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-5 drop-shadow-sm leading-tight">{data.displayText}</h1>
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} className="mb-8 p-3 bg-white text-blue-500 rounded-full shadow-md border border-blue-50 active:scale-95 transition-transform"><HiSpeakerWave className="w-6 h-6" /></button>
            {data.translation && (<div className="bg-white/60 px-5 py-4 rounded-xl backdrop-blur-sm border border-slate-100/50"><p className="text-lg text-slate-600 font-medium">{data.translation}</p></div>)}
        </div>
    );
};

const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full h-full overflow-y-auto pt-16 pb-32">
            <div className="text-center shrink-0 px-4"><h2 className="text-2xl font-bold text-slate-800">{data.title || "本课学习"}</h2><p className="text-slate-400 text-xs mt-2">点击卡片发音</p></div>
            <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto w-full shrink-0 p-4">
                {data.words && data.words.map((word) => (
                    <div key={word.id} onClick={(e) => { e.stopPropagation(); playTTS(word.chinese, 'zh', word.rate || 0); }} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer hover:shadow-md">
                        {word.pinyin && <span className="text-xs text-slate-400 mb-1 font-mono">{word.pinyin}</span>}
                        <span className="text-xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                        <span className="text-blue-500 text-sm font-medium">{word.translation}</span>
                        {word.example && <div className="mt-3 pt-3 border-t border-slate-50 w-full text-xs text-slate-400 text-left leading-relaxed">{word.example}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const CompletionBlock = ({ data }) => {
    useEffect(() => { playTTS(data.title || "恭喜", 'zh'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }, []);
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center pb-24">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-2">{data.text || "正在返回..."}</p>
        </div>
    );
};

const BottomNavigation = ({ currentIndex, total, isCompleted, onPrev, onNext }) => {
    const progress = Math.min(100, Math.round(((currentIndex + 1) / total) * 100));
    return (
        <div className="fixed bottom-0 left-0 w-full p-5 pb-8 z-[300] flex items-center justify-between pointer-events-none">
            <button onClick={onPrev} disabled={currentIndex === 0} className={`pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${currentIndex === 0 ? 'opacity-0 scale-50' : 'bg-white text-slate-500 hover:bg-gray-50 active:scale-90'}`}><FaChevronLeft size={18} /></button>
            <div className="pointer-events-auto flex flex-col items-center justify-center px-4 py-1.5 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-white/50"><span className="text-[10px] font-bold text-slate-400 tracking-wider">{currentIndex + 1} / {total}</span><div className="w-12 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div></div>
            <button onClick={onNext} disabled={!isCompleted} className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-xl transition-all duration-300 transform ${isCompleted ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed translate-y-8 opacity-0'}`}><span>下一页</span><FaChevronRight size={14} /></button>
        </div>
    );
};

// --- 主逻辑组件 ---
// ✅ 2. 接收 onClose prop
export default function InteractiveLesson({ lesson, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;
    const lastDirection = useRef(0);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        document.body.style.overscrollBehaviorY = 'contain';
        return () => { document.body.style.overscrollBehaviorY = 'auto'; if(currentAudio) currentAudio.pause(); };
    }, []);

    useEffect(() => {
        if (!currentBlock) return;
        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        if (currentBlock.content?.narrationScript) {
            setTimeout(() => playTTS(currentBlock.content.narrationScript, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    const handleNext = useCallback(() => {
        if (!isBlockCompleted) return;
        if (currentIndex < blocks.length) {
            lastDirection.current = 1;
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length, isBlockCompleted]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            lastDirection.current = -1;
            setCurrentIndex(p => p - 1);
            setIsBlockCompleted(true); 
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

    const transitions = useTransition(currentIndex, {
        key: currentBlock ? currentBlock.id || currentIndex : currentIndex,
        from: { opacity: 0, transform: `translateX(${lastDirection.current >= 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateX(0%)' },
        leave: { opacity: 0, transform: `translateX(${lastDirection.current >= 0 ? '-100%' : '100%'})`, position: 'absolute' },
        config: { mass: 1, tension: 300, friction: 30 },
    });
    
    const lessonContent = (
        <div className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans overflow-hidden">
            
            {/* ✅ 3. 关闭按钮集成进来 */}
            <button onClick={onClose} className="fixed top-4 right-4 z-[400] p-2 bg-black/10 dark:bg-white/10 rounded-full backdrop-blur-sm hover:bg-black/20 transition-colors">
                <FaTimes size={20} className="text-gray-600 dark:text-gray-200" />
            </button>
            
            <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top pointer-events-none">
                <div className="h-1 bg-gray-200 w-full"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / (blocks.length || 1)) * 100}%` }} /></div>
            </div>

            <div className="flex-1 w-full h-full relative">
                {transitions((style, i) => {
                    const block = blocks[i];
                    if (!block) return null;

                    const type = block.type.toLowerCase();
                    const props = { data: block.content, onCorrect: handleCorrect, onComplete: handleNext };
                    
                    const QuizContainer = ({ children }) => (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4">{children}</div>
                    );

                    let content;
                    switch (type) {
                        case 'teaching': content = <TeachingBlock {...props} />; break;
                        case 'word_study': content = <WordStudyBlock {...props} />; break;
                        case 'grammar_study': content = <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={() => setIsBlockCompleted(true)} />; break;
                        case 'choice': content = <QuizContainer><XuanZeTi {...props} question={{ text: props.data.prompt, ...props.data }} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]}/></QuizContainer>; break;
                        case 'panduan': content = <QuizContainer><PanDuanTi {...props} /></QuizContainer>; break;
                        // ... 其他题型
                        case 'complete': case 'end': content = <CompletionBlock data={props.data} />; break;
                        default: content = <div className="p-10 text-center text-gray-400">未知类型: {type}</div>;
                    }
                    
                    return <animated.div style={{ ...style, position: 'absolute', width: '100%', height: '100%' }}>{content}</animated.div>;
                })}
            </div>

            {currentIndex < blocks.length && (
                <BottomNavigation 
                    currentIndex={currentIndex}
                    total={blocks.length}
                    isCompleted={isBlockCompleted}
                    onPrev={handlePrev}
                    onNext={handleNext}
                />
            )}
        </div>
    );
    
    // ✅ 4. 使用 createPortal 渲染到 body
    if (isMounted) {
        return createPortal(lessonContent, document.body);
    }
    
    return null;
}
