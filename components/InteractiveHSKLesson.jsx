// components/InteractiveHSKLesson.jsx (已升级 - 自动生成拼音)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro'; // 引入 pinyin-pro 用于自动注音

/* ===================== 1. TTS Hook (使用 LibreTTS) - 保持不变 ===================== */
function useLibreTTS() {
  const howlRef = useRef(null);
  const audioUrlRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const [playerState, setPlayerState] = useState({
    isLoading: false, isPlaying: false, duration: 0, seek: 0,
  });

  const cleanup = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    if (howlRef.current) { howlRef.current.stop(); howlRef.current.unload(); }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); }
    howlRef.current = null; audioUrlRef.current = null;
    setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
  }, []);

  const play = useCallback(async (text, { voice = 'zh-CN-XiaoyouNeural' } = {}) => {
    cleanup();
    setPlayerState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('https://libretts.is-an.org/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate: 0, pitch: 0 }),
      });
      if (!response.ok) throw new Error('API Error');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const howl = new Howl({ src: [audioUrl], format: ['mpeg'], html5: true });
      howlRef.current = howl;
      
      howl.once('load', () => {
        setPlayerState(prev => ({ ...prev, isLoading: false, duration: howl.duration() }));
        howl.play();
      });
      howl.on('play', () => {
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
        progressIntervalRef.current = setInterval(() => setPlayerState(prev => ({ ...prev, seek: howl.seek() || 0 })), 100);
      });
      howl.on('pause', () => { clearInterval(progressIntervalRef.current); setPlayerState(prev => ({ ...prev, isPlaying: false })); });
      howl.on('stop', () => { clearInterval(progressIntervalRef.current); setPlayerState(prev => ({ ...prev, isPlaying: false, seek: 0 })); });
      howl.on('end', cleanup);
      howl.on('loaderror', cleanup);
    } catch (error) { console.error("TTS 加载失败:", error); alert("音频加载失败"); cleanup(); }
  }, [cleanup]);

  const pause = useCallback(() => howlRef.current?.pause(), []);
  const resume = useCallback(() => howlRef.current?.play(), []);
  const cancel = useCallback(() => howlRef.current?.stop(), []);

  useEffect(() => cleanup, [cleanup]);

  return { play, pause, resume, cancel, ...playerState };
}

