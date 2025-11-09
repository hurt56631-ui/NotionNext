import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. 导入所有外部组件 ---
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer';

// --- 2. 统一的TTS模块 (无修改) ---
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


// --- 3. 内置的辅助UI组件 ---
const TeachingBlock = ({ data, onComplete, settings }) => {
    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    useEffect(() => {
        if (data.narrationScript) {
            const timer = setTimeout(() => {
                settings.playTTS(data.narrationScript, data.narrationLang || 'my');
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [data, settings]);

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

const WordStudyBlock = ({ data, onComplete, settings }) => {
    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });

    const handlePlayWord = (word) => {
        settings.playTTS(word.chinese, 'zh', word.rate || 0);
    };

    return (
        <div {...bind()} className="w-full h-full flex flex-col items-center justify-center text-white p-6 animate-fade-in cursor-pointer" onClick={onComplete}>
            <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col p-6 bg-black/40 backdrop-blur-sm rounded-2xl shadow-lg">
                <div className="flex-shrink-0 text-center mb-6">
                    <h2 className="text-3xl font-bold">{data.title || "生词学习"}</h2>
                    <p className="text-slate-300 mt-1">点击生词听发音，或上滑/点击下方按钮继续</p>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="flex flex-wrap justify-center gap-3">
                        {data.words && data.words.map((word) => (
                            <button 
                                key={word.id} 
                                onClick={(e) => { e.stopPropagation(); handlePlayWord(word); }}
                                className="p-4 rounded-lg shadow-md transition-transform transform bg-gray-700/70 hover:bg-gray-600/70 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-400 text-center"
                            >
                                <div className="text-sm text-slate-300">{word.pinyin}</div>
                                <div className="text-2xl font-semibold mt-1">{word.chinese}</div>
                                <div className="text-base text-yellow-300 mt-2">{word.translation}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-shrink-0 pt-6 text-center">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onComplete(); }}
                        className="px-8 py-3 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105"
                    >
                        继续
                    </button>
                </div>
            </div>
        </div>
    );
};

const CompletionBlock = ({ data, router }) => {
    useEffect(() => {
        const textToPlay = data.title || "恭喜";
        playTTS(textToPlay, 'zh');
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
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


// --- 4. 主播放器组件 ---
export default function InteractiveLesson({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const router = useRouter();
    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];
    useEffect(() => { stopAllAudio(); }, [currentIndex]);
    useEffect(() => {
        if (currentBlock && currentBlock.type === 'choice' && currentBlock.content.narrationText) {
            const timer = setTimeout(() => { playTTS(currentBlock.content.narrationText, 'zh'); }, 500);
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
                case 'grammar_study':
                    if (!props.data || !props.data.grammarPoints || props.data.grammarPoints.length === 0) {
                        return <UnknownBlockHandler type="grammar_study (数据为空)" onSkip={nextStep} />;
                    }
                    return <GrammarPointPlayer grammarPoints={props.data.grammarPoints} onComplete={props.onComplete} />;
                case 'dialogue_cinematic': return <DuiHua {...props} />;
                case 'word_study': return <WordStudyBlock {...props} />;
                
                case 'image_match_blanks': return <TianKongTi {...props.data} onCorrect={props.onCorrect} onNext={props.onCorrect} />;
                case 'choice':
                    const xuanZeTiProps = { ...props, question: { text: props.data.prompt, ...props.data }, options: props.data.choices || [], correctAnswer: props.data.correctId ? [props.data.correctId] : [], onNext: props.onCorrect };
                     if(xuanZeTiProps.data.narrationText){ xuanZeTiProps.isListeningMode = true; xuanZeTiProps.question.text = props.data.prompt; }
                    return <XuanZeTi {...xuanZeTiProps} />;
                
                // 【最终修正】为连线题增加数据转换逻辑，修复加载Bug
                case 'lianxian': {
                    if (!props.data.pairs || props.data.pairs.length === 0) {
                        return <UnknownBlockHandler type="lianxian (no pairs data)" onSkip={nextStep} />;
                    }
                    // 1. 转换数据格式
                    const columnA = props.data.pairs.map(p => ({ id: p.id, content: p.left }));
                    const columnB_temp = props.data.pairs.map(p => ({ id: `${p.id}_b`, content: p.right }));
                    // 2. 打乱右侧顺序
                    const columnB = [...columnB_temp].sort(() => Math.random() - 0.5);
                    // 3. 创建正确答案映射
                    const correctPairsMap = props.data.pairs.reduce((acc, p) => {
                        acc[p.id] = `${p.id}_b`;
                        return acc;
                    }, {});

                    return <LianXianTi 
                                title={props.data.prompt} 
                                columnA={columnA}
                                columnB={columnB}
                                pairs={correctPairsMap}
                                onCorrect={props.onCorrect} 
                           />;
                }
                
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
    
    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                 <div className="fixed top-4 left-4 right-4 z-30">
                    <div className="max-w-5xl mx-auto">
                        <div className="bg-gray-600/50 rounded-full h-1.5">
                            <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${(currentIndex + 1) / totalBlocks * 100}%`, transition: 'width 0.5s ease' }}></div>
                        </div>
                    </div>
                    <div 
                        onClick={() => setIsJumping(true)} 
                        className="absolute top-[-6px] right-0 px-3 py-1 bg-black/30 text-white text-sm rounded-full cursor-pointer whitespace-nowrap"
                    >
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
            
            <div className="w-full h-full pt-16">
                {renderBlock()}
            </div>
        </div>
    );
}
