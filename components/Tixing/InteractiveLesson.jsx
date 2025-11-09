import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp, FaCheck } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. [融合] 导入所有需要的组件，包括 GrammarPointPlayer ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer'; // <-- 关键：导入您想要的语法组件

// --- 2. [融合] 使用您最初的TTS模块，因为它功能更完善 ---
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


// --- 3. [融合] 内置的辅助UI组件 ---

const TeachingBlock = ({ data, onComplete, settings }) => {
    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    const handleManualPlay = (e) => {
        e.stopPropagation();
        settings.playTTS(data.displayText, 'zh');
    };

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-white animate-fade-in cursor-pointer" onClick={onComplete}>
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

const WordStudyBlock = ({ data, onComplete, settings }) => {
    const [learnedWords, setLearnedWords] = useState(new Set());

    const handlePlayWord = (word) => {
        settings.playTTS(word.chinese, 'zh', word.rate || 0);
        // 创建一个新的 Set 以触发状态更新
        setLearnedWords(prev => new Set(prev).add(word.id));
    };
    
    // 当所有单词都学过后，自动进入下一步
    useEffect(() => {
        if (data.words && learnedWords.size === data.words.length) {
            const timer = setTimeout(onComplete, 800);
            return () => clearTimeout(timer);
        }
    }, [learnedWords, data.words, onComplete]);

    const wordCount = data.words ? data.words.length : 0;

    return (
        // 使用一个内层容器来控制最大宽度和样式
        <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col text-white p-6 bg-black/25 backdrop-blur-sm rounded-2xl shadow-lg animate-fade-in">
            <div className="flex-shrink-0 text-center mb-6">
                <h2 className="text-3xl font-bold">{data.title || "生词学习"}</h2>
                <p className="text-slate-300 mt-1">点击生词听发音</p>
            </div>
            
            {/* 键盘式布局 */}
            <div className="flex-grow overflow-y-auto pr-2">
                <div className="flex flex-wrap justify-center gap-3">
                    {data.words && data.words.map((word) => {
                        const isLearned = learnedWords.has(word.id);
                        return (
                            <button 
                                key={word.id} 
                                onClick={() => handlePlayWord(word)}
                                className={`
                                    relative p-4 rounded-lg shadow-md transition-all duration-300 transform 
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-400
                                    text-left
                                    ${isLearned 
                                        ? 'bg-green-600/80 text-white hover:bg-green-500/80' 
                                        : 'bg-gray-700/70 hover:bg-gray-600/70 hover:-translate-y-1'
                                    }
                                `}
                            >
                                <div className="text-2xl font-semibold mb-1">{word.chinese}</div>
                                <div className="text-sm text-slate-300">{word.pinyin}</div>
                                <div className="text-base text-yellow-300 mt-1">{word.translation}</div>
                                {isLearned && (
                                    <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1 shadow-lg">
                                        <FaCheck className="text-white h-3 w-3" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 底部继续按钮 */}
            <div className="flex-shrink-0 pt-6 text-center">
                 <button 
                    onClick={onComplete}
                    className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={learnedWords.size < wordCount}
                >
                    继续 ({learnedWords.size}/{wordCount})
                </button>
            </div>
        </div>
    );
};

const CompletionBlock = ({ data, router }) => { 
    useEffect(() => {
        playTTS(data.title || "恭喜", 'zh');
        const timer = setTimeout(() => router.push('/'), 5000);
        return () => clearTimeout(timer);
    }, [data, router]);
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white animate-fade-in">
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
    return <div className="text-red-400 text-xl font-bold bg-black/50 p-4 rounded-lg">错误：不支持的题型 ({type})</div>;
};


// --- 4. 主播放器组件 (核心逻辑 - 最终融合版) ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    useEffect(() => { stopAllAudio(); }, [currentIndex]);
    
    const nextStep = useCallback(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, [currentIndex, totalBlocks]);
    const delayedNextStep = useCallback(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); setTimeout(() => { if (currentIndex < totalBlocks) { setCurrentIndex(prev => prev + 1); } }, 1200); }, [currentIndex, totalBlocks]);

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

        // 辅助函数，用于包裹标准题型，提供一个统一的、宽度更大的卡片容器
        const wrapInCenteredCard = (component) => (
             <div className="w-full max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 bg-black/25 backdrop-blur-sm rounded-2xl shadow-lg">
                {component}
            </div>
        );

        switch (type) {
            case 'teaching': return <TeachingBlock {...props} />;
            case 'word_study': return <WordStudyBlock {...props} />;
            case 'grammar_study':
                if (!props.data || !props.data.grammarPoints || props.data.grammarPoints.length === 0) {
                    return <UnknownBlockHandler type="grammar_study (数据为空)" onSkip={nextStep} />;
                }
                return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
            case 'dialogue_cinematic': return <DuiHua {...props} />;
            
            case 'image_match_blanks': return wrapInCenteredCard(<TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />);
            case 'choice':
                const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
                return wrapInCenteredCard(<XuanZeTi {...xuanZeTiProps} />);
            case 'lianxian':
                return wrapInCenteredCard(<LianXianTi title={props.data.prompt} pairs={props.data.pairs} onCorrect={props.onCorrect} />);
            case 'paixu':
                const paiXuProps = { title: props.data.prompt, items: props.data.items, correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id), onCorrect: props.onCorrect, };
                return wrapInCenteredCard(<PaiXuTi {...paiXuProps} />);
            case 'panduan': return wrapInCenteredCard(<PanDuanTi {...props} />);
            case 'gaicuo': return wrapInCenteredCard(<GaiCuoTi {...props} />);
            
            case 'complete': case 'end': return <CompletionBlock data={props.data} router={router} />;
            default: return <UnknownBlockHandler type={type} onSkip={nextStep} />;
        }
    };

    const progress = totalBlocks > 0 ? ((currentIndex + 1) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-2 sm:p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                 <div className="w-full max-w-5xl absolute top-4 px-2 sm:px-4 z-20 flex justify-between items-center">
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
            
            <div className="w-full h-full flex items-center justify-center pt-12 sm:pt-16">
                {renderBlock()}
            </div>
        </div>
    );
}
