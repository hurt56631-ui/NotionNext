// components/Tixing/InteractiveHSKLesson.jsx (最终版 - 浅色主题 + 背景图)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaStop } from 'react-icons/fa';

/* ===================== 1. TTS Hook (保持不变) ===================== */
function useBilingualTTS() {
  const activeHowlsRef = useRef([]);
  const progressIntervalRef = useRef(null);
  const [playerState, setPlayerState] = useState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
  const cleanup = useCallback(() => { clearInterval(progressIntervalRef.current); activeHowlsRef.current.forEach(h => { h.howl.stop(); h.howl.unload(); if (h.audioUrl) URL.revokeObjectURL(h.audioUrl); }); activeHowlsRef.current = []; setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 }); }, []);
  const play = useCallback(async (text, { primaryVoice = 'zh-CN-XiaoyouNeural', secondaryVoice = 'my-MM-NilarNeural' } = {}) => {
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
        if (currentSegmentIndex >= loadedHowls.length) { cleanup(); return; }
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
    } catch (error) { console.error("TTS 加载或播放失败:", error); alert("音频加载失败，请检查文本格式或网络。"); cleanup(); }
  }, [cleanup]);
  const pause = useCallback(() => { activeHowlsRef.current.forEach(h => { if(h.howl.playing()) h.howl.pause(); }); setPlayerState(prev => ({...prev, isPlaying: false})); }, []);
  const resume = useCallback(() => { const howlToPlay = activeHowlsRef.current.find(h => h.howl.state() === 'loaded' && !h.howl.playing()); if(howlToPlay) { howlToPlay.howl.play(); setPlayerState(prev => ({...prev, isPlaying: true})); } }, []);
  const stop = useCallback(cleanup, [cleanup]);
  useEffect(() => cleanup, [cleanup]);
  return { play, pause, resume, stop, ...playerState };
}

