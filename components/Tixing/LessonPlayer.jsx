// components/Tixing/LessonPlayer.jsx (最终修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSwipeable } from 'react-swipeable';
import { useRouter } from 'next/router';

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
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false });


// --- 2. 辅助组件与函数 (TeachingBlock 已重写) ---
// [修改] 重写 TeachingBlock 以匹配您的样式需求
const TeachingBlock = ({ content }) => {
    // 检查 pinyin 是否存在，如果不存在则使用 displayText
    const pinyinText = content.pinyin || '';
    const displayText = content.displayText || '';
    const translationText = content.translation || '';

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            {pinyinText && (
                <p className="text-2xl md:text-3xl text-slate-300 mb-2 tracking-wider" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>
                    {pinyinText}
                </p>
            )}
            <h1 className="text-6xl md:text-8xl font-bold mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
                {displayText}
            </h1>
            {translationText && (
                <p className="text-2xl md:text-3xl text-slate-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>
                    {translationText}
                </p>
            )}
            {content.imageUrl && (
                <img src={content.imageUrl} alt={displayText} className="max-w-xs md:max-w-md max-h-64 object-contain rounded-lg shadow-lg mt-8" />
            )}
        </div>
    );
};

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
                <button onClick={onClose} className="mt-6 w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors">关闭</button>
            </div>
        </div>
    );
};

const CourseCompleteBlock = ({ onRestart, router }) => {
    useEffect(() => {
        const timer = setTimeout(() => { router.push('/'); }, 5000);
        return () => clearTimeout(timer);
    }, [router]);
    
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>🎉 恭喜！</h1>
            <p className="text-xl md:text-2xl mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>您已完成本课，即将返回首页...</p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onRestart} className="px-8 py-4 bg-white/80 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">重新学习</button>
                <button onClick={() => router.push('/')} className="px-8 py-4 bg-blue-500/80 text-white font-bold text-lg rounded-full shadow-lg hover:bg-blue-500 transition-transform hover:scale-105">立即返回</button>
            </div>
        </div>
    );
};


