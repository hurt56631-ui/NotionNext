// components/Tixing/LessonPlayer.jsx (最终完整版 - 兼容您的数据结构)

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaCog, FaTimes } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useSwipeable } from 'react-swipeable';
import { Transition } from '@headlessui/react';

// --- 导入您所有的题型组件 ---
 //import LianXianTi from './LianXianTi';
 //import XuanZeTi from './XuanZeTi';

// 临时的占位符组件，请用您自己的组件替换
const XuanZeTi = ({ data, onComplete }) => <div className="w-full max-w-md mx-auto bg-white/80 p-6 rounded-xl shadow-lg"><p className="font-bold">{data.prompt}</p><p>这是一个选择题占位符。</p><button onClick={onComplete} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">点击完成</button></div>;
const LianXianTi = ({ data, onComplete }) => <div className="w-full max-w-md mx-auto bg-white/80 p-6 rounded-xl shadow-lg"><p className="font-bold">{data.prompt || data.title}</p><p>这是一个连线题占位符。</p><button onClick={onComplete} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">点击完成</button></div>;

/* ===================== 1. TTS Hook (完整版) ===================== */
function useBilingualTTS() {
  const activeHowlsRef = useRef([]);
  const progressIntervalRef = useRef(null);
  const onEndCallbackRef = useRef(null);
  const [playerState, setPlayerState] = useState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 });
  const cleanup = useCallback((finished = false) => { clearInterval(progressIntervalRef.current); activeHowlsRef.current.forEach(h => { h.howl.stop(); h.howl.unload(); if (h.audioUrl) URL.revokeObjectURL(h.audioUrl); }); activeHowlsRef.current = []; setPlayerState({ isLoading: false, isPlaying: false, duration: 0, seek: 0 }); if (finished && onEndCallbackRef.current) { onEndCallbackRef.current(); onEndCallbackRef.current = null; } }, []);
  const play = useCallback(async (text, { onEnd, primaryVoice = 'zh-CN-XiaoyouNeural', secondaryVoice = 'my-MM-NilarNeural' } = {}) => {
    onEndCallbackRef.current = onEnd;
    cleanup(false);
    if (!text || text.trim() === '') { cleanup(true); return; }
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
        await new Promise((resolve, reject) => { howl.once('load', resolve); howl.once('loaderror', reject); });
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
    } catch (error) { console.error("TTS 加载或播放失败:", error); alert("音频加载失败"); cleanup(false); }
  }, [cleanup]);
  const stop = useCallback(() => cleanup(false), [cleanup]);
  useEffect(() => () => cleanup(false), [cleanup]);
  return { play, stop, ...playerState };
}

/* ===================== 2. TTS Context & Provider (完整版) ===================== */
const TTSContext = createContext(null);
export function TTSProvider({ children }) { const ttsControls = useBilingualTTS(); const value = useMemo(() => ttsControls, [ttsControls]); return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>; }
export const useTTS = () => useContext(TTSContext);

/* ===================== 3. 所有 UI 子组件 (完整版) ===================== */
const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const TTS_VOICES = { zh: [{ value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }], my: [{ value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }] };
    return ( <Transition show={true} as={React.Fragment} enter="transition ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"> <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}> <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}> <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700"> <h2 className="text-lg font-bold text-gray-800 dark:text-white">播放设置</h2> <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white"><FaTimes /></button> </div> <div className="p-6 space-y-6"> <div> <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">中文发音人</label> <select value={settings.primaryVoice} onChange={e => setSettings(s => ({...s, primaryVoice: e.target.value}))} className="w-full p-2 rounded-md border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"> {TTS_VOICES.zh.map(v => <option key={v.value} value={v.value}>{v.label}</option>)} </select> </div> <div> <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">缅甸语发音人</label> <select value={settings.secondaryVoice} onChange={e => setSettings(s => ({...s, secondaryVoice: e.target.value}))} className="w-full p-2 rounded-md border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"> {TTS_VOICES.my.map(v => <option key={v.value} value={v.value}>{v.label}</option>)} </select> </div> <div className="flex items-center justify-between"> <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">显示字幕</span> <label className="relative inline-flex items-center cursor-pointer"> <input type="checkbox" checked={settings.showSubtitles} onChange={e => setSettings(s => ({...s, showSubtitles: e.target.checked}))} className="sr-only peer" /> <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div> </label> </div> </div> </div> </div> </Transition> );
};
const TeachingDisplay = ({ sentence }) => {
    const pinyinText = useMemo(() => pinyin(sentence.text || '', { type: 'html', ruby: true }), [sentence.text]);
    return ( <div className="w-full flex-grow flex flex-col justify-center items-center text-center p-4"> <div className="space-y-4" style={{ textShadow: '1px 1px 3px rgba(50,50,50,0.2)' }}> <div className="text-3xl lg:text-4xl font-bold text-slate-800 leading-loose" style={{ fontFamily: 'var(--font-serif)', rubyPosition: 'over' }} dangerouslySetInnerHTML={{ __html: pinyinText }} /> {sentence.translation && <p className="text-xl lg:text-2xl text-slate-600 opacity-90">{sentence.translation}</p>} </div> </div> );
};
const FloatingSubtitle = ({ text, settings }) => {
    if (!settings.showSubtitles || !text) return null;
    const { isPlaying, duration, seek } = useTTS();
    const cleanText = text.replace(/\{\{/g, '').replace(/\}\}/g, '');
    const chars = useMemo(() => Array.from(cleanText), [cleanText]);
    const totalChars = chars.length;
    const highlightCount = useMemo(() => { if (!isPlaying || duration === 0) return 0; const progress = seek / duration; return Math.floor(progress * totalChars); }, [seek, duration, isPlaying, totalChars]);
    return (<div className="w-full px-4"><p className="text-2xl leading-relaxed text-slate-800 text-center font-medium" style={{ textShadow: '1px 1px 2px rgba(255,255,255,0.5)' }}> {chars.map((char, i) => ( <span key={i} className={`transition-opacity duration-300 ${i < highlightCount ? 'opacity-100 text-blue-600 font-bold' : 'opacity-0'}`}> {char} </span> ))} </p></div>);
};
const BottomControls = ({ onPrev, onNext, onPlay, onSettings, isPlaying, isLoading, current, total }) => (
    <div className="w-full flex justify-center items-center p-4"> <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md border border-white/30 rounded-full shadow-lg px-3 py-2"> <button className="text-slate-600 hover:text-black" onClick={onPrev}><FiChevronLeft size={22} /></button> <div className="text-slate-700 font-semibold text-sm w-12 text-center">{current + 1} / {total}</div> <button className="text-slate-600 hover:text-black" onClick={onNext}><FiChevronRight size={22} /></button> <div className="w-px h-6 bg-slate-300 mx-1"></div> <button className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-md ${isPlaying ? 'bg-yellow-500' : 'bg-blue-500'} ${isLoading && 'animate-pulse'}`} onClick={onPlay} disabled={isLoading}> {isPlaying ? <FaPause size={12} /> : (isLoading ? '..' : <FaPlay size={12} className="ml-0.5"/>)} </button> <button className="text-slate-600 hover:text-black" onClick={onSettings}><FaCog size={18} /></button> </div> </div>
);


