// components/Tixing/LessonPlayer.jsx

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howl } from 'howler';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaPause, FaCog, FaTimes, FaRedoAlt } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useSwipeable } from 'react-swipeable';
import { Transition } from '@headlessui/react';

// --- 导入您所有的题型组件 ---
// 您需要根据实际路径修改
import LianXianTi from './LianXianTi';
import XuanZeTi from './XuanZeTi';
// ... 导入其他题型组件

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

// 设置面板
const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const TTS_VOICES = {
        zh: [{ value: 'zh-CN-XiaoxiaoNeural', label: '中文女声 (晓晓)' }, { value: 'zh-CN-XiaoyouNeural', label: '中文女声 (晓悠)' }],
        my: [{ value: 'my-MM-NilarNeural', label: '缅甸语女声' }, { value: 'my-MM-ThihaNeural', label: '缅甸语男声' }]
    };
    return (
        <Transition show={true} as={React.Fragment} enter="transition ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">播放设置</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white"><FaTimes /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">中文发音人</label>
                            <select value={settings.primaryVoice} onChange={e => setSettings(s => ({...s, primaryVoice: e.target.value}))} className="w-full p-2 rounded-md border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                {TTS_VOICES.zh.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">缅甸语发音人</label>
                            <select value={settings.secondaryVoice} onChange={e => setSettings(s => ({...s, secondaryVoice: e.target.value}))} className="w-full p-2 rounded-md border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                {TTS_VOICES.my.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">显示字幕</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={settings.showSubtitles} onChange={e => setSettings(s => ({...s, showSubtitles: e.target.checked}))} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    );
};


// 教学内容展示组件
const TeachingDisplay = ({ content }) => {
    const renderContent = (item) => {
        if (typeof item === 'string') return pinyin(item, { type: 'html', ruby: true });
        if (item.type === 'bold') return `<strong>${pinyin(item.content, { type: 'html', ruby: true })}</strong>`;
        if (item.type === 'highlight') return `<span class="text-blue-500 font-bold">${pinyin(item.content, { type: 'html', ruby: true })}</span>`;
        return '';
    };

    const markup = useMemo(() => {
        if (!content.displayText) return '';
        const textToProcess = Array.isArray(content.displayText) ? content.displayText.map(renderContent).join(' ') : pinyin(content.displayText, { type: 'html', ruby: true });
        return textToProcess.replace(/(\r\n|\n|\r)/gm, "<br/>");
    }, [content.displayText]);

    return (
        <div className="w-full flex-grow flex flex-col justify-center items-center text-center p-4">
            {content.imageUrl && <img src={content.imageUrl} alt="Illustration" className="max-w-xs max-h-56 rounded-2xl shadow-2xl mb-8" />}
            <div className="space-y-4" style={{ textShadow: '1px 1px 3px rgba(50,50,50,0.2)' }}>
                <div 
                    className="text-3xl lg:text-4xl font-bold text-slate-800 leading-loose"
                    style={{ fontFamily: 'var(--font-serif)', rubyPosition: 'over' }}
                    dangerouslySetInnerHTML={{ __html: markup }}
                />
                {content.translation && <p className="text-xl lg:text-2xl text-slate-600 opacity-90">{content.translation}</p>}
            </div>
        </div>
    );
};

// 无背景字幕
const FloatingSubtitle = ({ text, settings }) => {
    if (!settings.showSubtitles || !text) return null;
    const { isPlaying, duration, seek } = useTTS();
    const cleanText = text.replace(/\{\{/g, '').replace(/\}\}/g, '');
    const chars = useMemo(() => Array.from(cleanText), [cleanText]);
    const totalChars = chars.length;
    const highlightCount = useMemo(() => { if (!isPlaying || duration === 0) return 0; const progress = seek / duration; return Math.floor(progress * totalChars); }, [seek, duration, isPlaying, totalChars]);
    return (<div className="w-full px-4"><p className="text-2xl leading-relaxed text-slate-800 text-center font-medium" style={{ textShadow: '1px 1px 2px rgba(255,255,255,0.5)' }}> {chars.map((char, i) => ( <span key={i} className={`transition-opacity duration-300 ${i < highlightCount ? 'opacity-100 text-blue-600 font-bold' : 'opacity-0'}`}> {char} </span> ))} </p></div>);
};

