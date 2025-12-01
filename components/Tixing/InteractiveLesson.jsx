import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave, HiArrowLeft, HiArrowRight, HiCheck } from "react-icons/hi2";
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

// --- 2. TTS 工具 (保持不变) ---
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

// --- 3. 基础展示组件 (保持不变) ---
const TeachingBlock = ({ data }) => {
    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);
    return (
        <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
            {data.pinyin && <p className="text-lg text-slate-500 mb-2 font-medium">{data.pinyin}</p>}
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-6 leading-tight">{data.displayText}</h1>
            <button onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="p-4 bg-white text-blue-500 rounded-full shadow-lg shadow-blue-100 border border-slate-50 active:scale-95 mb-8 hover:bg-blue-50 transition-colors">
                <HiSpeakerWave className="w-8 h-8" /> 
            </button>
            {data.translation && (
                <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl border border-slate-200/60 text-slate-600 font-medium shadow-sm">
                    {data.translation}
                </div>
            )}
        </div>
    );
};

const WordStudyBlock = ({ data }) => {
    return (
        <div className="w-full flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">{data.title || "本课生词"}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {data.words && data.words.map((word) => (
                    <button key={word.id} onClick={() => playTTS(word.chinese, 'zh')} 
                         className="bg-white rounded-xl p-4 shadow-sm border-b-4 border-slate-100 active:border-b-0 active:translate-y-[4px] hover:bg-blue-50/50 transition-all flex flex-col items-center text-center">
                        <span className="text-xs text-slate-400 mb-1">{word.pinyin}</span>
                        <span className="text-xl font-bold text-slate-800">{word.chinese}</span>
                        <span className="text-blue-500 text-sm mt-1">{word.translation}</span>
                    </button>
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
        <div className="flex flex-col items-center justify-center py-10">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-slate-800">课程完成！</h2>
            <p className="text-slate-500 mt-2">即将返回主页...</p>
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
        window.scrollTo(0, 0); // 确保切题时回到顶部

        const type = currentBlock.type.toLowerCase();
        const autoUnlockTypes = ['teaching', 'word_study', 'grammar_study', 'dialogue_cinematic', 'end', 'complete'];
        setIsBlockCompleted(autoUnlockTypes.includes(type));
        
        if (currentBlock.content && (currentBlock.content.narrationScript || currentBlock.content.narrationText)) {
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText;
            setTimeout(() => playTTS(text, 'zh'), 600);
        }
    }, [currentIndex, currentBlock]);

    const handleNext = useCallback(() => {
        if (currentIndex < blocks.length) setCurrentIndex(p => p + 1);
    }, [currentIndex, blocks.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setIsBlockCompleted(true);
            setCurrentIndex(p => p - 1);
        }
    }, [currentIndex]);

    const handleCorrect = useCallback(() => {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 }, disableForReducedMotion: true });
        setIsBlockCompleted(true);
    }, []);

    const renderContent = () => {
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

        // 这里的组件本身只需要负责渲染内容，外部容器负责位置
        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study': return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={handleCorrect} />;
            case 'dialogue_cinematic': return <DuiHua {...props} onComplete={handleCorrect} />;
            case 'choice': 
                return <XuanZeTi {...props} question={{ text: props.data.prompt, ...props.data }} options={props.data.choices||[]} correctAnswer={props.data.correctId?[props.data.correctId]:[]} />;
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
            default: return <div className="text-slate-400">暂不支持的题型: {type}</div>;
        }
    };

    const progress = Math.min(((currentIndex + 1) / blocks.length) * 100, 100);

    return (
        // 1. 外层容器：全屏高度 (min-h-[100dvh])，Flex列布局
        <div className="min-h-[100dvh] w-full bg-[#F5F7FA] text-slate-800 flex flex-col font-sans overflow-x-hidden">
            
            {/* 顶部进度条 */}
            <div className="w-full h-1.5 bg-slate-200 sticky top-0 z-50">
                <div 
                    className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                    style={{ width: `${progress}%` }} 
                />
            </div>

            {/* 2. 主布局区域：核心修改点 */}
            {/* flex-grow 让它占满除进度条外的空间 */}
            {/* justify-center 实现垂直居中 */}
            {/* pb-[15vh] 是关键！底部留出 15% 视口高度的空白，让内容视觉重心上移 */}
            <div className="flex-grow flex flex-col items-center justify-center w-full px-5 py-6 pb-[15vh]">
                
                {/* 内容限制宽度的容器 */}
                <div className="w-full max-w-2xl flex flex-col">
                    
                    {/* 题目展示区 */}
                    <div className="w-full transition-all duration-300">
                        {renderContent()}
                    </div>

                    {/* 3. 底部按钮区 (跟随在内容下方) */}
                    {currentIndex < blocks.length && (
                        <div className="w-full mt-10 md:mt-14 flex items-center justify-between gap-4 animate-in fade-in duration-700 slide-in-from-bottom-2">
                            
                            {/* 上一题 (淡入淡出处理) */}
                            <button 
                                onClick={handlePrev} 
                                disabled={currentIndex === 0}
                                className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full border transition-all duration-300
                                    ${currentIndex === 0 
                                        ? 'border-transparent text-transparent cursor-default scale-0' 
                                        : 'border-slate-200 text-slate-400 bg-white hover:bg-slate-50 hover:text-slate-600 shadow-sm'}`}
                            >
                                <HiArrowLeft className="w-5 h-5" />
                            </button>

                            {/* 下一题 (主按钮) */}
                            <button 
                                onClick={handleNext}
                                disabled={!isBlockCompleted}
                                className={`flex-1 flex items-center justify-center space-x-2 h-14 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] transform
                                    ${!isBlockCompleted 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' // 锁定
                                        : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-blue-200/50 hover:-translate-y-0.5'}`} // 解锁
                            >
                                <span>{currentIndex === blocks.length - 1 ? "完成课程" : "下一题"}</span>
                                {isBlockCompleted && (
                                    currentIndex === blocks.length - 1 ? <HiCheck className="w-6 h-6"/> : <HiArrowRight className="w-5 h-5"/>
                                )}
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
