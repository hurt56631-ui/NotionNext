import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
// 移除了 BsArrowsFullscreen, BsFullscreenExit 因为语法组件将默认全屏

// --- 1. 导入所有外部“独立环节”组件 (无需修改) ---
// 注意：您需要进入这些组件的单独文件，移除内部的 max-w-.. 类似宽度限制，才能实现真正的全屏
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';

// --- 2. 统一的TTS模块 (无需修改) ---
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
  const voice = ttsVoices[lang];
  if (!voice) {
      console.error(`Unsupported language for TTS: ${lang}`);
      if (onEndCallback) onEndCallback();
      return;
  }
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
    const audio = new Audio(url);
    currentAudio = audio;
    const onEnd = () => {
      if (currentAudio === audio) { currentAudio = null; }
      if (onEndCallback) onEndCallback();
    };
    audio.onended = onEnd;
    audio.onerror = (e) => {
        console.error("Audio element failed to play:", e);
        onEnd();
    };
    await audio.play();
  } catch (e) {
    console.error(`播放 "${text}" (lang: ${lang}, rate: ${rate}) 失败:`, e);
    if (onEndCallback) onEndCallback();
  }
};

const stopAllAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
};

// --- 3. 内置的辅助UI组件 (已修改为全屏) ---

// 教学卡片/课程首页 (本身已是全屏布局，内容居中)
const TeachingBlock = ({ data, onComplete, settings }) => {
    const textToPlay = data.narrationScript || data.displayText;
    const narrationLang = data.narrationLang || 'my';

    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    useEffect(() => {
        if (data.narrationScript) {
            const timer = setTimeout(() => {
                settings.playTTS(textToPlay, narrationLang, 0, onComplete);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [data, settings, onComplete, textToPlay, narrationLang]);

    const handleManualPlay = (e) => {
        e.stopPropagation();
        settings.playTTS(data.displayText, 'zh');
    };

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-center text-center p-4 md:p-8 text-white animate-fade-in cursor-pointer" onClick={onComplete}>
            <style>{`
                @keyframes bounce-up { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-20px); } 60% { transform: translateY(-10px); } }
                .animate-bounce-up { animation: bounce-up 2s infinite; }
            `}</style>
            <div className="flex-grow flex flex-col items-center justify-center">
                {data.pinyin && <p className="text-2xl text-slate-300 mb-2">{data.pinyin}</p>}
                <div className="flex items-center gap-4">
                    <h1 className="text-5xl md:text-6xl font-bold">{data.displayText}</h1>
                    <button onClick={handleManualPlay} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                        <HiSpeakerWave className="h-8 w-8 md:h-9 md:w-9" />
                    </button>
                </div>
                {data.translation && <p className="text-2xl text-slate-200 mt-4 leading-relaxed">{data.translation}</p>}
            </div>
            <div onClick={(e) => { e.stopPropagation(); onComplete(); }} className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-80 cursor-pointer">
                <FaChevronUp className="h-10 w-10 animate-bounce-up text-yellow-400" />
                <span className="mt-2 text-lg">上滑或点击继续</span>
            </div>
        </div>
    );
};

// 完成卡片 (本身已是全屏布局，内容居中)
const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        const textToPlay = data.title || "恭喜";
        playTTS(textToPlay, 'zh');
        const timer = setTimeout(() => router.push('/'), 5000);
        return () => clearTimeout(timer);
    }, [data, router]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-white animate-fade-in">
            <h1 className="text-7xl mb-4">🎉</h1>
            <h2 className="text-4xl font-bold mb-4">{data.title || "ဂုဏ်ယူပါတယ်။"}</h2>
            <p className="text-xl">{data.text || "သင်ခန်းစာပြီးဆုံးပါပြီ။ ပင်မစာမျက်နှာသို့ ပြန်သွားနေသည်..."}</p>
        </div>
    );
};

const UnknownBlockHandler = ({ type, onSkip }) => {
    useEffect(() => {
        console.error(`不支持的组件类型或渲染失败: "${type}", 将在1.2秒后自动跳过。`);
        const timer = setTimeout(onSkip, 1200);
        return () => clearTimeout(timer);
    }, [type, onSkip]);
    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="text-red-400 text-xl font-bold bg-black/50 p-4 rounded-lg">错误：不支持的题型 ({type})</div>
        </div>
    );
};