// 底部中央控制台
const BottomControls = ({ onPrev, onNext, onPlay, onSettings, isPlaying, isLoading, current, total }) => (
    <div className="w-full flex justify-center items-center p-4">
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md border border-white/30 rounded-full shadow-lg px-3 py-2">
            <button className="text-slate-600 hover:text-black" onClick={onPrev}><FiChevronLeft size={22} /></button>
            <div className="text-slate-700 font-semibold text-sm w-12 text-center">{current + 1} / {total}</div>
            <button className="text-slate-600 hover:text-black" onClick={onNext}><FiChevronRight size={22} /></button>
            <div className="w-px h-6 bg-slate-300 mx-1"></div>
            <button
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-md ${isPlaying ? 'bg-yellow-500' : 'bg-blue-500'} ${isLoading && 'animate-pulse'}`}
                onClick={onPlay} disabled={isLoading}
            >
                {isPlaying ? <FaPause size={12} /> : (isLoading ? '..' : <FaPlay size={12} className="ml-0.5"/>)}
            </button>
            <button className="text-slate-600 hover:text-black" onClick={onSettings}><FaCog size={18} /></button>
        </div>
    </div>
);

/* ===================== 终极播放器组件 ===================== */
function LessonPlayerInternal({ lesson, onProgress }) {
    const [settings, setSettings] = useState(() => { const saved = typeof window !== 'undefined' ? localStorage.getItem('lessonPlayerSettings') : null; return saved ? JSON.parse(saved) : { primaryVoice: 'zh-CN-XiaoyouNeural', secondaryVoice: 'my-MM-NilarNeural', showSubtitles: true }; });
    useEffect(() => { localStorage.setItem('lessonPlayerSettings', JSON.stringify(settings)); }, [settings]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { play, stop, isPlaying, isLoading } = useTTS();
    const currentBlock = lesson.blocks[currentIndex];
    useEffect(() => { const savedIndex = localStorage.getItem(`lesson-progress-${lesson.id}`); if (savedIndex) { setCurrentIndex(parseInt(savedIndex, 10)); } }, [lesson.id]);
    useEffect(() => { localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex); }, [currentIndex, lesson.id]);
    
    const goTo = useCallback((index) => {
        stop();
        const newIndex = Math.max(0, Math.min(index, lesson.blocks.length - 1));
        setCurrentIndex(newIndex);
    }, [lesson.blocks.length, stop]);

    const handlePlay = () => {
        if (isPlaying) {
            stop();
        } else {
            const narrationText = currentBlock.content.narrationText || currentBlock.content.displayText;
            play(narrationText, { 
                onEnd: () => { if (currentBlock.type === 'teaching') { goTo(currentIndex + 1) } },
                primaryVoice: settings.primaryVoice,
                secondaryVoice: settings.secondaryVoice
            });
        }
    };

    const swipeHandlers = useSwipeable({ onSwipedLeft: () => goTo(currentIndex + 1), onSwipedRight: () => goTo(currentIndex - 1), preventDefaultTouchmoveEvent: true, trackMouse: true });
    
    const renderQuestionComponent = (block) => {
        const props = { key: block.id, data: block.content, onComplete: () => goTo(currentIndex + 1) };
        switch (block.type) {
            case 'choice': return <XuanZeTi {...props} />;
            case 'matching': return <LianXianTi {...props} />;
            default: return <div className="text-red-500">未知题型: {block.type}</div>;
        }
    };

    return (
        <div {...swipeHandlers} className="w-full h-full bg-cover bg-center bg-fixed select-none relative" style={{backgroundImage: "url('/background.jpg')"}}>
            <div className="relative w-full h-full flex flex-col justify-between">
                {currentBlock.type === 'teaching' ? (
                    <TeachingDisplay content={currentBlock.content} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {renderQuestionComponent(currentBlock)}
                    </div>
                )}
                <div className="w-full">
                    {currentBlock.type === 'teaching' && <FloatingSubtitle text={currentBlock.content.narrationText || ''} settings={settings} />}
                </div>
                <BottomControls
                    current={currentIndex} total={lesson.blocks.length}
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
    return <TTSProvider><LessonPlayerInternal {...props} /></TTSProvider>;
}

/* ===================== 6. 最终的 Demo 页面 (已使用您的完整教材内容) ===================== */
export function DemoLessonPage() {
    const mockLesson = {
        id: 'grammar-lesson-1',
        title: '句型模板与例句',
        blocks: [
          { type: 'teaching', id: 'b1', content: { displayText: [ {type: 'bold', content: '询问与介绍国籍'} ], narrationText: '在这一部分，我们将学习如何询问和介绍一个人的国籍。', translation: 'Asking and Introducing Nationality' } },
          { type: 'teaching', id: 'b2', content: { displayText: [ '模板1：', { type: 'highlight', content: '你是哪国人？' } ], narrationText: '我们来学习第一个核心句型：你是哪国人？这是询问国籍最直接、最常用的方式。当对长辈或者不熟悉的人提问时，记得使用更礼貌的“您”，说成：您是哪国人？', translation: 'Template 1: Which country are you from?', imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1888' } },
          { type: 'teaching', id: 'b3', content: { displayText: [ { type: 'bold', content: '语法点' }, '：“哪” vs “哪儿”' ], narrationText: '学习这个句型时，有一个非常重要的易错点，就是要区分“哪”和“哪儿”。“哪国人”是问国籍，而“去哪儿”是问地点。所以，你不能说“你是哪儿国人？”，这是错误的。', translation: 'Grammar: Distinguishing "nǎ" (which) from "nǎr" (where)' } },
          { type: 'teaching', id: 'b4', content: { displayText: 'A: 你是哪国人？\nB: 我是缅甸人。', narrationText: '现在请听一段对话。A问：你是哪国人？ {{မင်း ဘယ်နိုင်ငံသားလဲ။}} B回答：我是缅甸人。{{ကျွန်တော်က မြန်မာလူမျိုးပါ။}}', translation: 'A: Which country are you from? B: I am from Myanmar.' } },
          { type: 'choice', id: 'q1', content: { prompt: "对话中B是哪国人？", choices: [{"id":"c1", text:"中国人"}, {"id":"c2", text:"缅甸人"}, {"id":"c3", text:"美国人"}], correctId: "c2" } },
          { type: 'teaching', id: 'b5', content: { displayText: [ '模板2：', { type: 'highlight', content: '我是 [国家] 人。' } ], narrationText: '好的，学习了如何提问，现在我们学习如何回答。句型非常简单：我是，加上国家名字，再加一个“人”字就可以了。', translation: 'Template 2: I am [Country] person.', imageUrl: 'https://images.unsplash.com/photo-1556484687-3063616463de?q=80&w=1921' } },
          { type: 'teaching', id: 'b6', content: { displayText: '他不是美国人，他是英国人。', narrationText: '我们再来听一个否定和肯定的对比句：他不是美国人，他是英国人。{{သူက အမေရိကန်လူမျိုး မဟုတ်ဘူး၊ သူက အင်္ဂလိပ်လူမျိုးပါ။}}', translation: 'He is not American, he is British.' } },
          { type: 'matching', id: 'q2', content: { title: "国籍连线", columnA: [{id: "a1", content: "中国"}, {id: "a2", content: "缅甸"}, {id: "a3", content: "美国"}], columnB: [{id: "b1", content: "American"}, {id: "b2", content: "Chinese"}, {id: "b3", content: "Burmese"}], pairs: {"a1": "b2", "a2": "b3", "a3": "b1"} } },
          { type: 'teaching', id: 'b7', content: { displayText: [ { type: 'bold', content: '询问与介绍语言能力' } ], narrationText: '接下来，我们进入第二部分，学习如何询问和介绍自己会说什么语言。', translation: 'Asking and Introducing Language Ability' } },
          { type: 'teaching', id: 'b8', content: { displayText: [ '模板3：', { type: 'highlight', content: '你会说 [语言] 吗？' } ], narrationText: '询问别人是否掌握某种语言技能，我们要用助动词“会”。句型是：你会说汉语吗？', translation: 'Template 3: Can you speak [Language]?', imageUrl: 'https://images.unsplash.com/photo-1521153231182-93427b9c9023?q=80&w=1887' } },
          { type: 'teaching', id: 'b9', content: { displayText: [ { type: 'bold', content: '核心语法点' }, '：“会” vs “能”' ], narrationText: '这是一个非常重要的语法点！“会”表示通过学习掌握的技能，比如，我会开车，我会说汉语。而“能”表示客观条件允许。在询问是否会说某种语言时，我们必须用“会”。', translation: 'Core Grammar: "huì" vs "néng"' } },
          { type: 'teaching', id: 'b10', content: { displayText: [ '模板4 & 5：', { type: 'highlight', content: '描述熟练程度' } ], narrationText: '当回答你会说某种语言时，可以加上程度副词来描述你的熟练度。比如，我会说一点儿汉语。或者用更高级的“得”字补语，说：我的汉语说得不太好。', translation: 'Templates 4 & 5: Describing Proficiency', imageUrl: 'https://images.unsplash.com/photo-1544716278-e513176f20b5?q=80&w=1974' } },
          { type: 'teaching', id: 'b11', content: { displayText: 'A: 你的汉语说得真棒！\nB: 哪里哪里，还要多学习。', narrationText: '听一段关于鼓励与谦虚的对话。A说：你的汉语说得真棒！{{မင်းရဲ့တရုတ်စကားက တကယ်တော်တယ်!}} B回答：哪里哪里，还要多学习。{{မဟုတ်ပါဘူး၊ ဆက်ပြီးသင်ယူဖို့ လိုသေးတယ်။}}', translation: 'A: Your Chinese is really good! B: Not at all, I still need to learn more.' } },
          { type: 'choice', id: 'q3', content: { prompt: "当中国人夸奖你的中文时，最地道的谦虚回答是？", choices: [{"id":"c1", text:"是的，我很好。"}, {"id":"c2", text:"谢谢！"}, {"id":"c3", text:"哪里哪里。"}], correctId: "c3" } }
        ]
      };
    function saveProgress(p) { console.log('保存进度', p); }
    return <div className="w-full min-h-screen"><LessonPlayer lesson={mockLesson} onProgress={saveProgress} /></div>;
}
