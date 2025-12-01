import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave, HiArrowLeft, HiArrowRight } from "react-icons/hi2"; // 引入箭头图标
import confetti from 'canvas-confetti';

// --- 1. 导入子组件 (保持不变) ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. TTS 语音模块 (保持不变) ---
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

// --- 3. 页面组件 (去除了手势提示) ---

// [TeachingBlock] 首页 - 去除上滑提示
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center pb-10 px-6 text-center select-none relative animate-fade-in">
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
            
            {/* 移除了原本底部的 animate-pulse 上滑提示 */}
        </div>
    );
};

// [WordStudyBlock] 生词 - 去除上滑提示
const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full min-h-full flex flex-col p-4 pb-10">
            <div className="py-8 text-center shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
                <p className="text-slate-400 text-xs mt-2">点击发音</p>
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
            {/* 移除了底部的继续上滑提示 */}
        </div>
    );
};

// [CompletionBlock] (保持不变)
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

// --- 4. 底部导航栏组件 (新增) ---
const BottomNavBar = ({ currentIndex, total, isCompleted, onPrev, onNext }) => {
    // 进度条计算
    const progress = Math.min(((currentIndex + 1) / total) * 100, 100);

    return (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 z-50 px-4 py-3 pb-safe-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {/* 进度条显示在按钮上方 */}
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
                <div 
                    className="h-full bg-blue-500 transition-all duration-300" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            <div className="flex items-center justify-between max-w-3xl mx-auto pt-2">
                {/* 上一页按钮 */}
                <button 
                    onClick={onPrev} 
                    disabled={currentIndex === 0}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg font-medium transition-colors
                        ${currentIndex === 0 
                            ? 'text-slate-300 cursor-not-allowed' 
                            : 'text-slate-600 hover:bg-slate-100 active:scale-95'}`}
                >
                    <HiArrowLeft className="w-5 h-5" />
                    <span>上一页</span>
                </button>

                {/* 页码指示器 */}
                <span className="text-xs font-bold text-slate-300 select-none">
                    {currentIndex + 1} / {total}
                </span>

                {/* 下一页按钮 */}
                <button 
                    onClick={onNext}
                    disabled={!isCompleted && currentIndex < total}
                    className={`flex items-center space-x-1 px-6 py-2 rounded-lg font-bold shadow-sm transition-all
                        ${!isCompleted 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 shadow-blue-200'}`}
                >
                    <span>{currentIndex === total - 1 ? "完成" : "下一页"}</span>
                    <HiArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};


// --- 5. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    // 引用容器以便切页时滚回顶部
    const containerRef = useRef(null);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // --- 页面切换副作用 ---
    useEffect(() => {
        if (!currentBlock) return;

        // 切页时，滚动到顶部
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }

        const type = currentBlock.type.toLowerCase();
        // 自动解锁的页面类型
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        // 自动读题
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    // --- 导航逻辑 ---
    const handleNext = useCallback(() => {
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            // 往回翻时，默认直接设为已完成，防止回看时卡住
            setIsBlockCompleted(true);
            setCurrentIndex(p => p - 1);
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

    // 题目完成后的回调（以前是自动下一页，现在可以是仅仅解锁，或者解锁+提示）
    const onQuestionComplete = () => {
        handleCorrect();
        // 如果想做完题自动跳下一页，可以解开下面这行注释：
        // setTimeout(handleNext, 1000); 
    };

    const renderBlock = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} router={router} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: onQuestionComplete, // 统一处理
            onNext: handleCorrect,
            settings: { playTTS }
        };

        const QuizContainer = ({ children }) => (
            <div className="w-full min-h-full flex flex-col items-center justify-center animate-fade-in">
                {children}
            </div>
        );

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={handleCorrect} />;
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={handleCorrect} />;
            
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
            className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans"
        >
            {/* 主内容区域 - 增加了 pb-24 防止被底部按钮遮挡 */}
            <div 
                ref={containerRef}
                className="flex-1 w-full overflow-y-auto overflow-x-hidden pb-24"
            >
                {renderBlock()}
            </div>

            {/* 底部导航栏 (仅在非结束页显示) */}
            {currentIndex < blocks.length && (
                <BottomNavBar 
                    currentIndex={currentIndex}
                    total={blocks.length}
                    isCompleted={isBlockCompleted}
                    onPrev={handlePrev}
                    onNext={handleNext}
                />
            )}
        </div>
    );
}
