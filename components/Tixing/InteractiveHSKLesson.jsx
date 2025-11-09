// components/Tixing/InteractiveHSKLesson.jsx (终极版 - 富文本、新UI、自动切换)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaRedoAlt } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/* ===================== 1. TTS Hook (已升级: 支持 onEnd 回调) ===================== */
function useBilingualTTS() {
  const activeHowlsRef = useRef([]);
  const progressIntervalRef = useRef(null);
  const onEndCallbackRef = useRef(null);
  
  const [playerState, setPlayerState] = useState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });

  const cleanup = useCallback((finished = false) => {
    clearInterval(progressIntervalRef.current);
    activeHowlsRef.current.forEach(h => { h.howl.stop(); h.howl.unload(); if (h.audioUrl) URL.revokeObjectURL(h.audioUrl); });
    activeHowlsRef.current = [];
    setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
    if (finished && onEndCallbackRef.current) {
        onEndCallbackRef.current();
    }
  }, []);

  const play = useCallback(async (text, { onEnd, primaryVoice = 'zh-CN-XiaoyouNeural', secondaryVoice = 'my-MM-NilarNeural' } = {}) => {
    onEndCallbackRef.current = onEnd;
    cleanup();
    setPlayerState(prev => ({ ...prev, isLoading: true }));
    const segments = text.split(/\{\{([^}]+)\}\}/g).map((part, index) => ({ text: part, voice: index % 2 === 1 ? secondaryVoice : primaryVoice })).filter(p => p.text.trim() !== '');
    try {
      const audioFetchPromises = segments.map(segment => fetch('https://libretts.is-an.org/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ text: segment.text, voice: segment.voice, rate: 0, pitch: 0 }), }).then(res => res.ok ? res.blob() : Promise.reject(`API Error for "${segment.text}"`)));
      const audioBlobs = await Promise.all(audioFetchPromises);
      const loadedHowls = [];
      let totalDuration = 0;
      for (const blob of audioBlobs) {
        const audioUrl = URL.createObjectURL(blob);
        const howl = new Howl({ src: [audioUrl], format: ['mpeg'], html5: true });
        await new Promise(resolve => howl.once('load', resolve));
        const duration = howl.duration();
        loadedHowls.push({ howl, audioUrl, duration, startSeek: totalDuration });
        totalDuration += duration;
      }
      activeHowlsRef.current = loadedHowls;
      setPlayerState({ isLoading: false, isPlaying: false, duration: totalDuration, seek: 0 });
      let currentSegmentIndex = 0;
      const playNextSegment = () => {
        if (currentSegmentIndex >= loadedHowls.length) { cleanup(true); return; }
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
    } catch (error) { console.error("TTS 加载或播放失败:", error); alert("音频加载失败"); cleanup(); }
  }, [cleanup]);

  const stop = useCallback(() => cleanup(false), [cleanup]);
  useEffect(() => cleanup, [cleanup]);
  return { play, stop, ...playerState };
}

/* ===================== 2. TTS Context & Provider (保持不变) ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useBilingualTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);

/* ===================== 3. SubtitleBar (✅ 视觉已升级) ===================== */
export function SubtitleBar({ text }) {
    const { isPlaying, duration, seek } = useTTS();
    const cleanText = (text || '').replace(/\{\{/g, '').replace(/\}\}/g, '');
    const chars = useMemo(() => Array.from(cleanText), [cleanText]);
    const highlightIndex = useMemo(() => { if (!isPlaying || duration === 0) return -1; const progress = seek / duration; return Math.min(Math.floor(progress * totalChars), totalChars - 1); }, [seek, duration, isPlaying, chars.length]);
    const totalChars = chars.length;
    return (
      <div className="w-full p-4 rounded-xl bg-black/20 backdrop-blur-md border border-white/20 shadow-lg">
        <p className="text-xl leading-relaxed text-white text-center font-medium">
          {chars.map((char, i) => (<span key={i} className={`transition-colors duration-200 ${i <= highlightIndex ? 'text-cyan-300' : 'text-white/70'}`}>{char}</span>))}
        </p>
      </div>
    );
}
  
/* ===================== 4. Blackboard (✅ 视觉、富文本、图片已升级) ===================== */
export function Blackboard({ sentence }) {
    const displayText = sentence.displayText || sentence.text;
    const narrationText = sentence.narrationText || sentence.text;
    const { play, stop, isPlaying, isLoading } = useTTS();
    
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
            <div className="w-full mt-6">
                <SubtitleBar text={narrationText} />
            </div>
        </div>
    );
}

/* ===================== 5. Question & InteractiveBlock (✅ 视觉、自动切换已升级) ===================== */
export function ChoiceQuestion({ question, onAnswer }) { /* ... 代码保持不变 ... */ }
export function MatchingQuestion({ question, onAnswer }) { /* ... 代码保持不变 ... */ }

