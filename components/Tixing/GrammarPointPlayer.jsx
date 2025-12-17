import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { html as pinyinHtml } from 'pinyin-pro'; 
import { 
  FaPlay, FaPause, FaChevronLeft, FaChevronRight, FaVolumeUp 
} from 'react-icons/fa';
import { Howl } from 'howler';

// =================================================================================
// 1. 音频 Hook
// =================================================================================
function useMixedTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioObjRef = useRef(null);

  const stop = () => {
    if (audioObjRef.current) {
      audioObjRef.current.stop();
      audioObjRef.current.unload();
    }
    setIsPlaying(false);
    setPlayingId(null);
  };

  const play = async (text, uniqueId) => {
    if (playingId === uniqueId && isPlaying) {
      stop();
      return;
    }
    stop();
    if (!text) return;

    setIsLoading(true);
    setPlayingId(uniqueId);

    const isBurmese = /[\u1000-\u109F]/.test(text);
    const voice = isBurmese ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;

    const sound = new Howl({
      src: [url],
      html5: true,
      onend: () => { setIsPlaying(false); setPlayingId(null); },
      onload: () => setIsLoading(false),
      onloaderror: () => { setIsLoading(false); setPlayingId(null); }
    });

    audioObjRef.current = sound;
    sound.play();
    setIsPlaying(true);
  };

  return { play, stop, isPlaying, playingId, isLoading };
}

// =================================================================================
// 2. 富文本渲染器 (核心修复：让表格和颜色显示出来)
// =================================================================================

const PinyinText = ({ text }) => {
  if (!text) return null;
  const html = pinyinHtml(text, { toneType: 'symbol' });
  return <span className="pinyin-ruby" dangerouslySetInnerHTML={{ __html: html }} />;
};

