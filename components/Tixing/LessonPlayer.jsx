// components/Tixing/LessonPlayer.jsx (最终完整健壮版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { pinyin } from 'pinyin-pro';
import { useSwipeable } from 'react-swipeable';

// --- 1. 动态导入您所有的题型组件 ---
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
const PaiXuTi = dynamic(() => import('@/components/Tixing/PaiXuTi'), { ssr: false });
const GaiCuoTi = dynamic(() => import('@/components/Tixing/GaiCuoTi'), { ssr: false });
const FanYiTi = dynamic(() => import('@/components/Tixing/FanYiTi'), { ssr: false });
const TingLiZhuJu = dynamic(() => import('@/components/Tixing/TingLiZhuJu'), { ssr: false });
const CiDianKa = dynamic(() => import('@/components/Tixing/CiDianKa'), { ssr: false });
const GengDuTi = dynamic(() => import('@/components/Tixing/GengDuTi'), { ssr: false });
const PanDuanTi = dynamic(() => import('@/components/Tixing/PanDuanTi'), { ssr: false });
const XuanZeTi = dynamic(() => import('@/components/Tixing/XuanZeTi'), { ssr: false });

// --- 2. 辅助组件与函数 (自包含) ---

// 拼音生成工具
const generateRubyHTML = (text) => {
  if (!text || typeof text !== 'string') return '';
  let html = '';
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      const pinyinStr = pinyin(char);
      html += `<ruby>${char}<rt>${pinyinStr}</rt></ruby>`;
    } else {
      html += char;
    }
  }
  return html;
};

// 教学页组件
const TeachingBlock = ({ content }) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full">
            <div className="text-5xl md:text-7xl font-bold mb-4 text-white" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>
                <span dangerouslySetInnerHTML={{ __html: generateRubyHTML(content.displayText) }} />
            </div>
            {content.translation && (
                <p className="text-xl md:text-2xl text-slate-200 mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>
                {content.translation}
                </p>
            )}
            {content.imageUrl && (
                <img src={content.imageUrl} alt={content.displayText || 'Lesson image'} className="max-w-xs md:max-w-md max-h-64 object-contain rounded-lg shadow-lg mt-4" />
            )}
        </div>
    );
};

// 设置面板组件
const SettingsPanel = ({ settings, setSettings, onClose }) => {
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white/90 backdrop-blur-md rounded-lg p-6 shadow-2xl text-slate-800 w-96" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-4">设置</h3>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">中文发音人</label>
                    <select name="chineseVoice" value={settings.chineseVoice} onChange={handleChange} className="w-full p-2 rounded border"><option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option><option value="zh-CN-YunyangNeural">云扬 (男)</option></select>
                </div>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">缅文发音人</label>
                    <select name="myanmarVoice" value={settings.myanmarVoice} onChange={handleChange} className="w-full p-2 rounded border"><option value="my-MM-NilarNeural">Nilar (女)</option><option value="my-MM-ThihaNeural">Thiha (男)</option></select>
                </div>
                <div className="mb-4">
                    <label className="block mb-2 font-semibold">语速: {settings.rate}</label>
                    <input type="range" name="rate" min="0.5" max="2" step="0.1" value={settings.rate} onChange={handleChange} className="w-full" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-semibold">显示字幕</span>
                    <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" name="showSubtitles" checked={settings.showSubtitles} onChange={handleChange} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div></label>
                </div>
                <button onClick={onClose} className="mt-6 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">关闭</button>
            </div>
        </div>
    );
};

// 课程结束界面组件
const CourseCompleteBlock = ({ onRestart }) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>
                🎉 恭喜！
            </h1>
            <p className="text-xl md:text-2xl mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>
                您已完成本课的所有内容。
            </p>
            <button
                onClick={onRestart}
                className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105"
            >
                重新学习
            </button>
        </div>
    );
};

