// components/Tixing/InteractiveLesson.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import confetti from 'canvas-confetti';

// --- 1. 导入所有子组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. TTS 语音模块 ---
const ttsVoices = {
    zh: 'zh-CN-XiaoyouNeural',
    my: 'my-MM-NilarNeural',
};
let currentAudio = null;

const playTTS = async (text, lang = 'zh', rate = 0, onEndCallback = null) => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    if (!text) {
        if (onEndCallback) onEndCallback();
        return;
    }
    const voice = ttsVoices[lang] || ttsVoices['zh'];
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => { currentAudio = null; if (onEndCallback) onEndCallback(); };
        audio.onerror = () => { console.error("TTS failed"); if (onEndCallback) onEndCallback(); };
        await audio.play();
    } catch (e) {
        console.error("Audio error:", e);
        if (onEndCallback) onEndCallback();
    }
};

const stopAllAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
};

// --- 3. 手势 Hook (修复版) ---
const useSwipeGesture = (onSwipeUp) => {
    const [bind, setBind] = useState(() => () => ({}));
    
    useEffect(() => {
        let mounted = true;
        import('@use-gesture/react').then(({ useDrag }) => {
            if (!mounted) return;
            const bindFn = useDrag(({ swipe: [, swipeY] }) => {
                if (swipeY === -1) { // -1 表示向上滑动
                    onSwipeUp();
                }
            }, { 
                axis: 'y', 
                filterTaps: true, 
                preventDefault: true 
            });
            setBind(() => bindFn);
        });
        return () => { mounted = false; };
    }, [onSwipeUp]);

    return bind;
};

// --- 4. 浮层组件 ---
const SwipeOverlay = ({ onNext, isVisible }) => {
    const bind = useSwipeGesture(onNext);
    if (!isVisible) return null;
    return (
        <div {...bind()} onClick={onNext} className="fixed bottom-0 left-0 w-full h-40 z-50 flex flex-col items-center justify-end pb-12 bg-gradient-to-t from-gray-100/90 via-gray-100/50 to-transparent cursor-pointer animate-fade-in" style={{ touchAction: 'none' }}>
            <div className="flex flex-col items-center animate-bounce">
                <FaChevronUp className="text-blue-500 text-2xl" />
                <span className="text-blue-600 font-bold text-sm mt-2">上滑继续</span>
            </div>
        </div>
    );
};

// --- 5. 核心显示组件 ---

// [TeachingBlock] 首页：布局修正 (居中偏上) + 手势修复
const TeachingBlock = ({ data, onComplete }) => {
    const bind = useSwipeGesture(onComplete);

    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        // style={{ touchAction: 'none' }} 是修复手势的关键，禁止浏览器默认滚动，强制交给 JS 处理
        <div {...bind()} style={{ touchAction: 'none' }} className="w-full h-full flex flex-col items-center justify-center pb-48 px-6 text-center cursor-pointer relative select-none">
            
            {/* 内容区 */}
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-5 drop-shadow-sm leading-tight">
                {data.displayText}
            </h1>
            
            {/* 播放按钮 - 已缩小 */}
            <button 
                onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="mb-6 p-2 bg-white text-blue-500 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 border border-blue-50"
            >
                <HiSpeakerWave className="w-6 h-6" /> 
            </button>

            {data.translation && (
                <div className="bg-white/60 px-5 py-3 rounded-xl backdrop-blur-sm border border-slate-100/50">
                    <p className="text-lg text-slate-600 font-medium leading-relaxed">{data.translation}</p>
                </div>
            )}
            
            {/* 底部提示文字 */}
            <div className="absolute bottom-20 left-0 w-full flex flex-col items-center opacity-50">
                <FaChevronUp className="h-5 w-5 text-slate-400 animate-bounce" />
                <span className="text-xs text-slate-400 mt-2">上滑开始学习</span>
            </div>
        </div>
    );
};

// [WordStudyBlock] 生词：保持不变，也加上 touch-action 确保手势流畅
const WordStudyBlock = ({ data, onComplete }) => {
    const bind = useSwipeGesture(onComplete);

    return (
        <div {...bind()} className="w-full h-full flex flex-col bg-[#F5F7FA] relative overflow-hidden">
            <div className="pt-14 pb-4 px-6 text-center bg-[#F5F7FA] z-10">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
                <p className="text-slate-400 text-xs mt-1">点击发音，上滑继续</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                    {data.words && data.words.map((word) => (
                        <div key={word.id} onClick={() => playTTS(word.chinese, 'zh', word.rate || 0)} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer">
                            <span className="text-xs text-slate-400 mb-1 font-mono">{word.pinyin}</span>
                            <span className="text-2xl font-bold text-slate-800 mb-1">{word.chinese}</span>
                            <span className="text-blue-500 text-sm font-medium">{word.translation}</span>
                            {word.example && <div className="mt-2 pt-2 border-t border-slate-50 w-full text-xs text-slate-400">{word.example}</div>}
                        </div>
                    ))}
                </div>
                <div className="h-24 w-full flex items-center justify-center text-slate-300 text-xs mt-4">
                    <FaChevronUp className="animate-bounce mr-1"/> 继续浏览或上滑
                </div>
            </div>
        </div>
    );
};