// [全屏修改] 语法组件，移除了宽度限制和全屏切换逻辑
const GrammarBlock = ({ data, onComplete, settings }) => {
    const { grammarPoint, pattern, visibleExplanation, examples, narrationScript, narrationRate } = data;

    const playNarration = () => {
        const textToPlay = (narrationScript || '').replace(/{{(.*?)}}/g, '$1');
        settings.playTTS(textToPlay, 'my', narrationRate || 0);
    };
    const handlePlayExample = (example) => {
        settings.playTTS(example.narrationScript || example.sentence, 'zh', example.rate || 0);
    };

    return (
        <div className="w-full h-full flex flex-col text-white p-4 md:p-8 animate-fade-in">
            {/* 内容区域，占据主要空间并可滚动 */}
            <div className="flex-grow bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-3xl font-bold">{grammarPoint}</h2>
                    {narrationScript && (
                        <button onClick={playNarration} className="p-2 rounded-full hover:bg-white/20 transition-colors"><HiSpeakerWave className="h-7 w-7" /></button>
                    )}
                </div>
                <p className="text-lg bg-black/20 px-3 py-1 rounded-md inline-block mb-4">{pattern}</p>
                <p className="text-slate-200 text-lg whitespace-pre-line mb-6 leading-relaxed">{visibleExplanation}</p>
                <div className="space-y-3">
                    {examples.map(example => (
                        <div key={example.id} className="bg-black/20 p-4 rounded-lg flex items-center justify-between hover:bg-black/30 transition-colors">
                            <div><p className="text-xl">{example.sentence}</p><p className="text-sm text-slate-400 leading-relaxed">{example.translation}</p></div>
                            <button onClick={() => handlePlayExample(example)} className="p-2 rounded-full hover:bg-white/20"><HiSpeakerWave className="h-6 w-6" /></button>
                        </div>
                    ))}
                </div>
            </div>
            {/* 底部按钮区域 */}
            <div className="flex-shrink-0 flex justify-center mt-6">
                <button onClick={onComplete} className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">继续</button>
            </div>
        </div>
    );
};

// [全屏修改] 生词学习卡片，移除了宽度限制，并使用响应式网格布局
const WordStudyBlock = ({ data, onComplete, settings }) => {
    const { title, words } = data;
    const handlePlayWord = (word) => {
        settings.playTTS(word.chinese, 'zh', word.rate || 0);
    };
    
    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    return (
        <div {...bind()} className="w-full h-full flex flex-col text-white p-4 animate-fade-in">
            <div className="flex-shrink-0 text-center">
                <h2 className="text-3xl font-bold">{title || "生词"}</h2>
            </div>
            {/* 内容区，可滚动 */}
            <div className="flex-grow overflow-y-auto mt-4">
                {/* [全屏修改] 移除 max-w-.. , mx-auto, 并增加响应式列数 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {words.map((word) => (
                        <div key={word.id} onClick={() => handlePlayWord(word)} className="bg-black/25 p-4 rounded-lg flex flex-col justify-between hover:bg-black/40 transition-colors cursor-pointer aspect-square">
                            <div className="flex-grow">
                                {word.pinyin && <p className="text-sm text-slate-400 mb-1">{word.pinyin}</p>}
                                <p className="text-xl font-semibold">{word.chinese}</p>
                            </div>
                            <p className="text-base text-yellow-300 mt-1 leading-normal">{word.translation}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* 底部箭头 */}
            <div onClick={onComplete} className="flex-shrink-0 h-20 flex flex-col items-center justify-center opacity-80 cursor-pointer mt-2">
                <FaChevronUp className="h-8 w-8 animate-bounce-up text-yellow-400" />
            </div>
        </div>
    );
};


