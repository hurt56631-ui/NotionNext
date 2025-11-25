import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
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

// --- 3. 手势 Hook (复用 DuiHua 逻辑) ---
// 允许传入 dependencies 来决定是否启用手势
const useSwipeGesture = (onSwipeUp, isEnabled = true) => {
    const [bind, setBind] = useState(() => () => ({}));
    
    useEffect(() => {
        let mounted = true;
        // 动态导入，避免 SSR 报错
        import('@use-gesture/react').then(({ useDrag }) => {
            if (!mounted) return;
            const bindFn = useDrag(({ swipe: [, swipeY], down, event }) => {
                // 关键逻辑：只有当 isEnabled 为 true 且 向上滑动(swipeY === -1) 时触发
                if (isEnabled && !down && swipeY === -1) {
                    onSwipeUp();
                }
            }, { 
                axis: 'y', 
                filterTaps: true, 
                preventDefault: false // 这里设为 false，允许内部元素的默认滚动
            });
            setBind(() => bindFn);
        });
        return () => { mounted = false; };
    }, [onSwipeUp, isEnabled]);

    return bind;
};

// --- 4. 底部上滑提示浮层 (风格统一) ---
const SwipeOverlay = ({ isVisible, onNext }) => {
    // 浮层本身也绑定手势，防止用户点在浮层上滑不动
    const bind = useSwipeGesture(onNext, isVisible);

    if (!isVisible) return null;

    return (
        <div {...bind()} 
             onClick={onNext}
             className="fixed bottom-0 left-0 w-full h-48 z-50 flex flex-col items-center justify-end pb-12 bg-gradient-to-t from-gray-100/90 via-gray-100/60 to-transparent cursor-pointer pointer-events-auto animate-fade-in"
             style={{ touchAction: 'pan-y' }}
        >
            <style>{`
                @keyframes bounce-up-light {
                    0%, 100% { transform: translateY(0); opacity: 1; }
                    50% { transform: translateY(-15px); opacity: 0.7; }
                }
                .animate-bounce-up-light { animation: bounce-up-light 2s infinite ease-in-out; }
            `}</style>
            
            <div className="flex flex-col items-center animate-bounce-up-light">
                {/* 使用 DuiHua 同款 SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#3b82f6" style={{ width: '2.5rem', height: '2.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                <span className="text-blue-500 font-bold text-sm mt-2 tracking-widest">上滑继续</span>
            </div>
        </div>
    );
};

// --- 5. 页面组件 ---

// [TeachingBlock] 首页
const TeachingBlock = ({ data, onComplete }) => {
    // 首页始终允许上滑
    const bind = useSwipeGesture(onComplete, true);

    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-center pb-24 px-6 text-center cursor-pointer select-none relative">
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
            
            {/* 静态提示，因为这是第一页 */}
            <div className="absolute bottom-16 opacity-40 flex flex-col items-center animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
                <span className="text-xs mt-1">上滑开始</span>
            </div>
        </div>
    );
};

// [WordStudyBlock] 生词 - 标题随动消失
const WordStudyBlock = ({ data, onComplete }) => {
    // 始终允许手势，但手势库会处理滚动冲突
    const bind = useSwipeGesture(onComplete, true);
    
    return (
        <div {...bind()} className="w-full h-full bg-[#F5F7FA] relative overflow-y-auto">
            <div className="min-h-full flex flex-col p-4 pb-32">
                
                {/* 标题放在滚动流内部，上滑即消失 */}
                <div className="py-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
                    <p className="text-slate-400 text-xs mt-2">点击发音，上滑继续</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto w-full">
                    {data.words && data.words.map((word) => (
                        <div key={word.id} onClick={() => playTTS(word.chinese, 'zh', word.rate || 0)} 
                             className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer">
                            <span className="text-xs text-slate-400 mb-1 font-mono">{word.pinyin}</span>
                            <span className="text-2xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                            <span className="text-blue-500 text-sm font-medium">{word.translation}</span>
                            {word.example && <div className="mt-3 pt-3 border-t border-slate-50 w-full text-xs text-slate-400 text-left leading-relaxed">{word.example}</div>}
                        </div>
                    ))}
                </div>
                
                {/* 底部占位，提示上滑 */}
                <div className="mt-8 text-center opacity-30">
                    <div className="w-1 h-8 bg-slate-300 mx-auto rounded-full mb-2"></div>
                    <span className="text-xs">继续上滑</span>
                </div>
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
        <div className="w-full h-full flex flex-col items-center justify-center text-center bg-[#F5F7FA]">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-2">{data.text || "正在返回..."}</p>
        </div>
    );
};

