// components/Tixing/LessonPlayer.jsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaRedoAlt } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useSwipeable } from 'react-swipeable';

/* ===================== 1. TTS Hook (支持双语混读) ===================== */
function useBilingualTTS() {
  const activeHowlsRef = useRef([]);
  const progressIntervalRef = useRef(null);
  const onEndCallbackRef = useRef(null);
  
  const [playerState, setPlayerState] = useState({
    isLoading: false, isPlaying: false, duration: 0, seek: 0,
  });

  const cleanup = useCallback((finished = false) => {
    clearInterval(progressIntervalRef.current);
    activeHowlsRef.current.forEach(h => {
      h.howl.stop();
      h.howl.unload();
      if (h.audioUrl) URL.revokeObjectURL(h.audioUrl);
    });
    activeHowlsRef.current = [];
    setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
    if (finished && onEndCallbackRef.current) {
        onEndCallbackRef.current();
        onEndCallbackRef.current = null; // Use callback only once
    }
  }, []);

  const play = useCallback(async (text, { onEnd, primaryVoice = 'zh-CN-XiaoyouNeural', secondaryVoice = 'my-MM-NilarNeural' } = {}) => {
    onEndCallbackRef.current = onEnd;
    cleanup(false);
    setPlayerState(prev => ({ ...prev, isLoading: true }));

    const segments = text.split(/\{\{([^}]+)\}\}/g).map((part, index) => ({
      text: part,
      voice: index % 2 === 1 ? secondaryVoice : primaryVoice
    })).filter(p => p.text.trim() !== '');

    try {
      const audioFetchPromises = segments.map(segment => 
        fetch('https://libretts.is-an.org/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ text: segment.text, voice: segment.voice, rate: 0, pitch: 0 }),
        }).then(res => res.ok ? res.blob() : Promise.reject(`API Error for "${segment.text}"`))
      );
      
      const audioBlobs = await Promise.all(audioFetchPromises);

      const loadedHowls = [];
      let totalDuration = 0;

      for (const blob of audioBlobs) {
        const audioUrl = URL.createObjectURL(blob);
        const howl = new Howl({ src: [audioUrl], format: ['mpeg'], html5: true });
        
        await new Promise((resolve, reject) => {
            howl.once('load', resolve);
            howl.once('loaderror', reject);
        });

        const duration = howl.duration();
        loadedHowls.push({ howl, audioUrl, duration, startSeek: totalDuration });
        totalDuration += duration;
      }
      
      activeHowlsRef.current = loadedHowls;
      setPlayerState({ isLoading: false, isPlaying: false, duration: totalDuration, seek: 0 });

      let currentSegmentIndex = 0;
      const playNextSegment = () => {
        if (currentSegmentIndex >= loadedHowls.length) {
          cleanup(true);
          return;
        }
        
        const current = loadedHowls[currentSegmentIndex];
        current.howl.once('end', playNextSegment);
        current.howl.play();
        
        setPlayerState(prev => ({ ...prev, isPlaying: true }));

        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = setInterval(() => {
          const segmentSeek = current.howl.seek() || 0;
          setPlayerState(prev => ({ ...prev, seek: current.startSeek + segmentSeek }));
        }, 100);

        currentSegmentIndex++;
      };

      playNextSegment();

    } catch (error) {
      console.error("TTS 加载或播放失败:", error);
      alert("音频加载失败，请检查文本格式或网络。");
      cleanup(false);
    }
  }, [cleanup]);

  const stop = useCallback(() => cleanup(false), [cleanup]);
  useEffect(() => () => cleanup(false), [cleanup]);

  return { play, stop, ...playerState };
}

/* ===================== 2. TTS Context & Provider ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useBilingualTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);


/* ===================== 3. 所有 UI 子组件 ===================== */