// --- 3. 主播放器组件 (核心逻辑) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [settings, setSettings] = useState({
      chineseVoice: 'zh-CN-XiaoxiaoNeural', myanmarVoice: 'my-MM-NilarNeural', rate: 1,
  });
  
  const router = useRouter();
  const audioRef = useRef(null);
  const totalBlocks = lesson?.blocks?.length || 0;
  const lessonId = lesson?.id;
  const currentBlock = lesson?.blocks?.[currentIndex];

  useEffect(() => {
    const savedIndex = localStorage.getItem(`lesson-progress-${lessonId}`);
    if (savedIndex) {
        const index = parseInt(savedIndex, 10);
        if (index < totalBlocks) { setCurrentIndex(index); }
    }
    const savedSettings = localStorage.getItem('lesson-settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, [lessonId, totalBlocks]);

  useEffect(() => { 
      if (!isCompleted) { localStorage.setItem(`lesson-progress-${lessonId}`, currentIndex); }
  }, [currentIndex, lessonId, isCompleted]);
  
  useEffect(() => { localStorage.setItem('lesson-settings', JSON.stringify(settings)); }, [settings]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    setIsPlaying(false);
  }, []);

  // [修改] 优化 playAudio 逻辑，只为特定类型的 block 播放音频
  const playAudio = useCallback(async () => {
    stopAudio();
    if (isCompleted || !currentBlock) return;

    const blockType = currentBlock.type;
    const content = currentBlock.content;
    let textToRead = '';

    // 定义哪些 block 类型可以使用主播放器按钮
    const mainPlayerBlocks = ['teaching', 'choice', 'panduan'];

    if (mainPlayerBlocks.includes(blockType)) {
        textToRead = content?.narrationText || content?.prompt || content?.displayText;
    }

    if (!textToRead) {
        console.warn(`[TTS] 主播放器不支持或在此 block (${blockType}) 上找不到可读文本。`);
        return;
    }

    const params = new URLSearchParams({ text: textToRead, chinese_voice: settings.chineseVoice, rate: settings.rate });
    const ttsUrl = `https://libretts.is-an.org/api/tts?${params.toString()}`;
    try {
        const response = await fetch(ttsUrl);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        const data = await response.json();
        if (audioRef.current && data.audioUrl) {
            audioRef.current.src = data.audioUrl;
            await audioRef.current.play();
            setIsPlaying(true);
        }
    } catch (error) { console.error("[TTS] API Error:", error); alert(`语音播放失败: ${error.message}`); }
  }, [currentBlock, settings, stopAudio, isCompleted]);

  const togglePlayPause = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); } 
    else {
      if (audioRef.current && audioRef.current.src && !audioRef.current.ended) { audioRef.current.play(); setIsPlaying(true); } 
      else { playAudio(); }
    }
  };

  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) { setCurrentIndex((prev) => prev + 1); } 
    else { stopAudio(); setIsCompleted(true); }
  }, [currentIndex, totalBlocks, stopAudio]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) { setIsCompleted(false); setCurrentIndex(prev => prev - 1); }
  }, [currentIndex]);
  
  const goToPage = () => {
      const pageNum = prompt(`跳转到页面 (1-${totalBlocks}):`);
      if (pageNum && !isNaN(pageNum)) {
          const targetIndex = parseInt(pageNum, 10) - 1;
          if (targetIndex >= 0 && targetIndex < totalBlocks) { setIsCompleted(false); setCurrentIndex(targetIndex); }
          else { alert('无效的页码'); }
      }
  };
  
  const handleRestart = () => { stopAudio(); setIsCompleted(false); setCurrentIndex(0); };

  const handleCorrectAndProceed = useCallback(() => {
    setTimeout(() => { goToNext(); }, 600);
  }, [goToNext]);

  const swipeHandlers = useSwipeable({
    onSwipedUp: () => { if (!isCompleted) goToNext(); },
    onSwipedDown: () => goToPrev(),
    preventDefaultTouchmoveEvent: true, trackMouse: true
  });

  useEffect(() => { stopAudio(); }, [currentIndex, stopAudio]);
  
  useEffect(() => {
      document.body.style.overscrollBehaviorY = 'contain';
      return () => { document.body.style.overscrollBehaviorY = 'auto'; };
  }, []);

  const renderBlock = () => {
    if (!lesson || !Array.isArray(lesson.blocks) || lesson.blocks.length === 0) {
      return <div className="p-8 text-center text-white bg-red-500/70 rounded-xl">无法加载课程数据。</div>;
    }
    if (isCompleted) { return <CourseCompleteBlock onRestart={handleRestart} router={router} />; }
    if (!currentBlock) { return <div className="p-8 text-center text-white bg-red-500/70 rounded-xl">错误：当前页面数据无效。</div>; }
    
    const type = currentBlock.type.toLowerCase();
    const baseProps = { data: currentBlock.content, onComplete: handleCorrectAndProceed, settings: settings };
    
    // 渲染组件
    switch (type) {
      case 'teaching': return <TeachingBlock content={currentBlock.content} />;
      case 'grammar': return <GrammarPointPlayer {...baseProps} />;
      case 'dialogue_cinematic': return <DuiHua {...baseProps} />;
      case 'choice': return <XuanZeTi data={baseProps.data} onCorrect={handleCorrectAndProceed} />;
      case 'paixu': return <PaiXuTi {...baseProps} />;
      case 'lianxian': return <LianXianTi {...baseProps} />;
      case 'gaicuo': return <GaiCuoTi {...baseProps} />;
      case 'panduan': return <PanDuanTi {...baseProps} />;
      case 'fanyi': return <FanYiTi {...baseProps} />;
      case 'tinglizhuju': return <TingLiZhuJu {...baseProps} />;
      case 'cidianka': return <CiDianKa {...baseProps} />;
      case 'gengdu': return <GengDuTi {...baseProps} />;
      default: return ( <div className="text-white bg-red-500/80 p-6 rounded-lg text-center">错误：不支持的页面类型 "{type}"。</div> );
    }
  };

  // [新增] 决定主播放按钮是否应该被禁用
  const isPlayerDisabled = !['teaching', 'choice', 'panduan'].includes(currentBlock?.type);

  return (
    <div {...swipeHandlers} className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center overscroll-y-contain" style={{ backgroundImage: "url(/background.jpg)" }}>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
      <div className="w-full h-full flex items-center justify-center">{renderBlock()}</div>
      
      {!isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-2 md:space-x-4">
            <button onClick={goToPrev} disabled={currentIndex === 0} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <button onClick={goToPage} className="text-sm font-mono px-2">{currentIndex + 1} / {totalBlocks}</button>
            <button onClick={goToNext} disabled={currentIndex >= totalBlocks - 1} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            <button onClick={togglePlayPause} disabled={isPlayerDisabled} className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed">{isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>}</button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
            </div>
        </div>
      )}
      {showSettings && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