// --- 4. 主播放器组件 (核心逻辑 - 已修改) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    useEffect(() => {
        stopAllAudio();
    }, [currentIndex]);
    
    useEffect(() => {
        if (currentBlock && currentBlock.type === 'choice' && currentBlock.content.narrationText) {
            const timer = setTimeout(() => {
                playTTS(currentBlock.content.narrationText, 'zh');
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, currentBlock]);

    const nextStep = useCallback(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, [currentIndex, totalBlocks]);
    const delayedNextStep = useCallback(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); setTimeout(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, 4500); }, [currentIndex, totalBlocks]);

    const handleJump = (e) => {
        e.preventDefault();
        const pageNum = parseInt(jumpValue, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalBlocks) {
            setCurrentIndex(pageNum - 1);
        }
        setIsJumping(false);
        setJumpValue('');
    };

    const renderBlock = () => {
        if (currentIndex >= totalBlocks) { return <CompletionBlock data={blocks[totalBlocks - 1]?.content || {}} router={router} />; }
        if (!currentBlock) { return <div className="text-white">正在加载...</div>; }
        
        const type = currentBlock.type.toLowerCase();
        const props = {
            data: currentBlock.content,
            onCorrect: delayedNextStep,
            onComplete: nextStep,
            settings: { playTTS },
        };

        try {
            switch (type) {
                case 'teaching': return <TeachingBlock {...props} />;
                case 'word_study': return <WordStudyBlock {...props} />;
                case 'grammar_study':
                    const firstGrammarPoint = props.data.grammarPoints?.[0];
                    if (!firstGrammarPoint) return <UnknownBlockHandler type="grammar_study (empty)" onSkip={nextStep} />;
                    return <GrammarBlock data={firstGrammarPoint} onComplete={props.onComplete} settings={props.settings} />;
                case 'dialogue_cinematic': return <DuiHua {...props} />;
                case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
                case 'choice':
                    const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
                    if(xuanZeTiProps.data.narrationText){ xuanZeTiProps.isListeningMode = true; xuanZeTiProps.question.text = props.data.prompt; }
                    return <XuanZeTi {...xuanZeTiProps} />;
                case 'lianxian':
                    if (!props.data.pairs) return <UnknownBlockHandler type="lianxian (no pairs)" onSkip={nextStep} />;
                    return <LianXianTi title={props.data.prompt} pairs={props.data.pairs} onCorrect={props.onCorrect} />;
                case 'paixu':
                    if (!props.data.items) return <UnknownBlockHandler type="paixu (no items)" onSkip={nextStep} />;
                    const paiXuProps = { title: props.data.prompt, items: props.data.items, correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id), onCorrect: props.onCorrect, };
                    return <PaiXuTi {...paiXuProps} />;
                case 'panduan': return <PanDuanTi {...props} />;
                case 'gaicuo': return <GaiCuoTi {...props} />;
                case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
                default: return <UnknownBlockHandler type={type} onSkip={nextStep} />;
            }
        } catch (error) {
            console.error(`渲染环节 "${type}" 时发生错误:`, error);
            return <UnknownBlockHandler type={`${type} (渲染失败)`} onSkip={nextStep} />;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex + 1) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col overflow-hidden" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                //  [全屏修改] 让进度条容器也居中，而不是贴边
                 <div className="absolute top-4 left-0 right-0 w-full max-w-5xl mx-auto px-4 z-20 flex justify-between items-center">
                    <div className="w-full bg-gray-600/50 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
                    </div>
                    <div onClick={() => setIsJumping(true)} className="ml-4 px-3 py-1 bg-black/30 text-white text-sm rounded-full cursor-pointer whitespace-nowrap">
                        {currentIndex + 1} / {totalBlocks}
                    </div>
                </div>
            )}
            
            {isJumping && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in" onClick={() => setIsJumping(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="bg-gray-800 p-6 rounded-lg shadow-xl relative">
                        <h3 className="text-white text-lg mb-4">跳转到第几页？ (1-{totalBlocks})</h3>
                        <form onSubmit={handleJump}>
                            <input
                                type="number"
                                autoFocus
                                value={jumpValue}
                                onChange={(e) => setJumpValue(e.target.value)}
                                className="w-full px-4 py-2 text-center bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </form>
                         <button onClick={() => setIsJumping(false)} className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white">
                            <IoMdClose size={24} />
                        </button>
                    </div>
                </div>
            )}
            
            {/* [全屏修改] 移除了外层容器的居中样式，并为顶部进度条留出空间 */}
            <div className="w-full h-full pt-16">
                {renderBlock()}
            </div>
        </div>
    );
}