// --- 6. 主逻辑 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    
    // 核心状态：当前块是否已完成（做对题后变为 true）
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // 全局防抖和样式锁定 (复用 DuiHua 逻辑)
    useEffect(() => {
        // 禁止橡皮筋效果
        document.body.style.overscrollBehaviorY = 'contain';
        const preventPullToRefresh = (e) => {
             // 只有在非滚动区域才阻止默认行为，这里简化处理，防止顶部下拉
             if (window.scrollY === 0 && e.touches[0].clientY > 0 && e.cancelable) {
                 // e.preventDefault(); // 注：全局阻止可能影响内部滚动，最好只依赖 overscrollBehaviorY
             }
        };
        // document.body.addEventListener('touchmove', preventPullToRefresh, { passive: false });

        return () => {
            document.body.style.overscrollBehaviorY = 'auto';
            // document.body.removeEventListener('touchmove', preventPullToRefresh);
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        };
    }, []);

    // 切换页面时重置状态
    useEffect(() => {
        if (!currentBlock) return;
        
        // 如果是教学页、生词页、语法页、对话页 -> 默认视为“已完成”，允许随时上滑
        // 如果是题目页 (Choice, Paxu, etc) -> 设为 false，做对后才 true
        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        // 自动朗读题目
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            // 延迟一点播放，体验更好
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    const handleNext = useCallback(() => {
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length]);

    // 题目做对回调
    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true); // 解锁上滑
    }, []);

    // 主容器手势：只有当 isBlockCompleted 为 true 时，才响应上滑翻页
    const bindMain = useSwipeGesture(handleNext, isBlockCompleted);

    const renderBlock = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} router={router} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,   // 题目做对 -> 解锁
            onComplete: handleNext,     // 非题目页 -> 直接下一页
            onNext: handleCorrect,      // 兼容旧接口
            settings: { playTTS }
        };

        // 统一容器样式：居中偏上
        const QuizContainer = ({ children }) => (
            <div className="w-full h-full flex flex-col items-center justify-center pb-20 px-4">
                {children}
            </div>
        );

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={handleNext} />;
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={handleNext} />;
            
            // 题目组件包裹在 QuizContainer 中
            case 'choice': 
                const choiceProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices||[], correctAnswer: props.data.correctId?[props.data.correctId]:[] };
                return <QuizContainer><XuanZeTi {...choiceProps} /></QuizContainer>;
            
            case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={handleCorrect} />;
            
            case 'lianxian':
                const lianxianPairs = props.data.pairs || [];
                const colA = lianxianPairs.map(p => ({ id: p.id, content: p.left }));
                const colB = lianxianPairs.map(p => ({ id: `${p.id}_b`, content: p.right })).sort(() => Math.random() - 0.5);
                const ansMap = lianxianPairs.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <QuizContainer><LianXianTi title={props.data.prompt} columnA={colA} columnB={colB} pairs={ansMap} onCorrect={handleCorrect} /></QuizContainer>;
            
            case 'paixu': 
                return <QuizContainer><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...(props.data.items||[])].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={handleCorrect} /></QuizContainer>;
            
            case 'panduan': return <QuizContainer><PanDuanTi {...props} /></QuizContainer>;
            case 'gaicuo': return <QuizContainer><GaiCuoTi {...props} /></QuizContainer>;
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <div>未知题型 {type}</div>;
        }
    };

    return (
        <div 
            {...bindMain()} // 绑定全局手势
            className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans"
            style={{ touchAction: 'pan-y' }} // 允许垂直滚动，禁止左右滑导致的历史记录回退
        >
            {/* 顶部进度条 */}
            {currentIndex < blocks.length && (
                <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top">
                    <div className="h-1 bg-gray-200 w-full">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / blocks.length) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* 主内容区域 */}
            <div className="flex-1 w-full h-full relative overflow-hidden">
                {renderBlock()}
            </div>

            {/* 页码指示器 - 底部居中 */}
            {currentIndex < blocks.length && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-slate-200/60 backdrop-blur-md text-[10px] font-bold text-slate-400 rounded-full select-none">
                    {currentIndex + 1} / {blocks.length}
                </div>
            )}

            {/* 上滑提示 - 只有 isBlockCompleted 为 true 时显示 */}
            <SwipeOverlay isVisible={isBlockCompleted} onNext={handleNext} />
        </div>
    );
                }
