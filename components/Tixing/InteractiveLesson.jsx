// components/Tixing/InteractiveLesson.jsx (最终完美修复版)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
// 引入 confetti 撒花效果 (确保你安装了 canvas-confetti)
import confetti from 'canvas-confetti';

// --- 1. 导入所有子组件 ---
// 请确保这些路径是正确的
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 统一的 TTS (语音) 模块 ---
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
        // 使用你的 TTS 服务地址
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
            currentAudio = null;
            if (onEndCallback) onEndCallback();
        };
        audio.onerror = () => {
            console.error("TTS Playback failed");
            if (onEndCallback) onEndCallback();
        };
        await audio.play();
    } catch (e) {
        console.error("Audio play error:", e);
        if (onEndCallback) onEndCallback();
    }
};

const stopAllAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
};

// --- 3. 辅助 Hook: 安全使用手势 ---
// 解决 Next.js 服务端渲染时 require 报错的问题
const useSwipeGesture = (onSwipeUp) => {
    const [bind, setBind] = useState(() => () => ({}));
    
    useEffect(() => {
        let mounted = true;
        import('@use-gesture/react').then(({ useDrag }) => {
            if (!mounted) return;
            const bindFn = useDrag(({ swipe: [, swipeY], event }) => {
                // event.stopPropagation(); // 根据情况开启
                if (swipeY === -1) { // -1 表示向上滑动
                    onSwipeUp();
                }
            }, { 
                axis: 'y', 
                filterTaps: true, 
                preventDefault: false // 允许滚动，但在特定条件下触发
            });
            setBind(() => bindFn);
        });
        return () => { mounted = false; };
    }, [onSwipeUp]);

    return bind;
};

// --- 4. 新增组件：上滑继续浮层 (SwipeOverlay) ---
// 当题目做对时显示这个，拦截触摸事件用于翻页
const SwipeOverlay = ({ onNext, isVisible }) => {
    const bind = useSwipeGesture(onNext);
    
    if (!isVisible) return null;

    return (
        <div {...bind()} 
            onClick={onNext} // 点击也可以继续
            className="fixed bottom-0 left-0 w-full h-32 z-50 flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-gray-100/90 to-transparent cursor-pointer animate-fade-in"
        >
            <div className="flex flex-col items-center animate-bounce">
                <FaChevronUp className="text-blue-500 text-2xl" />
                <span className="text-blue-600 font-bold text-sm mt-1">上滑继续 / Swipe Up</span>
            </div>
        </div>
    );
};

// --- 5. 核心显示组件 ---

// [TeachingBlock] 首页：居中偏上，浅色背景
const TeachingBlock = ({ data, onComplete }) => {
    const bind = useSwipeGesture(onComplete);

    useEffect(() => {
        if (data.narrationScript) {
            setTimeout(() => playTTS(data.narrationScript, data.narrationLang || 'my'), 800);
        }
    }, [data]);

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-start pt-[15vh] px-6 text-center cursor-pointer relative">
            {/* 拼音 */}
            {data.pinyin && <p className="text-xl text-slate-500 mb-3 font-medium">{data.pinyin}</p>}
            
            {/* 大标题 */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-6 drop-shadow-sm">
                {data.displayText}
            </h1>
            
            {/* 播放按钮 */}
            <button 
                onClick={(e) => { e.stopPropagation(); playTTS(data.displayText, 'zh'); }} 
                className="mb-8 p-3 bg-white text-blue-500 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
                <HiSpeakerWave className="w-8 h-8" />
            </button>

            {/* 翻译 */}
            {data.translation && (
                <div className="bg-white/60 px-6 py-4 rounded-xl backdrop-blur-sm">
                    <p className="text-xl text-slate-600 font-medium leading-relaxed">{data.translation}</p>
                </div>
            )}
            
            {/* 底部提示 */}
            <div className="absolute bottom-12 left-0 w-full flex flex-col items-center opacity-60">
                <FaChevronUp className="h-6 w-6 text-slate-400 animate-bounce" />
                <span className="text-sm text-slate-400 mt-2">上滑开始学习</span>
            </div>
        </div>
    );
};

