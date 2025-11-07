// components/Tixing/LessonPlayer.jsx (最终版 v8 - 回归简单可靠模式)

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// --- 1. 动态导入所有组件 ---
const CiDianKa = dynamic(() => import('@/components/Tixing/CiDianKa'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false });
const LianXianTi = dynamic(() => import('@/components/Tixing/LianXianTi'), { ssr: false });
// 您其他的组件...

// --- 2. 统一的TTS模块 ---
const ttsCache = new Map();
const playCachedTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  const cacheKey = `${text}|${voice}`;
  if (ttsCache.has(cacheKey)) {
    // 重新播放需要 new 一个新的 Audio 对象
    const blob = await (await fetch(ttsCache.get(cacheKey))).blob();
    new Audio(URL.createObjectURL(blob)).play();
    return;
  }
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    ttsCache.set(cacheKey, objectUrl);
    new Audio(objectUrl).play();
  } catch (e) { console.error(`播放 "${text}" (${voice}) 失败:`, e); }
};

// --- 3. 辅助组件 ---
const TeachingBlock = ({ content }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
        {content.pinyin && <p className="text-2xl text-slate-300 mb-2">{content.pinyin}</p>}
        <h1 className="text-6xl font-bold mb-4">{content.displayText}</h1>
        {content.translation && <p className="text-2xl text-slate-200">{content.translation}</p>}
    </div>
);

const CourseCompleteBlock = ({ onRestart, router }) => { /* ... */ };

// --- 4. 主播放器组件 (核心逻辑) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
  
  const totalBlocks = lesson?.blocks?.length || 0;
  const currentBlock = lesson?.blocks?.[currentIndex];
  
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // 可以在这里标记课程完成
      console.log("课程结束！");
    }
  }, [currentIndex, totalBlocks]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const playAudioForCurrentBlock = useCallback(() => {
    const textToRead = currentBlock?.content?.narrationText || currentBlock?.content?.displayText;
    if (currentBlock?.type === 'teaching' && textToRead) {
      playCachedTTS(textToRead, settings.chineseVoice);
    }
  }, [currentBlock, settings.chineseVoice]);

  const renderBlock = () => {
    if (!currentBlock) return <div className="text-white">正在加载...</div>;

    const type = currentBlock.type.toLowerCase();
    // [核心修复] 标准化 props 传递
    const props = {
      data: currentBlock.content,
      onComplete: goToNext, // 所有互动组件都接收 onComplete 信号
      settings: settings,
      // 兼容某些组件可能使用 onCorrect
      onCorrect: goToNext 
    };

    switch (type) {
      case 'teaching':
        return <TeachingBlock content={props.data} />;
      
      case 'cidianka':
        return <CiDianKa {...props} />;

      case 'lianxian':
        return <LianXianTi {...props} />;
        
      case 'dialogue_cinematic':
        return <DuiHua {...props} />;
        
      case 'complete':
        return <CourseCompleteBlock onRestart={() => setCurrentIndex(0)} router={useRouter()} />;

      default:
        return <div className="text-white">错误：不支持的页面类型 "{type}"。</div>;
    }
  };

  return (
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center" style={{ backgroundImage: "url(/background.jpg)" }}>
        <div className="w-full h-full flex items-center justify-center p-4">
            {renderBlock()}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
             <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-4">
                <button onClick={goToPrev} disabled={currentIndex === 0} className="px-4 py-2">«</button>
                <span className="text-sm font-mono">{currentIndex + 1} / {totalBlocks}</span>
                <button onClick={goToNext} disabled={currentIndex >= totalBlocks - 1} className="px-4 py-2">»</button>
                <button onClick={playAudioForCurrentBlock} disabled={currentBlock?.type !== 'teaching'}>Play</button>
             </div>
        </div>
      </div>
  );
}