export function InteractiveLessonBlock({ lesson, onProgress }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { play, stop, isPlaying, isLoading } = useTTS();
    const currentBlock = lesson.blocks[currentIndex];
    
    const goToNext = useCallback(() => {
        stop();
        if (currentIndex < lesson.blocks.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [currentIndex, lesson.blocks.length, stop]);

    const goToPrev = () => { stop(); if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); } };

    const handlePlay = () => {
        const narrationText = currentBlock.sentence.narrationText || currentBlock.sentence.text;
        play(narrationText, { onEnd: goToNext }); // ✅ 播放结束后自动调用 goToNext
    };

    function handleAnswer({ ok }) {
        onProgress && onProgress({ lessonId: lesson.id, blockId: currentBlock.id, ok });
        if (ok) { setTimeout(goToNext, 800); }
    }

    return (
        <div className="w-full h-full flex">
            {/* 内容区 */}
            <div className="flex-grow flex flex-col justify-between items-center p-4">
                <div className="w-full max-w-lg text-center">
                  <h1 className="text-3xl font-bold text-black px-6 py-2 bg-white/50 backdrop-blur-md rounded-xl shadow-md">{lesson.title}</h1>
                </div>

                <Blackboard sentence={currentBlock.sentence} />
                
                <div className="w-full max-w-4xl mx-auto">
                    {currentBlock.questions.map((q) => (
                        q.type === 'choice' ? (<ChoiceQuestion key={q.id} question={q} onAnswer={handleAnswer} />)
                        : (<MatchingQuestion key={q.id} question={q} onAnswer={handleAnswer} />)
                    ))}
                </div>

                <div className="w-full max-w-lg mx-auto flex justify-between items-center text-black font-semibold">
                    <div className="text-sm px-4 py-2 bg-black/20 text-white rounded-full">{currentIndex + 1} / {lesson.blocks.length}</div>
                    <div className="flex gap-4">
                        <button className="p-3 rounded-full bg-black/20 text-white hover:bg-black/30 transition shadow-lg" onClick={goToPrev}><FiChevronLeft size={24} /></button>
                        <button className="p-3 rounded-full bg-black/20 text-white hover:bg-black/30 transition shadow-lg" onClick={goToNext}><FiChevronRight size={24} /></button>
                    </div>
                </div>
            </div>

            {/* 右侧抖音式按钮区 */}
            <div className="flex flex-col justify-center items-center p-4 space-y-6">
                <button
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 ${isPlaying ? 'bg-yellow-500' : 'bg-blue-500'} ${(isLoading) && 'animate-pulse'}`}
                    onClick={isPlaying ? stop : handlePlay}
                    disabled={isLoading}
                >
                    {isPlaying ? <FaPause size={24} /> : (isLoading ? '...' : <FaPlay size={24} />)}
                </button>
                <button
                    className="w-16 h-16 rounded-full flex items-center justify-center bg-black/20 text-white shadow-lg"
                    onClick={() => play(currentBlock.sentence.narrationText || currentBlock.sentence.text)}
                >
                    <FaRedoAlt size={20} />
                </button>
            </div>
        </div>
    );
}


/* ===================== 6. 最终的 Demo 页面 (✅ 已使用您的教材内容) ===================== */
export default function DemoLessonPage() {
  const mockLesson = {
    id: 'grammar-lesson-1',
    title: '句型模板与例句',
    blocks: [
      { id: 'b1',
        sentence: {
          displayText: [ {type: 'bold', content: '你是哪国人？'} ],
          narrationText: '我们来学习第一个模板：你是哪国人？这是一个非常常用的句子，用来询问对方的国籍。',
          translation: 'Which country are you from?',
          imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1888'
        },
        questions: []
      },
      { id: 'b2',
        sentence: {
          displayText: [
            {type: 'highlight', content: '语法点'},
            '：“哪” vs “哪儿”'
          ],
          narrationText: '学习这个句型时，有一个易错点，就是要区分“哪”和“哪儿”。“哪国人”是问国籍，“去哪儿”是问地点。你不能说“你是哪儿国人”。',
          translation: 'Grammar Point: nǎ vs nǎr'
        },
        questions: []
      },
      { id: 'b3',
        sentence: {
          displayText: 'A: 你是哪国人？\nB: 我是缅甸人。',
          narrationText: '现在请听一段对话。A问：你是哪国人？ {{မင်း ဘယ်နိုင်ငံသားလဲ။}} B回答：我是缅甸人。{{ကျွန်တော်က မြန်မာလူမျိုးပါ။}}',
          translation: 'A: Which country are you from? B: I am from Myanmar.'
        },
        questions: [
            { "id": "q1", "type": "choice", "prompt": "对话中B是哪国人？", "choices": [{"id":"c1", "text":"中国人"}, {"id":"c2", "text":"缅甸人"}, {"id":"c3", "text":"美国人"}], "correctId": "c2" }
        ]
      }
    ]
  };

  function saveProgress(p) { console.log('保存进度', p); }

  return (
    <div className="w-full min-h-screen bg-cover bg-center bg-fixed" style={{backgroundImage: "url('/background.jpg')"}}>
        <TTSProvider>
            <div className="w-full min-h-screen bg-green-500/30 backdrop-blur-sm">
                <InteractiveLessonBlock lesson={mockLesson} onProgress={saveProgress} />
            </div>
        </TTSProvider>
    </div>
  );
                    }