const SubtitleBar = ({ text }) => {
    const { isPlaying, duration, seek } = useTTS();
    const cleanText = (text || '').replace(/\{\{/g, '').replace(/\}\}/g, '');
    const chars = useMemo(() => Array.from(cleanText), [cleanText]);
    const totalChars = chars.length;
    
    const highlightCount = useMemo(() => {
        if (!isPlaying || duration === 0) return 0;
        const progress = seek / duration;
        return Math.floor(progress * totalChars);
    }, [seek, duration, isPlaying, totalChars]);

    return (
        <div className="w-full p-4 rounded-xl bg-black/20 backdrop-blur-md border border-white/20 shadow-lg">
            <p className="text-xl leading-relaxed text-white text-center font-medium h-20 overflow-hidden">
                {chars.map((char, i) => (
                    <span key={i} className={`transition-opacity duration-300 ${i < highlightCount ? 'opacity-100 text-cyan-300' : 'opacity-0'}`}>
                        {char}
                    </span>
                ))}
            </p>
        </div>
    );
};

const Blackboard = ({ sentence }) => {
    const displayText = sentence.displayText || sentence.text;

    const renderContent = (content) => {
        if (typeof content === 'string') {
            return pinyin(content, { type: 'html', ruby: true });
        }
        if (content.type === 'bold') {
            return `<strong>${pinyin(content.content, { type: 'html', ruby: true })}</strong>`;
        }
        if (content.type === 'highlight') {
            return `<span class="text-cyan-300">${pinyin(content.content, { type: 'html', ruby: true })}</span>`;
        }
        return '';
    };

    const markup = useMemo(() => {
        if (!displayText) return '';
        if (Array.isArray(displayText)) {
            return displayText.map(renderContent).join('');
        }
        return pinyin(displayText, { type: 'html', ruby: true });
    }, [displayText]);

    return (
        <div className="w-full flex-grow flex flex-col justify-center items-center p-4">
            {sentence.imageUrl && <img src={sentence.imageUrl} alt="Lesson illustration" className="max-w-full max-h-48 rounded-lg shadow-lg mb-6" />}
            <div className="relative w-full overflow-hidden rounded-2xl p-8 bg-black/20 backdrop-blur-md border border-white/20 shadow-2xl flex flex-col items-center justify-center text-center">
                <div
                    className="text-3xl font-bold text-white leading-loose break-words"
                    style={{ fontFamily: 'var(--font-serif)', rubyPosition: 'over' }}
                    dangerouslySetInnerHTML={{ __html: markup }}
                />
                {sentence.translation && <div className="mt-4 text-lg text-gray-300 font-sans">{sentence.translation}</div>}
            </div>
        </div>
    );
};

