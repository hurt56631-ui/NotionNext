import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave, HiArrowLeft, HiArrowRight, HiArrowsPointingOut, HiArrowsPointingIn } from "react-icons/hi2";
import confetti from 'canvas-confetti';

// --- 1. 导入子组件 (保持路径正确) ---
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

// --- 3. 页面组件 (样式微调以适应全屏) ---

// [TeachingBlock]
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in relative z-10">
            {data.pinyin && <p className="text-xl text-slate-500 mb-4 font-medium tracking-wider">{data.pinyin}</p>}
            <h1 className="text-5xl md:text-6xl font-black text-slate-800 mb-8 drop-shadow-sm leading-tight">{data.displayText}</h1>
            
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="mb-10 p-4 bg-white/90 text-blue-600 rounded-full shadow-lg border border-white/50 backdrop-blur-md active:scale-95 transition-transform hover:bg-blue-50">
                <HiSpeakerWave className="w-8 h-8" /> 
            </button>

            {data.translation && (
                <div className="bg-white/70 px-6 py-5 rounded-2xl backdrop-blur-md border border-white/40 shadow-sm max-w-lg">
                    <p className="text-xl text-slate-700 font-medium">{data.translation}</p>
                </div>
            )}
        </div>
    );
};

// [WordStudyBlock]
const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full h-full flex flex-col p-4 pt-12 overflow-y-auto pb-32">
            <div className="text-center shrink-0 mb-6">
                <h2 className="text-3xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                {data.words && data.words.map((word) => (
                    <div key={word.id} onClick={(e) => { e.stopPropagation(); playTTS(word.chinese, 'zh', word.rate || 0); }} 
                         className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-sm border border-white/50 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer hover:shadow-md">
                        <span className="text-sm text-slate-400 mb-1 font-mono">{word.pinyin}</span>
                        <span className="text-2xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                        <span className="text-blue-600 text-sm font-medium">{word.translation}</span>
                    </div>
                ))}
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
        <div className="w-full h-full flex flex-col items-center justify-center text-center z-10 relative">
            <div className="text-8xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-4xl font-black text-slate-800">{data.title || "完成！"}</h2>
            <p className="text-slate-500 mt-4 text-lg">{data.text || "正在返回..."}</p>
        </div>
    );
};

