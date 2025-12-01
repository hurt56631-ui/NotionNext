// components/InteractiveLesson.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronLeft, FaChevronRight, FaCheck } from "react-icons/fa"; // 引入图标
import confetti from 'canvas-confetti';
import dynamic from 'next/dynamic';

// --- 1. 动态导入子组件 (确保路径正确指向 Tixing) ---
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

// --- 3. 页面组件 (已清理上滑提示) ---

// [TeachingBlock] 首页
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center pb-20 px-6 text-center select-none relative animate-fade-in">
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
            
            {/* 已移除底部上滑箭头 */}
        </div>
    );
};

// [WordStudyBlock] 生词 - 滚动式布局
const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full min-h-full flex flex-col p-4 pb-24">
            <div className="py-8 text-center shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课学习"}</h2>
                <p className="text-slate-400 text-xs mt-2">点击发音</p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto w-full shrink-0">
                {data.words && data.words.map((word) => (
                    <div key={word.id} onClick={(e) => { e.stopPropagation(); playTTS(word.chinese, 'zh', word.rate || 0); }} 
                         className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer">
                        {word.pinyin && <span className="text-xs text-slate-400 mb-1 font-mono">{word.pinyin}</span>}
                        <span className="text-xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                        <span className="text-blue-500 text-sm font-medium">{word.translation}</span>
                        {word.example && <div className="mt-3 pt-3 border-t border-slate-50 w-full text-xs text-slate-400 text-left leading-relaxed">{word.example}</div>}
                    </div>
                ))}
            </div>
            {/* 已移除底部提示 */}
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
        <div className="w-full h-full flex flex-col items-center justify-center text-center pb-20">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-2">{data.text || "正在返回..."}</p>
        </div>
    );
};

// --- 4. 新增：底部导航栏组件 ---
const BottomNavigation = ({ currentIndex, total, isCompleted, onPrev, onNext }) => {
    return (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-safe-bottom z-50 flex items-center justify-between shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
            {/* 上一页按钮 */}
            <button 
                onClick={onPrev}
                disabled={currentIndex === 0}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    currentIndex === 0 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                }`}
            >
                <FaChevronLeft />
                <span>上一页</span>
            </button>

            {/* 页码 */}
            <div className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                {currentIndex + 1} / {total}
            </div>

            {/* 下一页按钮 */}
            <button 
                onClick={onNext}
                disabled={!isCompleted}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-md transition-all transform active:scale-95 ${
                    isCompleted 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
                <span>下一页</span>
                {isCompleted ? <FaChevronRight /> : <span className="text-xs ml-1 opacity-50">(未完成)</span>}
            </button>
        </div>
    );
};

// --- 5. 主逻辑组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isBlockCompleted, setIsBlockCompleted] = useState(false);
    
    // containerRef 用于处理内部滚动
    const containerRef = useRef(null);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    useEffect(() => {
        // 恢复默认滚动行为
        document.body.style.overscrollBehaviorY = 'auto';
        return () => { if (currentAudio) { currentAudio.pause(); currentAudio = null; } };
    }, []);

    useEffect(() => {
        if (!currentBlock) return;
        const type = currentBlock.type.toLowerCase();
        // 自动解锁的类型
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        // 自动读题
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    // 下一页逻辑
    const handleNext = useCallback(() => {
        if (!isBlockCompleted) return; // 再次校验
        if (currentIndex < blocks.length) {
            setCurrentIndex(p => p + 1);
        }
    }, [currentIndex, blocks.length, isBlockCompleted]);

    // 上一页逻辑
    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(p => p - 1);
            // 切回上一页时，默认该页已完成（因为之前肯定做过了）
            setIsBlockCompleted(true); 
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

    const renderBlock = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: handleNext, // 某些自动完成的组件调用这个
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
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} />;
            default: return <div>Unknown Type: {type}</div>;
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans">
            
            {/* 顶部进度条 */}
            {currentIndex < blocks.length && (
                <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top pointer-events-none">
                    <div className="h-1 bg-gray-200 w-full">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / blocks.length) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* 主内容区域 (padding-bottom 留出底部栏空间) */}
            <div 
                ref={containerRef}
                className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden pb-24"
            >
                {renderBlock()}
            </div>

            {/* 底部导航栏 (替代原来的手势) */}
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