// [CompletionBlock] 结束页
const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        playTTS(data.title || "恭喜", 'zh');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        const timer = setTimeout(() => router.push('/'), 4000);
        return () => clearTimeout(timer);
    }, [data, router]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[#F5F7FA] text-slate-800">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold mb-3">{data.title || "完成！"}</h2>
            <p className="text-lg text-slate-500">{data.text || "即将返回主页..."}</p>
        </div>
    );
};

const UnknownBlockHandler = ({ type, onSkip }) => (
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
        <p>暂不支持: {type}</p>
        <button onClick={onSkip} className="mt-4 text-blue-500">跳过</button>
    </div>
);

// --- 6. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showSwipeOverlay, setShowSwipeOverlay] = useState(false);
    
    // 调试跳转
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    useEffect(() => { 
        stopAllAudio(); 
        setShowSwipeOverlay(false); 
    }, [currentIndex]);

    useEffect(() => {
        if (!showSwipeOverlay && currentBlock && currentBlock.content) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText; 
            if (text) {
                const timer = setTimeout(() => playTTS(text, 'zh'), 600);
                return () => clearTimeout(timer);
            }
        }
    }, [currentIndex, currentBlock, showSwipeOverlay]);

    const handleBlockCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        setShowSwipeOverlay(true); 
    }, []);

    const goToNextBlock = useCallback(() => {
        if (currentIndex < totalBlocks) {
            setShowSwipeOverlay(false);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, totalBlocks]);

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
        if (!currentBlock) return <div className="text-slate-400 mt-20 text-center">Loading...</div>;

        const type = currentBlock.type.toLowerCase();
        const commonProps = {
            data: currentBlock.content,
            onCorrect: handleBlockCorrect,
            onComplete: goToNextBlock,
            onNext: handleBlockCorrect,
            settings: { playTTS }
        };

        switch (type) {
            case 'teaching': return <TeachingBlock {...commonProps} />;
            case 'word_study': return <WordStudyBlock {...commonProps} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goToNextBlock} />;
            case 'dialogue_cinematic': return <DuiHua {...commonProps} onComplete={goToNextBlock} />;
            case 'choice':
                const choiceProps = { ...commonProps, question: { text: commonProps.data.prompt, ...commonProps.data }, options: commonProps.data.choices || [], correctAnswer: commonProps.data.correctId ? [commonProps.data.correctId] : [] };
                return <XuanZeTi {...choiceProps} />;
            case 'image_match_blanks': return <TianKongTi {...commonProps.data} onCorrect={handleBlockCorrect} onNext={handleBlockCorrect} />;
            case 'lianxian':
                const pairs = commonProps.data.pairs || [];
                const answerMap = pairs.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <LianXianTi title={commonProps.data.prompt} columnA={pairs.map(p => ({ id: p.id, content: p.left }))} columnB={pairs.map(p => ({ id: `${p.id}_b`, content: p.right })).sort(() => Math.random() - 0.5)} pairs={answerMap} onCorrect={handleBlockCorrect} />;
            case 'paixu': return <PaiXuTi title={commonProps.data.prompt} items={commonProps.data.items} correctOrder={[...(commonProps.data.items || [])].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={handleBlockCorrect} />;
            case 'panduan': return <PanDuanTi {...commonProps} />;
            case 'gaicuo': return <GaiCuoTi {...commonProps} />;
            case 'complete': case 'end': return <CompletionBlock data={commonProps.data} router={router} />;
            default: return <UnknownBlockHandler type={type} onSkip={goToNextBlock} />;
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col overflow-hidden font-sans">
            
            {/* 顶部进度条 (保留在顶部) */}
            {currentIndex < totalBlocks && (
                <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top">
                    <div className="h-1 bg-gray-200 w-full">
                        <div className="h-full bg-blue-500 transition-all duration-500 ease-out" style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* 主内容 */}
            <div className="flex-1 w-full h-full relative">
                {renderBlock()}
            </div>

            {/* 页码指示器 - 移到底部居中 */}
            {currentIndex < totalBlocks && (
                <div 
                    onClick={() => setIsJumping(true)} 
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-slate-200/80 backdrop-blur-md text-xs font-bold text-slate-500 rounded-full cursor-pointer hover:bg-slate-300 transition-colors"
                >
                    {currentIndex + 1} / {totalBlocks}
                </div>
            )}

            {/* 手势浮层 */}
            <SwipeOverlay isVisible={showSwipeOverlay} onNext={goToNextBlock} />

            {/* 跳转弹窗 */}
            {isJumping && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setIsJumping(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-lg shadow-xl w-64">
                        <h3 className="text-lg font-bold mb-4">跳转页面</h3>
                        <input type="number" className="w-full border p-2 rounded mb-4" placeholder={`1 - ${totalBlocks}`} value={jumpValue} onChange={e => setJumpValue(e.target.value)} />
                        <button onClick={(e) => { e.preventDefault(); const p = parseInt(jumpValue); if(p > 0 && p <= totalBlocks) { setCurrentIndex(p-1); setIsJumping(false); } }} className="w-full bg-blue-500 text-white py-2 rounded">Go</button>
                    </div>
                </div>
            )}
        </div>
    );
}