// --- 4. 悬浮控制层 (Floating Controls) ---
const FullscreenControls = ({ currentIndex, total, isCompleted, onPrev, onNext, isFullscreen, toggleFullscreen }) => {
    // 进度计算
    const progress = Math.min(((currentIndex + 1) / total) * 100, 100);

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
            {/* 顶部渐变遮罩，防止文字看不清 */}
            <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-slate-900/20 via-slate-900/5 to-transparent -z-10" />

            {/* 进度条 (吸底) */}
            <div className="w-full h-1.5 bg-gray-200/30 backdrop-blur-sm">
                <div 
                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            {/* 按钮控制区域 */}
            <div className="flex items-center justify-between px-6 py-5 pb-safe-bottom w-full max-w-4xl mx-auto pointer-events-auto">
                
                {/* 左侧：上一页 */}
                <button 
                    onClick={onPrev} 
                    disabled={currentIndex === 0}
                    className={`p-4 rounded-full backdrop-blur-md border shadow-lg transition-all active:scale-90
                        ${currentIndex === 0 
                            ? 'bg-white/20 border-white/10 text-white/40 cursor-not-allowed' 
                            : 'bg-white/90 border-white/50 text-slate-700 hover:bg-white'}`}
                >
                    <HiArrowLeft className="w-6 h-6" />
                </button>

                {/* 中间：全屏开关 & 页码 */}
                <div className="flex flex-col items-center gap-1">
                    <button 
                        onClick={toggleFullscreen}
                        className="p-2 text-white/70 hover:text-white transition-colors active:scale-95"
                        title={isFullscreen ? "退出全屏" : "进入全屏"}
                    >
                        {isFullscreen ? <HiArrowsPointingIn className="w-6 h-6" /> : <HiArrowsPointingOut className="w-6 h-6" />}
                    </button>
                    <span className="text-[10px] font-bold text-white/80 tracking-widest drop-shadow-md">
                        {currentIndex + 1} / {total}
                    </span>
                </div>

                {/* 右侧：下一页 (主要操作) */}
                <button 
                    onClick={onNext}
                    disabled={!isCompleted && currentIndex < total}
                    className={`flex items-center gap-2 px-6 py-4 rounded-full font-bold shadow-xl transition-all active:scale-95 border
                        ${!isCompleted 
                            ? 'bg-black/30 border-white/10 text-white/50 cursor-not-allowed backdrop-blur-sm' 
                            : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-blue-500/30'}`}
                >
                    <span className="text-lg">{currentIndex === total - 1 ? "完成" : "下一页"}</span>
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
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    const containerRef = useRef(null);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const currentBlock = blocks[currentIndex] || null;

    // --- 全屏 API 逻辑 ---
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    // 监听全屏变化（比如用户按 ESC 退出）
    useEffect(() => {
        const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleChange);
        return () => document.removeEventListener('fullscreenchange', handleChange);
    }, []);

    // --- 页面切换逻辑 ---
    useEffect(() => {
        if (!currentBlock) return;
        
        // 切页时重置滚动
        if (containerRef.current) containerRef.current.scrollTop = 0;

        const type = currentBlock.type.toLowerCase();
        // 自动解锁列表
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
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

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setIsBlockCompleted(true);
            setCurrentIndex(p => p - 1);
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
        setIsBlockCompleted(true);
    }, []);

    // 渲染题目组件
    const renderBlock = () => {
        if (!currentBlock) return null;
        if (currentIndex >= blocks.length) return <CompletionBlock data={{}} router={router} />;

        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: handleCorrect,
            onComplete: handleCorrect,
            onNext: handleCorrect,
            settings: { playTTS }
        };

        const FullScreenContainer = ({ children }) => (
            // 增加 pb-32 保证内容底部不被悬浮按钮遮挡
            <div className="w-full min-h-full flex flex-col items-center justify-center pb-32 animate-fade-in">
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
                return <FullScreenContainer><XuanZeTi {...choiceProps} /></FullScreenContainer>;
            
            case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={handleCorrect} />;
            
            case 'lianxian':
                const lp = props.data.pairs || [];
                const ansMap = lp.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <FullScreenContainer><LianXianTi title={props.data.prompt} columnA={lp.map(p => ({id:p.id,content:p.left}))} columnB={lp.map(p => ({id:`${p.id}_b`,content:p.right})).sort(()=>Math.random()-0.5)} pairs={ansMap} onCorrect={handleCorrect} /></FullScreenContainer>;
            
            case 'paixu': 
                return <FullScreenContainer><PaiXuTi title={props.data.prompt} items={props.data.items} correctOrder={[...(props.data.items||[])].sort((a,b)=>a.order-b.order).map(i=>i.id)} onCorrect={handleCorrect} /></FullScreenContainer>;
            
            case 'panduan': return <FullScreenContainer><PanDuanTi {...props} /></FullScreenContainer>;
            case 'gaicuo': return <FullScreenContainer><GaiCuoTi {...props} /></FullScreenContainer>;
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <div>Unknown {type}</div>;
        }
    };

    return (
        // 关键点：使用 h-[100dvh] 强制使用动态视口高度，解决移动端地址栏问题
        <div className="fixed inset-0 w-screen h-[100dvh] bg-[#F0F4F8] text-slate-800 font-sans overflow-hidden">
            
            {/* 背景装饰 (可选) */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50/50 -z-10" />

            {/* 内容滚动区域 */}
            <div 
                ref={containerRef}
                className="w-full h-full overflow-y-auto overflow-x-hidden scroll-smooth"
            >
                {renderBlock()}
            </div>

            {/* 悬浮控制层 (始终显示在最上层) */}
            {currentIndex < blocks.length && (
                <FullscreenControls 
                    currentIndex={currentIndex}
                    total={blocks.length}
                    isCompleted={isBlockCompleted}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                />
            )}
        </div>
    );
}
