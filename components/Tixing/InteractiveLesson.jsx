import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { useDrag } from '@use-gesture/react';
import { HiSpeakerWave } from "react-icons/hi2";
import { FaChevronUp } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// --- 1. 导入所有外部“独立环节”组件 ---
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

// --- 3. 内置的辅助UI组件 ---

const GrammarBlock = ({ data, onComplete, settings }) => {
    const { grammarPoint, pattern, visibleExplanation, examples, narrationScript, narrationRate } = data;
    const playNarration = () => {
        const textToPlay = (narrationScript || '').replace(/{{(.*?)}}/g, '$1');
        settings.playTTS(textToPlay, 'my', narrationRate || 0);
    };
    const handlePlayExample = (example) => {
        settings.playTTS(example.narrationScript || example.sentence, 'zh', example.rate || 0);
    };

    const createMarkup = (text) => {
        if (!text) return { __html: '' };
        const processedText = text.replace(/在/g, '<span style="color: #FBBF24; border-bottom: 2px solid #FBBF24;">在</span>');
        return { __html: processedText };
    };

    return (
        <div className="w-full h-full flex flex-col text-white animate-fade-in px-4 sm:px-8">
            <div className="w-full max-w-4xl mx-auto flex-grow overflow-y-auto py-12">
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold">{grammarPoint}</h1>
                    {pattern && <p className="text-slate-300 text-lg sm:text-xl mt-2 font-mono">{pattern}</p>}
                </div>

                <div className="mb-12">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/20">
                        <h2 className="text-xl font-bold text-yellow-400">💡 语法解释</h2>
                        {narrationScript && (
                            <button onClick={playNarration} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                                <HiSpeakerWave className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                    <div className="text-slate-200 leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: visibleExplanation.replace(/\n/g, '<br />') }} />
                </div>

                <div>
                    <h2 className="text-xl font-bold text-yellow-400 mb-6 pb-2 border-b border-white/20">✍️ 例句示范</h2>
                    <div className="space-y-6">
                        {examples.map((example, index) => (
                            <div key={example.id}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-grow pr-4">
                                        <p className="text-2xl font-semibold flex items-baseline">
                                            <span className="text-slate-400 text-lg mr-3">{index + 1}.</span>
                                            <span dangerouslySetInnerHTML={createMarkup(example.sentence)} />
                                        </p>
                                        <p className="text-slate-300 mt-1 pl-8">{example.translation}</p>
                                    </div>
                                    <button onClick={() => handlePlayExample(example)} className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0">
                                        <HiSpeakerWave className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div onClick={onComplete} className="flex-shrink-0 h-24 flex flex-col items-center justify-center opacity-80 cursor-pointer">
                <FaChevronUp className="h-8 w-8 animate-bounce-up text-yellow-400" />
            </div>
        </div>
    );
};

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

const WordStudyBlock = ({ data, onComplete, settings }) => {
    const { title, words } = data;
    const handlePlayWord = (word) => { settings.playTTS(word.chinese, 'zh', word.rate || 0); };
    const bind = useDrag(({ swipe: [, swipeY], event }) => {
        event.stopPropagation();
        if (swipeY === -1) { onComplete(); }
    }, { axis: 'y', filterTaps: true, preventDefault: true });
    return (
        <div {...bind()} className="w-full h-full flex flex-col text-white p-4 animate-fade-in">
            <div className="flex-shrink-0 text-center">
                <h2 className="text-3xl font-bold">{title || "生词"}</h2>
            </div>
            <div className="flex-grow overflow-y-auto mt-4">
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
            <div onClick={onComplete} className="flex-shrink-0 h-20 flex flex-col items-center justify-center opacity-80 cursor-pointer mt-2">
                <FaChevronUp className="h-8 w-8 animate-bounce-up text-yellow-400" />
            </div>
        </div>
    );
};

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
                    return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                           <XuanZeTi {...xuanZeTiProps} />
                        </div>
                    );
                case 'lianxian':
                    if (!props.data.pairs) return <UnknownBlockHandler type="lianxian (no pairs)" onSkip={nextStep} />;
                     return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                           <LianXianTi title={props.data.prompt} pairs={props.data.pairs} onCorrect={props.onCorrect} />
                        </div>
                    );
                case 'paixu':
                    if (!props.data.items) return <UnknownBlockHandler type="paixu (no items)" onSkip={nextStep} />;
                    const paiXuProps = { title: props.data.prompt, items: props.data.items, correctOrder: [...props.data.items].sort((a, b) => a.order - b.order).map(item => item.id), onCorrect: props.onCorrect, };
                    return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <PaiXuTi {...paiXuProps} />
                        </div>
                    );
                case 'panduan': 
                    return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <PanDuanTi {...props} />
                        </div>
                    );
                case 'gaicuo': 
                    return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <GaiCuoTi {...props} />
                        </div>
                    );
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
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col pt-16 sm:pt-20" style={{ backgroundImage: "url(/background.jpg)" }}>
            {currentIndex < totalBlocks && (
                 <div className="fixed top-4 left-0 right-0 w-full max-w-5xl mx-auto px-4 z-20 flex justify-between items-center">
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
            
            <div className="w-full h-full">
                {renderBlock()}
            </div>
        </div>
    );
}
