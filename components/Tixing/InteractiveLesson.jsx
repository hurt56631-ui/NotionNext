import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa"; 
import confetti from 'canvas-confetti';
import dynamic from 'next/dynamic';

// --- 1. 动态导入子组件 ---
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false });
const TianKongTi = dynamic(() => import('@/components/Tixing/TianKongTi'), { ssr: false });
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });

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

// [TeachingBlock]
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center pb-24 px-6 text-center select-none relative animate-fade-in">
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-5 drop-shadow-sm leading-tight">{data.displayText}</h1>
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} className="mb-8 p-3 bg-white text-blue-500 rounded-full shadow-md border border-blue-50 active:scale-95 transition-transform"><HiSpeakerWave className="w-6 h-6" /></button>
            {data.translation && (<div className="bg-white/60 px-5 py-4 rounded-xl backdrop-blur-sm border border-slate-100/50"><p className="text-lg text-slate-600 font-medium">{data.translation}</p></div>)}
        </div>
    );
};

// [WordStudyBlock]
const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full min-h-full flex flex-col p-4 pb-32">
            <div className="py-8 text-center shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课学习"}</h2>
                <p className="text-slate-400 text-xs mt-2">点击卡片发音</p>
            </div>
            <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto w-full shrink-0">
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

// [CompletionBlock]
const CompletionBlock = ({ data }) => {
    useEffect(() => {
        playTTS(data.title || "恭喜", 'zh');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }, []);
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center pb-24">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-2">{data.text || "正在返回..."}</p>
        </div>
    );
};

// --- 4. 底部悬浮导航栏 (Floating Navigation) ---
const BottomNavigation = ({ currentIndex, total, isCompleted, onPrev, onNext }) => {
    const progress = Math.min(100, Math.round(((currentIndex + 1) / total) * 100));

    return (
        // pointer-events-none 允许点击穿透空白区域
        <div className="fixed bottom-0 left-0 w-full p-5 pb-8 z-[300] flex items-center justify-between pointer-events-none">
            
            {/* 上一页 (左下角小圆钮) */}
            <button 
                onClick={onPrev}
                disabled={currentIndex === 0}
                className={`pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 ${
                    currentIndex === 0 
                    ? 'opacity-0 scale-50 cursor-not-allowed' // 第一页时完全隐藏
                    : 'bg-white text-slate-500 hover:bg-gray-50 active:scale-90 opacity-100 scale-100'
                }`}
            >
                <FaChevronLeft size={18} />
            </button>

            {/* 中间页码胶囊 */}
            <div className="pointer-events-auto flex flex-col items-center justify-center px-4 py-1.5 bg-white/80 backdrop-blur-md rounded-full shadow-sm border border-white/50 transition-opacity duration-300">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                    {currentIndex + 1} / {total}
                </span>
                {/* 迷你进度条 */}
                <div className="w-12 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* 下一页 (右下角大按钮) */}
            <button 
                onClick={onNext}
                disabled={!isCompleted}
                className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-xl transition-all duration-300 transform ${
                    isCompleted 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/30 translate-y-0 opacity-100 active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed translate-y-8 opacity-0' // 未完成时下沉隐藏
                }`}
            >
                <span>下一页</span>
                <FaChevronRight size={14} />
            </button>
        </div>
    );
};

// --- 5. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    const containerRef = useRef(null);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    useEffect(() => {
        document.body.style.overscrollBehaviorY = 'auto';
        return () => { if (currentAudio) { currentAudio.pause(); currentAudio = null; } };
    }, []);

    // 切换页面时重置状态
    useEffect(() => {
        if (!currentBlock) return;
        
        if (containerRef.current) containerRef.current.scrollTop = 0;

        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            setTimeout(() => playTTS(currentBlock.content.narrationScript || currentBlock.content.narrationText, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    const handleNext = useCallback(() => {
        if (!isBlockCompleted) return;
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length, isBlockCompleted]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(p => p - 1);
            setIsBlockCompleted(true); 
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

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

        // 居中容器 (min-h-full)
        const QuizContainer = ({ children }) => (
            <div className="w-full min-h-full flex flex-col items-center justify-center py-10 px-4 animate-fade-in">
                {children}
            </div>
        );

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            
            case 'grammar_study': 
                return (
                    <GrammarPointPlayer 
                        grammarPoints={props.data.grammarPoints} 
                        onComplete={() => setIsBlockCompleted(true)} 
                    />
                );
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={() => setIsBlockCompleted(true)} />;
            
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
            default: return <div className="p-10 text-center text-gray-400">未知类型: {type}</div>;
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans">
            
            {/* 主内容区域 */}
            <div 
                ref={containerRef}
                // ✅ 保留 pb-32，但因为底部导航是透明悬浮的，视觉上内容可以透过按钮看到
                className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden pb-32"
            >
                {renderBlock()}
            </div>

            {/* 悬浮底部导航栏 */}
            <BottomNavigation 
                currentIndex={currentIndex}
                total={blocks.length}
                isCompleted={isBlockCompleted}
                onPrev={handlePrev}
                onNext={handleNext}
            />
        </div>
    );
}
