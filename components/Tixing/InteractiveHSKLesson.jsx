// components/Tixing/InteractiveHSKLesson.jsx (最终版 - 支持中缅文无缝混读)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaStop } from 'react-icons/fa';

// =================================================================================
// ===== 1. 核心升级: 支持双语无缝播放的 TTS Hook =================================
// =================================================================================
function useBilingualTTS() {
  const activeHowlsRef = useRef([]);
  const progressIntervalRef = useRef(null);
  
  const [playerState, setPlayerState] = useState({
    isLoading: false, isPlaying: false, duration: 0, seek: 0,
  });

  const cleanup = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    activeHowlsRef.current.forEach(h => {
      h.howl.stop();
      h.howl.unload();
      URL.revokeObjectURL(h.audioUrl);
    });
    activeHowlsRef.current = [];
    setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
  }, []);

  const play = useCallback(async (text, {
    primaryVoice = 'zh-CN-XiaoyouNeural',
    secondaryVoice = 'my-MM-NilarNeural'
  } = {}) => {
    cleanup();
    setPlayerState(prev => ({ ...prev, isLoading: true }));

    // 步骤 1: 解析文本成语言片段
    const segments = text.split(/\{\{([^}]+)\}\}/g).map((part, index) => {
      const isSecondary = index % 2 === 1;
      return {
        text: part,
        voice: isSecondary ? secondaryVoice : primaryVoice
      };
    }).filter(p => p.text.trim() !== '');

    try {
      // 步骤 2: 并行预加载所有音频
      const audioFetchPromises = segments.map(segment => 
        fetch('https://libretts.is-an.org/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: segment.text, voice: segment.voice, rate: 0, pitch: 0 }),
        }).then(res => res.ok ? res.blob() : Promise.reject(`API Error for "${segment.text}"`))
      );
      
      const audioBlobs = await Promise.all(audioFetchPromises);

      const loadedHowls = [];
      let totalDuration = 0;

      // 创建 Howl 实例并计算总时长
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

      // 步骤 3: 创建播放队列
      let currentSegmentIndex = 0;
      const playNextSegment = () => {
        if (currentSegmentIndex >= loadedHowls.length) {
          cleanup();
          return;
        }
        
        const current = loadedHowls[currentSegmentIndex];
        current.howl.once('end', playNextSegment);
        current.howl.play();
        
        setPlayerState(prev => ({ ...prev, isPlaying: true }));

        // 更新进度条
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
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(() => activeHowlsRef.current.forEach(h => h.howl.pause()), []);
  const resume = useCallback(() => activeHowlsRef.current.forEach(h => { if(h.howl.state() === 'loaded') h.howl.play() }), []);
  const stop = useCallback(cleanup, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { play, pause, resume, stop, ...playerState };
}

/* ===================== 2. TTS Context & Provider (保持不变) ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useBilingualTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);

/* ===================== 3. SubtitleBar (保持不变) ===================== */
export function SubtitleBar({ text, className }) {
    const { isPlaying, duration, seek } = useTTS();
    const cleanText = text.replace(/\{\{/g, '').replace(/\}\}/g, '');
    const chars = useMemo(() => cleanText ? Array.from(cleanText) : [], [cleanText]);
    const totalChars = chars.length;
    const [highlightIndex, setHighlightIndex] = useState(-1);
    useEffect(() => { if (!isPlaying || duration === 0) { if (!isPlaying) setHighlightIndex(-1); return; } const progress = seek / duration; const newIndex = Math.min(Math.floor(progress * totalChars), totalChars - 1); setHighlightIndex(newIndex); }, [seek, duration, isPlaying, totalChars]);
    return (<div className={`w-full p-3 rounded-md bg-white/90 shadow-sm ${className || ''}`}> <div className="flex flex-wrap gap-x-0 text-lg leading-relaxed text-slate-900 justify-center"> {chars.map((char, i) => ( <span key={i} className={`px-0.5 py-0.5 rounded transition-colors duration-100 ${i <= highlightIndex ? 'bg-yellow-300/80 font-semibold' : 'bg-transparent'}`}> {char.trim() === '' ? '\u00A0' : char} </span> ))} </div> </div>);
}

/* ===================== 4. Blackboard (升级以支持新数据结构) ===================== */
export function Blackboard({ sentence, className }) {
  const { play, pause, resume, cancel, isPlaying, isLoading } = useTTS();
  const displayText = sentence.displayText || sentence.text;
  const narrationText = sentence.narrationText || sentence.text;
  const rubyMarkup = useMemo(() => { if (!displayText) return ''; return pinyin(displayText, { type: 'html', ruby: true }); }, [displayText]);
  return (
    <div className={`max-w-4xl mx-auto p-6 rounded-2xl shadow-2xl bg-cover bg-center ${className || ''}`} style={{backgroundImage: "url('/images/chalkboard-bg.png')"}}>
      <div className="grid grid-cols-1 md:grid-cols-8 gap-6 items-start">
        <div className="md:col-span-5">
          <div className="relative overflow-hidden rounded-xl p-6 bg-black/40">
            <div className="text-2xl md:text-3xl font-bold tracking-tight leading-loose break-words text-center" style={{ fontFamily: 'cursive', rubyPosition: 'over' }} dangerouslySetInnerHTML={{ __html: rubyMarkup }} />
            {sentence.translation && <div className="mt-4 text-center text-base text-amber-100/80 font-sans">{sentence.translation}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button className="px-5 py-2 bg-amber-400 text-black rounded-md font-bold shadow hover:scale-105 transition disabled:opacity-50" onClick={() => play(narrationText)} disabled={isLoading}>
              {isLoading ? '加载中...' : '播放'}
            </button>
            <button className="px-4 py-2 bg-slate-700 text-white rounded-md" onClick={pause}>暂停</button>
            <button className="px-4 py-2 bg-slate-700 text-white rounded-md" onClick={resume}>继续</button>
            <button className="px-4 py-2 bg-red-500 text-white rounded-md" onClick={cancel}>停止</button>
            <div className="ml-auto text-sm text-slate-300 flex items-center gap-2">
              {isPlaying && <span>正在朗读...</span>}
            </div>
          </div>
          <div className="mt-4">
            <SubtitleBar text={narrationText} />
          </div>
        </div>
        <div className="md:col-span-3">
          <div className="p-4 rounded-xl bg-white/10 border border-white/10">
            <div className="text-base text-slate-200 font-semibold mb-2">学习操作</div>
            <ol className="list-decimal list-inside text-slate-300 text-sm space-y-1">
              <li>点击播放听老师讲解</li>
              <li>讲解播放后会自动激活下方题目</li>
              <li>完成题目，系统会记录进度</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== 5. Question & InteractiveBlock (保持不变) ===================== */
export function ChoiceQuestion({ question, onAnswer }) { const [selected, setSelected] = useState(null); const [result, setResult] = useState(null); function submit() { const ok = selected === question.correctId; setResult(ok); onAnswer && onAnswer({ ok, selected }); } return ( <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/10 rounded-lg text-white"> <div className="font-medium mb-2">选择题</div> <div className="text-slate-200 mb-3">{question.prompt}</div> <div className="grid gap-2"> {question.choices.map(c => ( <button key={c.id} onClick={() => setSelected(c.id)} className={`text-left p-3 rounded-md transition-colors ${selected===c.id? 'bg-amber-300 text-black font-bold': 'bg-white/5 text-slate-200 hover:bg-white/10'}`}> {c.text} </button> ))} </div> <div className="flex gap-2 mt-3"> <button className="px-4 py-2 bg-emerald-500 rounded-md disabled:opacity-50" onClick={submit} disabled={!selected}>提交</button> {result !== null && ( <div className={`px-3 py-2 rounded-md ${result? 'bg-green-600':'bg-red-600'}`}> {result ? '回答正确' : '回答错误' } </div> )} </div> </div> ); }
export function MatchingQuestion({ question, onAnswer }) { return ( <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/10 rounded-lg text-white"> <div className="font-medium mb-2">连线题（示例）</div> <div className="text-slate-200">请将此组件替换为您自己的 LianXianTi.js</div> </div> ); }
export function InteractiveLessonBlock({ lesson, onProgress }) { const [currentIndex, setCurrentIndex] = useState(0); const { cancel } = useTTS(); const currentBlock = lesson.blocks[currentIndex]; const goToNext = () => { cancel(); if (currentIndex < lesson.blocks.length - 1) { setCurrentIndex(currentIndex + 1); } }; const goToPrev = () => { cancel(); if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); } }; function handleAnswer({ ok }) { onProgress && onProgress({ lessonId: lesson.id, blockId: currentBlock.id, ok }); if (ok) { setTimeout(goToNext, 800); } } return ( <div className="space-y-6"> <Blackboard sentence={currentBlock.sentence} /> <div className="max-w-4xl mx-auto"> {currentBlock.questions.map((q) => ( q.type === 'choice' ? (<ChoiceQuestion key={q.id} question={q} onAnswer={handleAnswer} />) : (<MatchingQuestion key={q.id} question={q} onAnswer={handleAnswer} />) ))} </div> <div className="max-w-4xl mx-auto flex justify-between items-center text-white"> <div className="text-sm text-slate-400">第 {currentIndex + 1} / {lesson.blocks.length} 节</div> <div className="flex gap-2"> <button className="px-3 py-2 rounded bg-white/10" onClick={goToPrev}>上一个</button> <button className="px-3 py-2 rounded bg-white/10" onClick={goToNext}>下一个</button> </div> </div> </div> ); }

/* ===================== 6. 最终的 Demo 页面 (✅ 数据已更新) ===================== */
export default function DemoLessonPage() {
  const mockLesson = {
    id: 'hsk1-lesson5-bilingual',
    title: '中缅双语混合朗读示例',
    blocks: [
      { 
        id: 'b1', 
        sentence: {
          displayText: '你好 / မင်္ဂလာပါ',
          // ✅ 使用新的混编格式
          narrationText: '“你好”的缅甸语是 {{မင်္ဂလာပါ}}',
          translation: 'Hello / Mingalarpar' 
        }, 
        questions: [] 
      },
      { 
        id: 'b2', 
        sentence: { 
          displayText: '她是老师。',
          // ✅ 另一个混编例子
          narrationText: '中文说“她是老师”，翻译成缅甸语是 {{သူမသည်ဆရာမဖြစ်သည်။}}',
          translation: 'She is a teacher.' 
        },
        questions: []
      }
    ]
  };

  function saveProgress(p) { console.log('保存进度', p); }

  return (
    <TTSProvider>
      <div className="min-h-screen py-10 px-4 bg-slate-800">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-white mb-6">{mockLesson.title}</h1>
          <InteractiveLessonBlock lesson={mockLesson} onProgress={saveProgress} />
        </div>
      </div>
    </TTSProvider>
  );
}