// --- 3. 主播放器组件 (核心逻辑) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false); // 课程完成状态
  const [settings, setSettings] = useState({
      chineseVoice: 'zh-CN-XiaoxiaoNeural',
      myanmarVoice: 'my-MM-NilarNeural',
      rate: 1,
      showSubtitles: true
  });
  
  const audioRef = useRef(null);
  const subtitleTimerRef = useRef(null);
  const totalBlocks = lesson.blocks.length;
  const lessonId = lesson.id;

  // 从 localStorage 加载进度和设置
  useEffect(() => {
    const savedIndex = localStorage.getItem(`lesson-progress-${lessonId}`);
    if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10));
    const savedSettings = localStorage.getItem('lesson-settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, [lessonId]);

  // 保存进度和设置到 localStorage
  useEffect(() => { localStorage.setItem(`lesson-progress-${lessonId}`, currentIndex); }, [currentIndex, lessonId]);
  useEffect(() => { localStorage.setItem('lesson-settings', JSON.stringify(settings)); }, [settings]);

  // TTS 播放与停止逻辑
  const stopAudioAndSubtitles = useCallback(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
    }
    if (subtitleTimerRef.current) { cancelAnimationFrame(subtitleTimerRef.current); }
    setIsPlaying(false);
    setSubtitles([]);
  }, []);

  const playAudio = useCallback(async () => {
    console.log('[TTS] playAudio called.');
    stopAudioAndSubtitles();
    const currentBlock = lesson.blocks[currentIndex];
    let textToRead = '';
    if (currentBlock.type === 'teaching') { textToRead = currentBlock.content?.narrationText; } 
    else { textToRead = currentBlock.content?.prompt; }
    if (!textToRead) { console.warn('[TTS] No text to read found.'); return; }
    console.log(`[TTS] Text to read: "${textToRead}"`);
    const params = new URLSearchParams({
        text: textToRead.replace(/\{\{/g, `<voice name="${settings.myanmarVoice}">`).replace(/\}\}/g, '</voice>'),
        chinese_voice: settings.chineseVoice, rate: settings.rate, subtitles: 'true'
    });
    const ttsUrl = `https://libretts.is-an.org/api/tts?${params.toString()}`;
    console.log('[TTS] Requesting URL:', ttsUrl);
    try {
        const response = await fetch(ttsUrl);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        const data = await response.json();
        console.log('[TTS] API Response Data:', data);
        if (audioRef.current && data.audioUrl) {
            audioRef.current.src = data.audioUrl;
            await audioRef.current.play();
            setIsPlaying(true);
            console.log('[TTS] Audio playback started.');
        }
    } catch (error) { console.error("[TTS] API Error:", error); alert(`语音播放失败: ${error.message}`); }
  }, [currentIndex, lesson.blocks, settings, stopAudioAndSubtitles]);

  const togglePlayPause = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); } 
    else {
      if (audioRef.current && audioRef.current.src && !audioRef.current.ended) { audioRef.current.play(); setIsPlaying(true); } 
      else { playAudio(); }
    }
  };

  // 导航逻辑
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) {
        setTimeout(() => { setCurrentIndex(prev => prev + 1); }, 300);
    } else {
        console.log('Course finished!');
        setIsCompleted(true);
    }
  }, [currentIndex, totalBlocks]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);
  
  const goToPage = () => {
      const pageNum = prompt(`跳转到页面 (1-${totalBlocks}):`);
      if (pageNum && !isNaN(pageNum)) {
          const targetIndex = parseInt(pageNum, 10) - 1;
          if (targetIndex >= 0 && targetIndex < totalBlocks) { setIsCompleted(false); setCurrentIndex(targetIndex); }
          else { alert('无效的页码'); }
      }
  };
  
  const handleRestart = () => {
      setIsCompleted(false);
      setCurrentIndex(0);
  };

  const handleCorrectAndProceed = () => {
    console.log('Correct! Proceeding...');
    if (currentIndex < totalBlocks - 1) {
        setTimeout(() => { goToNext(); }, 1500);
    } else {
        setTimeout(() => { setIsCompleted(true); }, 1500);
    }
  };

  // 划屏手势
  const swipeHandlers = useSwipeable({
    onSwipedUp: () => { if (!isCompleted) goToNext(); },
    onSwipedDown: () => goToPrev(),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  // 切换页面时重置状态
  useEffect(() => { stopAudioAndSubtitles(); }, [currentIndex, stopAudioAndSubtitles]);
  
  // 强化禁止下拉刷新
  useEffect(() => {
      document.body.style.overscrollBehaviorY = 'contain';
      return () => { document.body.style.overscrollBehaviorY = 'auto'; };
  }, []);

  // 渲染逻辑
  const renderBlock = () => {
    if (isCompleted) { return <CourseCompleteBlock onRestart={handleRestart} />; }
    const currentBlock = lesson.blocks[currentIndex];
    if (!currentBlock) { return <div className="text-white bg-red-500/80 p-6 rounded-lg">错误：找不到当前课程数据。</div>; }
    const genericProps = { data: currentBlock.content, onComplete: goToNext };
    switch (currentBlock.type.toLowerCase()) {
      case 'teaching': return <TeachingBlock content={currentBlock.content} />;
      case 'choice':
        const { prompt: xuanzePrompt, choices, correctId, explanation, imageUrl, videoUrl, audioUrl } = currentBlock.content;
        return <XuanZeTi question={{ text: xuanzePrompt, imageUrl, videoUrl, audioUrl }} options={choices || []} correctAnswer={correctId ? [correctId] : []} explanation={explanation} onNext={goToNext} onCorrect={handleCorrectAndProceed} />;
      case 'paixu':
        const { prompt: paixuPrompt, items, explanation: paixuExplanation } = currentBlock.content;
        const correctOrder = (items || []).sort((a, b) => a.order - b.order).map(item => item.id);
        return <PaiXuTi title={paixuPrompt} items={items || []} correctOrder={correctOrder} aiExplanation={paixuExplanation} onCorrectionRequest={(prompt) => console.log("AI Correction Requested:", prompt)} />;
      case 'lianxian':
        const { prompt: lianxianPrompt, pairs } = currentBlock.content;
        const columnA = (pairs || []).map(p => ({ id: p.id, content: p.left, imageUrl: p.leftImageUrl }));
        const columnB = [...(pairs || [])].sort(() => 0.5 - Math.random()).map(p => ({ id: p.id, content: p.right, imageUrl: p.rightImageUrl }));
        const correctPairs = (pairs || []).reduce((acc, p) => { acc[p.id] = p.id; return acc; }, {});
        return <LianXianTi title={lianxianPrompt} columnA={columnA} columnB={columnB} pairs={correctPairs} onCorrect={handleCorrectAndProceed} />;
      case 'gaicuo':
        const { prompt: gaicuoPrompt, sentence, segmentationType, correctAnswers, corrections, explanation: gaicuoExplanation } = currentBlock.content;
        return <GaiCuoTi title={gaicuoPrompt} sentence={sentence} segmentationType={segmentationType || 'char'} correctAnswers={correctAnswers || []} corrections={corrections || []} explanation={gaicuoExplanation} onCorrect={handleCorrectAndProceed} />;
      case 'panduan': return <PanDuanTi {...genericProps} />;
      case 'fanyi': return <FanYiTi {...genericProps} />;
      case 'tinglizhuju': return <TingLiZhuJu {...genericProps} />;
      case 'cidianka': return <CiDianKa {...genericProps} />;
      case 'gengdu': return <GengDuTi {...genericProps} />;
      default: return ( <div className="text-white bg-red-500/80 p-6 rounded-lg text-center">错误：不支持的页面类型 "{currentBlock.type}"。</div> );
    }
  };

  return (
    <div {...swipeHandlers} className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center overscroll-y-contain" style={{ backgroundImage: "url(/background.jpg)" }}>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      <div className="w-full h-full flex items-center justify-center">{renderBlock()}</div>
      {settings.showSubtitles && subtitles.length > 0 && ( <div className="absolute bottom-24 md:bottom-28 w-full text-center px-4 pointer-events-none"><p className="inline-block text-2xl md:text-3xl font-semibold text-white" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.8)' }}>{subtitles.join('')}</p></div> )}
      {!isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-2 md:space-x-4">
            <button onClick={goToPrev} disabled={currentIndex === 0} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <button onClick={goToPage} className="text-sm font-mono px-2">{currentIndex + 1} / {totalBlocks}</button>
            <button onClick={goToNext} disabled={currentIndex === totalBlocks - 1} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            <button onClick={togglePlayPause} className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform active:scale-95">{isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>}</button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
            </div>
        </div>
      )}
      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