const BottomNav = ({ current, total, onPrev, onNext, onJump }) => {
    const [isJumping, setIsJumping] = useState(false);
    const [jumpValue, setJumpValue] = useState(current + 1);

    useEffect(() => { setJumpValue(current + 1); }, [current]);

    const handleJump = () => {
        const pageNum = parseInt(jumpValue, 10);
        if (pageNum >= 1 && pageNum <= total) {
            onJump(pageNum - 1);
        }
        setIsJumping(false);
    };

    return (
        <div className="w-full max-w-lg mx-auto flex justify-between items-center text-white font-semibold">
            <button className="p-3 rounded-full bg-black/20 hover:bg-black/30 transition shadow-lg" onClick={onPrev}><FiChevronLeft size={24} /></button>
            <div className="text-lg px-4 py-2 bg-black/20 rounded-full cursor-pointer" onClick={() => setIsJumping(true)}>
                {current + 1} / {total}
            </div>
            <button className="p-3 rounded-full bg-black/20 hover:bg-black/30 transition shadow-lg" onClick={onNext}><FiChevronRight size={24} /></button>
            
            {isJumping && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50" onClick={() => setIsJumping(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">跳转到页面</h3>
                        <input 
                            type="number"
                            value={jumpValue}
                            onChange={(e) => setJumpValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                            className="w-full text-center text-xl p-2 border-2 border-gray-300 rounded-md"
                            min="1"
                            max={total}
                            autoFocus
                        />
                        <button className="w-full mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-lg" onClick={handleJump}>跳转</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SideControls = ({ onPlay, onReplay, isPlaying, isLoading }) => (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-6 z-20">
        <button
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 ${isPlaying ? 'bg-yellow-500' : 'bg-blue-500'} ${isLoading && 'animate-pulse'}`}
            onClick={onPlay}
            disabled={isLoading}
        >
            {isPlaying ? <FaPause size={24} /> : (isLoading ? '...' : <FaPlay size={24} />)}
        </button>
        <button
            className="w-16 h-16 rounded-full flex items-center justify-center bg-black/20 text-white shadow-lg"
            onClick={onReplay}
        >
            <FaRedoAlt size={20} />
        </button>
    </div>
);


/* ===================== 终极播放器组件 ===================== */
function LessonPlayerInternal({ lesson, onProgress }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { play, stop, isPlaying, isLoading } = useTTS();
    const currentBlock = lesson.blocks[currentIndex];
    
    useEffect(() => {
        const savedIndex = localStorage.getItem(`lesson-progress-${lesson.id}`);
        if (savedIndex) {
            setCurrentIndex(parseInt(savedIndex, 10));
        }
    }, [lesson.id]);

    useEffect(() => {
        localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex);
    }, [currentIndex, lesson.id]);
    
    const goTo = useCallback((index) => {
        stop();
        const newIndex = Math.max(0, Math.min(index, lesson.blocks.length - 1));
        setCurrentIndex(newIndex);
    }, [lesson.blocks.length, stop]);

    const handlePlay = () => {
        if (isPlaying) {
            stop();
        } else {
            const narrationText = currentBlock.sentence.narrationText || currentBlock.sentence.text;
            play(narrationText, { onEnd: () => goTo(currentIndex + 1) });
        }
    };

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => goTo(currentIndex + 1),
        onSwipedRight: () => goTo(currentIndex - 1),
        preventDefaultTouchmoveEvent: true,
        trackMouse: true,
    });

    return (
        <div {...swipeHandlers} className="w-full h-full bg-cover bg-center bg-fixed select-none relative">
            <div className="absolute inset-0 bg-green-500/30 backdrop-blur-sm" />
            <div className="relative w-full h-full flex flex-col justify-between p-4">
                <h1 className="text-xl font-bold text-black px-4 py-2 bg-white/50 backdrop-blur-md rounded-xl shadow-md self-center">{lesson.title}</h1>
                
                <Blackboard sentence={currentBlock.sentence} />

                <div className="w-full">
                    {currentBlock.questions && currentBlock.questions.length > 0 && 
                        <div className="my-4">
                             {currentBlock.questions.map((q) => (
                                q.type === 'choice' ? (<ChoiceQuestion key={q.id} question={q} onAnswer={console.log} />)
                                : (<MatchingQuestion key={q.id} question={q} onAnswer={console.log} />)
                            ))}
                        </div>
                    }
                    <SubtitleBar text={currentBlock.sentence.narrationText || currentBlock.sentence.text} />
                </div>
                

                <BottomNav 
                    current={currentIndex} 
                    total={lesson.blocks.length} 
                    onPrev={() => goTo(currentIndex - 1)} 
                    onNext={() => goTo(currentIndex + 1)}
                    onJump={goTo}
                />
            </div>
            <SideControls 
                onPlay={handlePlay} 
                onReplay={() => play(currentBlock.sentence.narrationText || currentBlock.sentence.text)}
                isPlaying={isPlaying} 
                isLoading={isLoading}
            />
        </div>
    );
}

// 外层包裹 Provider
export default function LessonPlayer(props) {
    return (
        <TTSProvider>
            <LessonPlayerInternal {...props} />
        </TTSProvider>
    );
}

// 占位符组件，您需要用自己的组件替换
export function ChoiceQuestion({ question, onAnswer }) { return <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/30 backdrop-blur-md rounded-lg text-black">选择题: {question.prompt}</div> }
export function MatchingQuestion({ question, onAnswer }) { return <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/30 backdrop-blur-md rounded-lg text-black">连线题: {question.prompt}</div> }