// [WordStudyBlock] 生词：全屏浅灰，白色卡片，布局优化
const WordStudyBlock = ({ data, onComplete }) => {
    const bind = useSwipeGesture(onComplete);

    return (
        <div {...bind()} className="w-full h-full flex flex-col bg-[#F5F7FA] relative overflow-hidden">
            {/* 顶部标题栏 */}
            <div className="pt-12 pb-4 px-6 text-center bg-white shadow-sm z-10">
                <h2 className="text-2xl font-bold text-slate-800">{data.title || "本课生词"}</h2>
                <p className="text-slate-400 text-sm mt-1">点击发音，上滑继续</p>
            </div>

            {/* 卡片滚动区 */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                    {data.words && data.words.map((word) => (
                        <div 
                            key={word.id}
                            onClick={() => playTTS(word.chinese, 'zh', word.rate || 0)}
                            className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-all flex flex-col items-center text-center cursor-pointer hover:shadow-md"
                        >
                            <span className="text-sm text-slate-400 mb-1 font-mono">{word.pinyin}</span>
                            <span className="text-3xl font-bold text-slate-800 mb-2">{word.chinese}</span>
                            <span className="text-blue-500 font-medium">{word.translation}</span>
                            {/* 如果有例句显示例句，增加卡片丰富度 */}
                            {word.example && (
                                <div className="mt-3 pt-3 border-t border-slate-50 w-full text-xs text-slate-400">
                                    {word.example}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                {/* 底部占位，防止最后一张卡片被遮挡 */}
                <div className="h-20 w-full flex items-center justify-center text-slate-300 text-sm mt-4">
                    <FaChevronUp className="animate-bounce mr-2"/> 继续浏览或上滑
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
        const timer = setTimeout(() => router.push('/'), 4000); // 4秒后返回
        return () => clearTimeout(timer);
    }, [data, router]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[#F5F7FA] text-slate-800">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-3xl font-bold mb-4">{data.title || "完成！"}</h2>
            <p className="text-lg text-slate-500">{data.text || "即将返回主页..."}</p>
        </div>
    );
};

// 错误处理占位符
const UnknownBlockHandler = ({ type, onSkip }) => (
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
        <p>暂不支持题型: {type}</p>
        <button onClick={onSkip} className="mt-4 text-blue-500 underline">跳过</button>
    </div>
);


// --- 6. 主逻辑组件 (InteractiveLesson) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    // 新增状态：是否显示上滑浮层 (用于拦截自动跳转)
    const [showSwipeOverlay, setShowSwipeOverlay] = useState(false);
    
    // 调试跳转用
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    // 初始化/重置音频
    useEffect(() => { 
        stopAllAudio(); 
        setShowSwipeOverlay(false); // 换题时隐藏浮层
    }, [currentIndex]);

    // 题目朗读 (如果有 narrationScript)
    useEffect(() => {
        if (!showSwipeOverlay && currentBlock && currentBlock.content) {
            // 优先读 script，其次 text，最后 prompt
            const text = currentBlock.content.narrationScript || currentBlock.content.narrationText; 
            if (text) {
                const timer = setTimeout(() => playTTS(text, 'zh'), 600);
                return () => clearTimeout(timer);
            }
        }
    }, [currentIndex, currentBlock, showSwipeOverlay]);

    // --- 关键逻辑：处理题目做对 ---
    const handleBlockCorrect = useCallback(() => {
        // 1. 撒花庆祝
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        
        // 2. 播放正确音效 (可选)
        // playCorrectSound(); 

        // 3. 不自动跳转，而是显示上滑浮层
        setShowSwipeOverlay(true); 
    }, []);

    // --- 关键逻辑：进入下一题 ---
    const goToNextBlock = useCallback(() => {
        if (currentIndex < totalBlocks) {
            setShowSwipeOverlay(false);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, totalBlocks]);

    // 渲染当前块
    const renderBlock = () => {
        if (currentIndex >= totalBlocks) {
            return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />;
        }
        
        if (!currentBlock) return <div className="text-slate-400 mt-20 text-center">Loading...</div>;

        const type = currentBlock.type.toLowerCase();
        // 传递给子组件的通用 Props
        const commonProps = {
            data: currentBlock.content,
            onCorrect: handleBlockCorrect, // 做对时 -> 显示浮层
            onComplete: goToNextBlock,     // 完成非题目页(如教学) -> 直接下一页
            onNext: handleBlockCorrect,    // 兼容部分组件命名
            settings: { playTTS }
        };

        switch (type) {
            case 'teaching': 
                return <TeachingBlock {...commonProps} />;
            
            case 'word_study': 
                return <WordStudyBlock {...commonProps} />;
            
            case 'grammar_study':
                // 语法页通常有自己的播放器，播放完调用 onComplete
                return <GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goToNextBlock} />;
            
            case 'dialogue_cinematic':
                // 对话页通常自带上滑逻辑，如果需要统一，可传入 onComplete
                return <DuiHua {...commonProps} onComplete={goToNextBlock} />;

            // --- 题目类组件 ---
            // 注意：这里假设你的子组件(XuanZeTi等)会在做对时调用 props.onCorrect 或 props.onNext
            case 'choice':
                // 适配逻辑：把 JSON 的 prompt 转为 question.text 传给组件
                const choiceProps = {
                    ...commonProps,
                    question: { text: commonProps.data.prompt, ...commonProps.data },
                    options: commonProps.data.choices || [],
                    correctAnswer: commonProps.data.correctId ? [commonProps.data.correctId] : []
                };
                return <XuanZeTi {...choiceProps} />;

            case 'image_match_blanks':
                return <TianKongTi {...commonProps.data} onCorrect={handleBlockCorrect} onNext={handleBlockCorrect} />;

            case 'lianxian':
                // 数据转换适配连线题
                const pairs = commonProps.data.pairs || [];
                const colA = pairs.map(p => ({ id: p.id, content: p.left }));
                const colB = pairs.map(p => ({ id: `${p.id}_b`, content: p.right })).sort(() => Math.random() - 0.5);
                const answerMap = pairs.reduce((acc, p) => ({ ...acc, [p.id]: `${p.id}_b` }), {});
                return <LianXianTi title={commonProps.data.prompt} columnA={colA} columnB={colB} pairs={answerMap} onCorrect={handleBlockCorrect} />;

            case 'paixu':
                // 数据转换适配排序题
                const correctOrder = [...(commonProps.data.items || [])].sort((a,b)=>a.order-b.order).map(i=>i.id);
                return <PaiXuTi title={commonProps.data.prompt} items={commonProps.data.items} correctOrder={correctOrder} onCorrect={handleBlockCorrect} />;

            case 'panduan': return <PanDuanTi {...commonProps} />;
            case 'gaicuo': return <GaiCuoTi {...commonProps} />;
            case 'complete': case 'end': return <CompletionBlock data={commonProps.data} router={router} />;
            
            default: return <UnknownBlockHandler type={type} onSkip={goToNextBlock} />;
        }
    };

    return (
        // 全局背景容器：浅灰色
        <div className="fixed inset-0 w-full h-full bg-[#F5F7FA] text-slate-800 flex flex-col overflow-hidden font-sans">
            
            {/* 顶部进度条 */}
            {currentIndex < totalBlocks && (
                <div className="fixed top-0 left-0 w-full z-40 bg-[#F5F7FA]/90 backdrop-blur-sm pt-safe-top">
                    <div className="h-1 bg-gray-200 w-full">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-500 ease-out" 
                            style={{ width: `${((currentIndex + 1) / totalBlocks) * 100}%` }}
                        />
                    </div>
                    {/* 调试用页码跳转按钮 */}
                    <div onClick={() => setIsJumping(true)} className="absolute top-2 right-2 px-2 py-1 bg-gray-200 text-xs text-gray-500 rounded cursor-pointer opacity-50 hover:opacity-100">
                        {currentIndex + 1}/{totalBlocks}
                    </div>
                </div>
            )}

            {/* 主内容渲染区 */}
            <div className="flex-1 w-full h-full relative">
                {renderBlock()}
            </div>

            {/* 统一的手势继续浮层 (当 showSwipeOverlay 为 true 时显示) */}
            <SwipeOverlay isVisible={showSwipeOverlay} onNext={goToNextBlock} />

            {/* 调试弹窗 */}
            {isJumping && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setIsJumping(false)}>
                    <div onClick={e => e.stopPropagation()} className="bg-white p-6 rounded-lg shadow-xl w-64">
                        <h3 className="text-lg font-bold mb-4">跳转页面</h3>
                        <input 
                            type="number" 
                            className="w-full border p-2 rounded mb-4" 
                            placeholder={`1 - ${totalBlocks}`}
                            value={jumpValue}
                            onChange={e => setJumpValue(e.target.value)}
                        />
                        <button onClick={(e) => {
                            e.preventDefault();
                            const p = parseInt(jumpValue);
                            if(p > 0 && p <= totalBlocks) { setCurrentIndex(p-1); setIsJumping(false); }
                        }} className="w-full bg-blue-500 text-white py-2 rounded">Go</button>
                    </div>
                </div>
            )}
        </div>
    );
}