/* ===================== 终极播放器组件 (使用您的数据结构) ===================== */
function LessonPlayerInternal({ lesson, onProgress }) {
    const [settings, setSettings] = useState(() => { const saved = typeof window !== 'undefined' ? localStorage.getItem('lessonPlayerSettings') : null; return saved ? JSON.parse(saved) : { primaryVoice: 'zh-CN-XiaoyouNeural', secondaryVoice: 'my-MM-NilarNeural', showSubtitles: true }; });
    useEffect(() => { localStorage.setItem('lessonPlayerSettings', JSON.stringify(settings)); }, [settings]);
    
    const pages = useMemo(() => {
        if (!lesson?.blocks) return [];
        const newPages = [];
        lesson.blocks.forEach(block => {
            if (block.sentence?.text) { newPages.push({ id: block.id, type: 'teaching', content: block.sentence }); }
            if (block.questions && block.questions.length > 0) {
                block.questions.forEach(question => { newPages.push({ id: question.id, type: question.type, content: question }); });
            }
        });
        return newPages;
    }, [lesson]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { play, stop, isPlaying, isLoading } = useTTS();
    
    const currentPage = pages[currentIndex];

    useEffect(() => { const savedIndex = localStorage.getItem(`lesson-progress-${lesson.id}`); if (savedIndex) { const idx = parseInt(savedIndex, 10); if (idx < pages.length) setCurrentIndex(idx); } }, [lesson.id, pages.length]);
    useEffect(() => { localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex); }, [currentIndex, lesson.id]);
    
    const goTo = useCallback((index) => { stop(); const newIndex = Math.max(0, Math.min(index, pages.length - 1)); setCurrentIndex(newIndex); }, [pages.length, stop]);
    const handlePlay = () => { if (isPlaying) { stop(); } else if (currentPage?.type === 'teaching') { play(currentPage.content.text, { onEnd: () => goTo(currentIndex + 1) }); } };
    const swipeHandlers = useSwipeable({ onSwipedLeft: () => goTo(currentIndex + 1), onSwipedRight: () => goTo(currentIndex - 1), preventDefaultTouchmoveEvent: true, trackMouse: true });
    
    const renderQuestionComponent = (page) => {
        const props = { key: page.id, data: page.content, onComplete: () => goTo(currentIndex + 1) };
        switch (page.type) {
            case 'choice': return <XuanZeTi {...props} />;
            case 'matching': return <LianXianTi {...props} />;
            default: return <div className="text-red-500">未知题型: {page.type}</div>;
        }
    };

    if (!currentPage) { return <div className="w-full h-full flex items-center justify-center bg-gray-100 text-red-500">课程数据无效或为空</div>; }

    return (
        <div {...swipeHandlers} className="w-full h-full bg-cover bg-center bg-fixed select-none relative" style={{backgroundImage: "url('/background.jpg')"}}>
            <div className="relative w-full h-full flex flex-col justify-between">
                {currentPage.type === 'teaching' ? (
                    <TeachingDisplay sentence={currentPage.content} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {renderQuestionComponent(currentPage)}
                    </div>
                )}
                <div className="w-full">
                    {currentPage.type === 'teaching' && <FloatingSubtitle text={currentPage.content.text || ''} settings={settings} />}
                </div>
                <BottomControls
                    current={currentIndex} total={pages.length}
                    onPrev={() => goTo(currentIndex - 1)} onNext={() => goTo(currentIndex + 1)}
                    onPlay={handlePlay} onSettings={() => setIsSettingsOpen(true)}
                    isPlaying={isPlaying} isLoading={isLoading}
                />
            </div>
            {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        </div>
    );
}

// 外层包裹 Provider
export default function LessonPlayer(props) {
    const { lesson, onProgress } = props;
    return (
        <TTSProvider>
            <LessonPlayerInternal lesson={lesson} onProgress={onProgress} />
        </TTSProvider>
    );
}