/* ===================== 2. TTS Context & Provider - 保持不变 ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useLibreTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);


/* ===================== 3. SubtitleBar - 保持不变 ===================== */
export function SubtitleBar({ text, className }) {
  const { isPlaying, duration, seek } = useTTS();
  const words = useMemo(() => text ? pinyin(text, { type: 'array' }) : [], [text]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  useEffect(() => {
    if (!isPlaying || duration === 0) {
      if (!isPlaying) setHighlightIndex(-1);
      return;
    }
    const progress = seek / duration;
    const newIndex = Math.floor(progress * words.length);
    setHighlightIndex(newIndex);
  }, [seek, duration, isPlaying, words.length]);

  return (
    <div className={`w-full p-3 rounded-md bg-white/90 shadow-sm ${className || ''}`}>
      <div className="flex flex-wrap gap-x-1 text-lg leading-relaxed text-slate-900">
        {words.map((w, i) => (
          <span key={i} className={`px-1 py-0.5 rounded transition-colors duration-200 ${i <= highlightIndex ? 'bg-yellow-300/80 font-semibold' : 'bg-transparent'}`}>
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}


/* ===================== 4. Blackboard (✅ 已升级) ===================== */
export function Blackboard({ sentence, showPinyin = true, className }) {
  const { play, pause, resume, cancel, isPlaying, isLoading } = useTTS();

  // ✅ 核心升级：在这里自动生成拼音
  const pinyinText = useMemo(() => {
    // 如果数据中已经手动提供了pinyin，则优先使用
    if (sentence.pinyin) {
      return sentence.pinyin;
    }
    // 否则，根据 text 自动生成
    if (sentence.text) {
      return pinyin(sentence.text, { toneType: 'symbol', separator: ' ' });
    }
    return '';
  }, [sentence.text, sentence.pinyin]);

  return (
    <div className={`max-w-4xl mx-auto p-6 rounded-2xl shadow-2xl bg-cover bg-center ${className || ''}`} style={{backgroundImage: "url('/images/chalkboard-bg.png')"}}>
      <div className="grid grid-cols-1 md:grid-cols-8 gap-6 items-start">
        <div className="md:col-span-5">
          <div className="relative overflow-hidden rounded-xl p-6 bg-black/40">
            <div className="text-2xl md:text-3xl font-bold tracking-tight leading-tight break-words" style={{ fontFamily: 'cursive' }}>
              {sentence.text}
            </div>
            {/* ✅ 使用我们生成的 pinyinText */}
            {showPinyin && pinyinText && <div className="mt-2 text-base opacity-80 font-sans">{pinyinText}</div>}
            {sentence.translation && <div className="mt-3 text-base text-amber-100/80 font-sans">{sentence.translation}</div>}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button className="px-5 py-2 bg-amber-400 text-black rounded-md font-bold shadow hover:scale-105 transition disabled:opacity-50" onClick={() => play(sentence.text)} disabled={isLoading}>
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
            <SubtitleBar text={sentence.text} />
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="p-4 rounded-xl bg-white/10 border border-white/10">
            <div className="text-base text-slate-200 font-semibold mb-2">学习操作</div>
            <ol className="list-decimal list-inside text-slate-300 text-sm space-y-1">
              <li>点击播放听例句</li>
              <li>例句播放后会自动激活下方题目</li>
              <li>完成题目，系统会记录进度</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ===================== 5. Question & InteractiveBlock - 保持不变 ===================== */
export function ChoiceQuestion({ question, onAnswer }) { const [selected, setSelected] = useState(null); const [result, setResult] = useState(null); function submit() { const ok = selected === question.correctId; setResult(ok); onAnswer && onAnswer({ ok, selected }); } return ( <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/10 rounded-lg text-white"> <div className="font-medium mb-2">听力选择题</div> <div className="text-slate-200 mb-3">{question.prompt}</div> <div className="grid gap-2"> {question.choices.map(c => ( <button key={c.id} onClick={() => setSelected(c.id)} className={`text-left p-3 rounded-md transition-colors ${selected===c.id? 'bg-amber-300 text-black font-bold': 'bg-white/5 text-slate-200 hover:bg-white/10'}`}> {c.text} </button> ))} </div> <div className="flex gap-2 mt-3"> <button className="px-4 py-2 bg-emerald-500 rounded-md disabled:opacity-50" onClick={submit} disabled={!selected}>提交</button> {result !== null && ( <div className={`px-3 py-2 rounded-md ${result? 'bg-green-600':'bg-red-600'}`}> {result ? '回答正确' : '回答错误' } </div> )} </div> </div> ); }
export function MatchingQuestion({ question, onAnswer }) { return ( <div className="max-w-3xl mx-auto mt-4 p-4 bg-white/10 rounded-lg text-white"> <div className="font-medium mb-2">连线题（示例）</div> <div className="text-slate-200">请将此组件替换为您自己的 LianXianTi.js</div> </div> ); }
export function InteractiveLessonBlock({ lesson, onProgress }) { const [currentIndex, setCurrentIndex] = useState(0); const { cancel } = useTTS(); const currentBlock = lesson.blocks[currentIndex]; const goToNext = () => { cancel(); if (currentIndex < lesson.blocks.length - 1) { setCurrentIndex(currentIndex + 1); } }; const goToPrev = () => { cancel(); if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); } }; function handleAnswer({ ok }) { onProgress && onProgress({ lessonId: lesson.id, blockId: currentBlock.id, ok }); if (ok) { setTimeout(goToNext, 800); } } return ( <div className="space-y-6"> <Blackboard sentence={currentBlock.sentence} /> <div className="max-w-4xl mx-auto"> {currentBlock.questions.map((q) => ( q.type === 'choice' ? (<ChoiceQuestion key={q.id} question={q} onAnswer={handleAnswer} />) : (<MatchingQuestion key={q.id} question={q} onAnswer={handleAnswer} />) ))} </div> <div className="max-w-4xl mx-auto flex justify-between items-center text-white"> <div className="text-sm text-slate-400">第 {currentIndex + 1} / {lesson.blocks.length} 节</div> <div className="flex gap-2"> <button className="px-3 py-2 rounded bg-white/10" onClick={goToPrev}>上一个</button> <button className="px-3 py-2 rounded bg-white/10" onClick={goToNext}>下一个</button> </div> </div> </div> ); }


/* ===================== 6. 最终的 Demo 页面 (✅ 数据已简化) ===================== */
export default function DemoLessonPage() {
  const mockLesson = {
    id: 'hsk1-lesson5',
    title: 'HSK 第五课：她女儿今年二十岁',
    blocks: [
      { 
        id: 'b1', 
        sentence: { 
          text: '你女儿几岁了？',
          // ✅ Pinyin 字段现在是可选的了！
          // pinyin: "Nǐ nǚ'ér jǐ suì le?",  <-- 您可以删掉这一行
          translation: 'How old is your daughter?' 
        }, 
        questions: [] 
      },
      { 
        id: 'b2', 
        sentence: { 
          text: '她今年四岁了。', 
          translation: 'She is four years old this year.' 
        },
        questions: [
          { 
            id: 'q1', 
            type: 'choice', 
            prompt: '"她今年四岁了" 的意思是：', 
            choices: [
                {id:'c1', text:'She is 40 years old.'}, 
                {id:'c2', text:'Her daughter is 4 years old.'}, 
                {id:'c3', text:'She is 4 years old this year.'}
            ], 
            correctId: 'c3' 
          }
        ]
      },
      { 
        id: 'b3', 
        sentence: { 
          text: '李老师多大了？',
          translation: 'How old is Professor Li?'
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
