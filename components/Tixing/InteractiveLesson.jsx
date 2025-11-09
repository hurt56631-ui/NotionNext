import React, 'useState', useEffect, useCallback, useMemo } from 'react';
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

// [最终修改] GrammarBlock 将不再拥有自己的深色背景和圆角，以融入父组件的全局背景
const GrammarBlock = ({ data, onComplete, settings }) => {
    const { grammarPoint, pattern, visibleExplanation, examples, narrationScript, narrationRate } = data;
    const playNarration = () => {
        const textToPlay = (narrationScript || '').replace(/{{(.*?)}}/g, '$1');
        settings.playTTS(textToPlay, 'my', narrationRate || 0);
    };
    const handlePlayExample = (example) => {
        settings.playTTS(example.narrationScript || example.sentence, 'zh', example.rate || 0);
    };

    // 使用 dangerouslySetInnerHTML 来渲染HTML标签，例如高亮
    const createMarkup = (text) => {
        if (!text) return { __html: '' };
        // 示例：将 '在' 字用样式包裹
        const processedText = text.replace(/在/g, '<span style="color: #FBBF24; border-bottom: 2px solid #FBBF24;">在</span>');
        return { __html: processedText };
    };

    return (
        <div className="w-full h-full flex flex-col text-white animate-fade-in px-4 sm:px-8">
            {/* 内容区域，可滚动，并设置最大宽度和居中 */}
            <div className="w-full max-w-4xl mx-auto flex-grow overflow-y-auto py-12">
                {/* 顶部标题区域 */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold">{grammarPoint}</h1>
                    {pattern && <p className="text-slate-300 text-lg sm:text-xl mt-2 font-mono">{pattern}</p>}
                </div>

                {/* 语法解释 */}
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

                {/* 例句示范 */}
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

            {/* 底部上滑提示 */}
            <div onClick={onComplete} className="flex-shrink-0 h-24 flex flex-col items-center justify-center opacity-80 cursor-pointer">
                <FaChevronUp className="h-8 w-8 animate-bounce-up text-yellow-400" />
            </div>
        </div>
    );
};


// [保持不变] 其他辅助组件，如TeachingBlock, WordStudyBlock等，因为它们的设计本身就需要一个独立的卡片背景。
// 如果您也希望它们融入背景，则需要用类似的方式修改它们。
const TeachingBlock = ({ data, onComplete, settings }) => { /* ...代码不变... */ return <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 md:p-8 text-white animate-fade-in cursor-pointer" onClick={onComplete}>...</div>; };
const WordStudyBlock = ({ data, onComplete, settings }) => { /* ...代码不变... */ return <div className="w-full h-full flex flex-col text-white p-4 animate-fade-in">...</div>; };
const CompletionBlock = ({ data, router }) => { /* ...代码不变... */ return <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-white animate-fade-in">...</div>; };
const UnknownBlockHandler = ({ type, onSkip }) => { /* ...代码不变... */ return <div className="w-full h-full flex items-center justify-center">...</div>; };


// --- 4. 主播放器组件 (核心逻辑 - 最终修改) ---
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
    
    // [保持不变] renderBlock的逻辑不变，它负责选择渲染哪个组件
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
                    // 【关键】为选择题等组件包裹一个容器，让它们居中显示
                    return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                           <XuanZeTi {...xuanZeTiProps} />
                        </div>
                    );
                case 'lianxian':
                    if (!props.data.pairs) return <UnknownBlockHandler type="lianxian (no pairs)" onSkip={nextStep} />;
                    // 【关键】为选择题等组件包裹一个容器，让它们居中显示
                     return (
                        <div className="w-full h-full flex items-center justify-center p-4">
                           <LianXianTi title={props.data.prompt} pairs={props.data.pairs} onCorrect={props.onCorrect} />
                        </div>
                    );
                // ... 对 PaiXuTi, PanDuanTi, GaiCuoTi 等也做类似处理 ...
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
        // [最终修改] 这是全局容器，它只负责提供背景和顶部进度条的空间
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col pt-16 sm:pt-20" style={{ backgroundImage: "url(/background.jpg)" }}>
            {/* 顶部进度条部分，使用 fixed 定位，这样它就不会影响下面主内容的布局 */}
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
            
            {/* 跳转模态框部分保持不变 */}
            {isJumping && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in" onClick={() => setIsJumping(false)}>
                    {/* ... */}
                </div>
            )}
            
            {/* 
              [最终修改] 这是主内容区域。它是一个透明的插槽，高度占满剩余空间。
              子组件（如GrammarBlock）会在这里被渲染，并自己决定布局。
            */}
            <div className="w-full h-full">
                {renderBlock()}
            </div>
        </div>
    );
}