const ContentRenderer = ({ content, playFunc, playingId }) => {
  const elements = useMemo(() => {
    if (!content) return [];
    // 按行分割
    const lines = content.split('\n');
    const result = [];
    let tableBuffer = [];

    const flushTable = () => { 
        if (tableBuffer.length > 0) { 
            result.push({ type: 'table', rows: tableBuffer }); 
            tableBuffer = []; 
        } 
    };

    lines.forEach((line, index) => {
      const trim = line.trim();
      
      // 1. 识别表格 | ... |
      if (trim.startsWith('|') && trim.endsWith('|')) { 
          const cells = trim.split('|').filter(c => c).map(c => c.trim()); 
          // 忽略分割线 |---|
          if (!trim.includes('---')) tableBuffer.push(cells); 
          return; 
      }
      flushTable();
      
      if (trim === '') { result.push({ type: 'spacer' }); return; }

      // 2. 识别特定符号
      if (trim.startsWith('✅')) {
        result.push({ type: 'example_correct', text: trim, id: `line_${index}` });
      } else if (trim.startsWith('❌')) {
        result.push({ type: 'example_wrong', text: trim, id: `line_${index}` });
      } else if (trim.startsWith('##')) {
        result.push({ type: 'h2', text: trim.replace(/^##\s*/, '') });
      } else if (trim.startsWith('A:') || trim.startsWith('B:')) {
        const [role, ...rest] = trim.split(/[:：]/);
        result.push({ type: 'dialogue', role, text: rest.join(':').trim(), id: `dia_${index}` });
      } else {
        result.push({ type: 'text', text: trim });
      }
    });
    flushTable();
    return result;
  }, [content]);

  return (
    <div className="space-y-4">
      {elements.map((el, i) => {
        switch (el.type) {
          case 'h2': 
            return <h2 key={i} className="text-xl font-black text-slate-800 mt-6 mb-3 border-b-2 border-slate-100 pb-2">{el.text}</h2>;
          
          case 'table': 
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-slate-200 my-4">
                <table className="w-full text-sm text-left">
                  <tbody>
                    {el.rows.map((row, rIndex) => (
                      <tr key={rIndex} className={rIndex === 0 ? "bg-slate-100 font-bold text-slate-600" : "border-t border-slate-100"}>
                        {row.map((cell, cIndex) => (
                          <td key={cIndex} className="p-3"><PinyinText text={cell} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'example_correct':
            return (
              <div key={i} onClick={() => playFunc(el.text.replace('✅',''), el.id)} 
                   className={`p-3 rounded-lg flex gap-3 cursor-pointer transition-all border-l-4 ${playingId === el.id ? 'bg-green-100 border-green-500 scale-[1.02]' : 'bg-green-50 border-green-400 hover:bg-green-100'}`}>
                 <div className="text-green-600 mt-1"><FaVolumeUp size={14}/></div>
                 <div className="text-green-800 font-medium"><PinyinText text={el.text.replace('✅','')} /></div>
              </div>
            );

          case 'example_wrong':
            return (
              <div key={i} className="p-3 rounded-lg flex gap-3 bg-red-50 border-l-4 border-red-400 text-red-800 opacity-80">
                 <div className="mt-1">❌</div>
                 <div><PinyinText text={el.text.replace('❌','')} /></div>
              </div>
            );

          case 'dialogue':
            const isB = el.role === 'B';
            return (
               <div key={i} onClick={() => playFunc(el.text, el.id)} className={`flex gap-3 mb-2 ${isB ? 'flex-row-reverse' : ''} cursor-pointer`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${isB ? 'bg-blue-500' : 'bg-orange-500'}`}>{el.role}</div>
                  <div className={`py-2 px-4 rounded-2xl text-sm max-w-[80%] ${isB ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'} ${playingId === el.id ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}>
                      <PinyinText text={el.text} />
                  </div>
               </div>
            );

          case 'spacer': return <div key={i} className="h-2" />;
          
          default: 
            return <p key={i} className="text-slate-600 leading-relaxed"><PinyinText text={el.text} /></p>;
        }
      })}
    </div>
  );
};

// =================================================================================
// 3. 悬浮播放条 (右下角的小控制条)
// =================================================================================
const FloatingPlayer = ({ isPlaying, isLoading, onToggle, title }) => (
    <div className="fixed bottom-24 right-4 z-50">
        <div className="bg-white/90 backdrop-blur-md border border-white p-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 pr-6">
            <button 
                onClick={onToggle}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all ${isPlaying ? 'bg-blue-500' : 'bg-slate-800 hover:scale-105'}`}
            >
                {isLoading ? <span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-5 h-5"/> : (isPlaying ? <FaPause /> : <FaPlay className="ml-1"/>)}
            </button>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">讲解音频</span>
                <span className="text-sm font-bold text-slate-700 max-w-[120px] truncate">{isPlaying ? "播放中..." : "点击播放讲解"}</span>
            </div>
        </div>
    </div>
);

// =================================================================================
// 4. 主组件
// =================================================================================
const GrammarPointPlayer = ({ grammarPoints, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { play, stop, isPlaying, playingId, isLoading } = useMixedTTS();
  const scrollRef = useRef(null);

  // 注入拼音样式
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('ruby-css')) {
      const style = document.createElement('style');
      style.id = 'ruby-css';
      style.innerHTML = `ruby { ruby-align: center; } rt { font-size: 0.5em; color: #94a3b8; user-select: none; }`;
      document.head.appendChild(style);
    }
  }, []);

  const currentGp = grammarPoints[currentIndex];

  const handleNext = () => {
      stop();
      if (currentIndex < grammarPoints.length - 1) {
          setCurrentIndex(p => p + 1);
          // 切换页面时，滚动条回到顶部
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
      } else {
          onComplete();
      }
  };

  const handlePrev = () => {
      stop();
      if (currentIndex > 0) setCurrentIndex(p => p - 1);
  };

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: 'translateX(20px)' },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, position: 'absolute' },
    config: { duration: 200 },
  });

  return (
    <div className="absolute inset-0 flex flex-col bg-white overflow-hidden">
        
        {/* 顶部标题栏 */}
        <div className="flex-none px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-slate-100 z-10 flex justify-between items-center">
            <div className="text-sm font-black text-slate-300">GRAMMAR</div>
            <div className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                {currentIndex + 1} / {grammarPoints.length}
            </div>
        </div>

        {/* 滚动内容区域 (使用 flex-1 和 overflow-y-auto 实现独立滚动) */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto relative w-full scroll-smooth">
            {transitions((style, i) => {
                const gp = grammarPoints[i];
                if(!gp) return null;
                return (
                    <animated.div style={style} className="w-full min-h-full p-6 pb-32 max-w-3xl mx-auto">
                        
                        {/* 标题 */}
                        <div className="text-center mb-8">
                            <h1 className="text-3xl font-black text-slate-800 mb-4 leading-tight">
                                {gp['语法标题'] || gp.title}
                            </h1>
                            {gp['句型结构'] && (
                                <div className="inline-block bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-mono text-sm font-bold border border-blue-100">
                                    <PinyinText text={gp['句型结构']} />
                                </div>
                            )}
                        </div>

                        {/* 讲解内容 (富文本) */}
                        <ContentRenderer 
                            content={gp['语法详解'] || gp.explanation} 
                            playFunc={play}
                            playingId={playingId}
                        />

                    </animated.div>
                );
            })}
        </div>

        {/* 悬浮播放器 */}
        <FloatingPlayer 
            isPlaying={isPlaying && playingId === 'main'} 
            isLoading={isLoading}
            onToggle={() => play(currentGp['讲解脚本'] || currentGp['语法详解'], 'main')} 
        />

        {/* 底部导航 */}
        <div className="flex-none h-20 bg-white border-t border-slate-100 flex items-center justify-between px-6 z-20">
            <button 
                onClick={handlePrev} 
                disabled={currentIndex === 0}
                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${currentIndex === 0 ? 'border-slate-100 text-slate-200' : 'border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95'}`}
            >
                <FaChevronLeft />
            </button>

            <button 
                onClick={handleNext}
                className="flex-1 ml-4 h-12 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                {currentIndex === grammarPoints.length - 1 ? "完成学习" : "下一个"} <FaChevronRight size={12}/>
            </button>
        </div>
    </div>
  );
};

export default GrammarPointPlayer;