/* ===================== 2. TTS Context & Provider (保持不变) ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useBilingualTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);

/* ===================== 3. SubtitleBar (✅ 浅色主题已适配) ===================== */
export function SubtitleBar({ text, className }) {
  const { isPlaying, duration, seek } = useTTS();
  const cleanText = text.replace(/\{\{/g, '').replace(/\}\}/g, '');
  const chars = useMemo(() => cleanText ? Array.from(cleanText) : [], [cleanText]);
  const totalChars = chars.length;
  const highlightIndex = useMemo(() => { if (!isPlaying || duration === 0) return -1; const progress = seek / duration; return Math.min(Math.floor(progress * totalChars), totalChars - 1); }, [seek, duration, isPlaying, totalChars]);

  return (
    <div className={`w-full p-4 rounded-xl bg-white/50 backdrop-blur-md border border-white/30 shadow-lg ${className || ''}`}>
      <p className="text-xl leading-relaxed text-gray-800 text-center font-medium">
        {chars.map((char, i) => (
          <span key={i} className={`transition-colors duration-200 ${i <= highlightIndex ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
            {char.trim() === '' ? '\u00A0' : char}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ===================== 4. Blackboard (✅ 浅色主题已适配) ===================== */
export function Blackboard({ sentence, className }) {
  const { play, pause, resume, cancel, isPlaying, isLoading } = useTTS();
  const displayText = sentence.displayText || sentence.text;
  const narrationText = sentence.narrationText || sentence.text;
  const rubyMarkup = useMemo(() => { if (!displayText) return ''; const textToProcess = displayText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s/]/g, ''); return pinyin(textToProcess, { type: 'html', ruby: true }); }, [displayText]);

  return (
    <div className={`w-full max-w-4xl mx-auto ${className || ''}`}>
        <div className="relative overflow-hidden rounded-2xl p-8 bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl flex flex-col items-center justify-center text-center min-h-[200px]">
            <div 
              className="text-4xl font-bold text-slate-800 leading-loose break-words" 
              style={{ fontFamily: 'var(--font-serif)', rubyPosition: 'over' }} 
              dangerouslySetInnerHTML={{ __html: rubyMarkup }}
            />
            {sentence.translation && <div className="mt-4 text-lg text-slate-500 font-sans">{sentence.translation}</div>}
        </div>

        <div className="flex justify-center items-center gap-3 mt-6">
            <button className="px-6 py-3 bg-blue-500 text-white rounded-lg font-bold shadow-lg hover:bg-blue-600 transition-all transform hover:scale-105 disabled:opacity-60 disabled:scale-100" onClick={() => play(narrationText)} disabled={isLoading}>
                {isLoading ? '加载中...' : '播放'}
            </button>
            <button className="px-5 py-3 bg-white/70 text-slate-700 rounded-lg font-bold shadow hover:bg-white transition" onClick={pause}>暂停</button>
            <button className="px-5 py-3 bg-white/70 text-slate-700 rounded-lg font-bold shadow hover:bg-white transition" onClick={resume}>继续</button>
            <button className="px-5 py-3 bg-red-500 text-white rounded-lg font-bold shadow hover:bg-red-600 transition" onClick={cancel}>停止</button>
        </div>
        
        <div className="mt-6">
            <SubtitleBar text={narrationText} />
        </div>
    </div>
  );
}

/* ===================== 5. Question & InteractiveBlock (✅ 浅色主题已适配) ===================== */
export function ChoiceQuestion({ question, onAnswer }) { const [selected, setSelected] = useState(null); const [result, setResult] = useState(null); function submit() { const ok = selected === question.correctId; setResult(ok); onAnswer && onAnswer({ ok, selected }); } return ( <div className="w-full max-w-3xl mx-auto mt-4 p-5 bg-white/50 backdrop-blur-md border border-white/30 rounded-lg text-slate-800 shadow-lg"> <div className="font-bold text-lg mb-3">{question.prompt}</div> <div className="grid gap-2"> {question.choices.map(c => ( <button key={c.id} onClick={() => setSelected(c.id)} className={`text-left p-3 rounded-md transition-all duration-200 border ${selected===c.id? 'bg-blue-500 border-blue-600 text-white font-bold scale-105': 'bg-white/50 border-white/30 text-slate-700 hover:bg-white/80'}`}> {c.text} </button> ))} </div> <div className="flex gap-3 items-center mt-4"> <button className="px-5 py-2 bg-green-500 text-white rounded-md font-bold disabled:opacity-50" onClick={submit} disabled={!selected}>提交</button> {result !== null && ( <div className={`px-4 py-2 rounded-md font-semibold ${result? 'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}> {result ? '回答正确!' : '回答错误' } </div> )} </div> </div> ); }
export function MatchingQuestion({ question, onAnswer }) { return ( <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/50 backdrop-blur-md border border-white/30 rounded-lg text-slate-800 shadow-lg"> <div className="font-medium mb-2">连线题（示例）</div> <div className="text-slate-600">请将此组件替换为您自己的 LianXianTi.js</div> </div> ); }

export function InteractiveLessonBlock({ lesson, onProgress }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { cancel } = useTTS();
    const currentBlock = lesson.blocks[currentIndex];
    const goToNext = () => { cancel(); if (currentIndex < lesson.blocks.length - 1) { setCurrentIndex(currentIndex + 1); } };
    const goToPrev = () => { cancel(); if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); } };
    function handleAnswer({ ok }) { onProgress && onProgress({ lessonId: lesson.id, blockId: currentBlock.id, ok }); if (ok) { setTimeout(goToNext, 800); } }

    return (
        <div className="w-full h-full flex flex-col justify-between items-center p-4 space-y-4">
            <div /> {/* 顶部占位符 */}
            <Blackboard sentence={currentBlock.sentence} />
            
            <div className="w-full max-w-4xl mx-auto">
                {currentBlock.questions.map((q) => (
                    q.type === 'choice' ? (<ChoiceQuestion key={q.id} question={q} onAnswer={handleAnswer} />)
                    : (<MatchingQuestion key={q.id} question={q} onAnswer={handleAnswer} />)
                ))}
            </div>

            <div className="w-full max-w-4xl mx-auto flex justify-between items-center text-slate-800 font-semibold">
                <div className="text-sm px-3 py-1 bg-white/30 rounded-full">{currentIndex + 1} / {lesson.blocks.length}</div>
                <div className="flex gap-4">
                    <button className="px-5 py-2 rounded-lg bg-white/50 hover:bg-white transition shadow" onClick={goToPrev}>上一个</button>
                    <button className="px-5 py-2 rounded-lg bg-white/50 hover:bg-white transition shadow" onClick={goToNext}>下一个</button>
                </div>
            </div>
        </div>
    );
}


/* ===================== 6. 最终的 Demo 页面 (✅ 浅色主题已适配) ===================== */
export default function DemoLessonPage() {
  const mockLesson = {
    id: 'hsk1-lesson5-bilingual',
    title: '中缅双语混合朗读示例',
    blocks: [
      { id: 'b1', sentence: { displayText: '你好 / မင်္ဂလာပါ', narrationText: '“你好”的缅甸语是 {{မင်္ဂလာပါ}}', translation: 'Hello / Mingalarpar' }, questions: [] },
      { id: 'b2', sentence: { displayText: '她是老师。', narrationText: '中文说“她是老师”，翻译成缅甸语是 {{သူမသည်ဆရာမဖြစ်သည်။}}', translation: 'She is a teacher.' }, 
        questions: [
            { "id": "q1", "type": "choice", "prompt": "“她是老师”的缅甸语是什么？", "choices": [{"id":"c1", "text":"မင်္ဂလာပါ"}, {"id":"c2", "text":"သူမသည်ဆရာမဖြစ်သည်။"}, {"id":"c3", "text":"ကျေးဇူးတင်ပါတယ်"}], "correctId": "c2" }
        ]
      }
    ]
  };
  function saveProgress(p) { console.log('保存进度', p); }

  return (
    // ✅ 核心修改：整个容器现在使用背景图
    <div className="w-full min-h-screen bg-cover bg-center" style={{backgroundImage: "url('/background.jpg')"}}>
        <TTSProvider>
            {/* 添加一层半透明遮罩，让文字更清晰 */}
            <div className="w-full min-h-screen bg-white/10 backdrop-blur-sm flex flex-col items-center">
                <h1 className="text-3xl font-extrabold text-slate-800 my-6 text-center shadow-sm px-4 py-2 bg-white/30 rounded-lg">{mockLesson.title}</h1>
                <div className="w-full flex-grow">
                    <InteractiveLessonBlock lesson={mockLesson} onProgress={saveProgress} />
                </div>
            </div>
        </TTSProvider>
    </div>
  );
}
