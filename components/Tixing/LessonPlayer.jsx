// components/Tixing/LessonPlayer.jsx (最终版 v4 - 集成 WordCard)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSwipeable } from 'react-swipeable';
import { useRouter } from 'next/router';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';

// --- 1. 动态导入所有组件，包括 WordCard ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false });
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });
// ... 您其他的题型组件 ...

// --- 2. 统一的音效与TTS模块 ---
let sounds = {
  correct: new Howl({ src: ['/sounds/correct.mp3'] })
};
let ttsCache = new Map();

const preloadTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  const cacheKey = `${text}|${voice}`;
  if (ttsCache.has(cacheKey) || !text) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(cacheKey, audio);
  } catch (e) {
    console.error(`预加载 "${text}" (${voice}) 失败:`, e);
  }
};

const playCachedTTS = (text, voice = 'zh-CN-XiaoyouNeural') => {
  const cacheKey = `${text}|${voice}`;
  if (ttsCache.has(cacheKey)) {
    ttsCache.get(cacheKey).play();
  } else {
    preloadTTS(text, voice).then(() => {
      if (ttsCache.has(cacheKey)) {
        ttsCache.get(cacheKey).play();
      }
    });
  }
};

// --- 3. 辅助组件 ---
const TeachingBlock = ({ content }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
        {content.pinyin && <p className="text-2xl md:text-3xl text-slate-300 mb-2 tracking-wider" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>{content.pinyin}</p>}
        <h1 className="text-6xl md:text-8xl font-bold mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>{content.displayText}</h1>
        {content.translation && <p className="text-2xl md:text-3xl text-slate-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>{content.translation}</p>}
    </div>
);

const SettingsPanel = ({ settings, setSettings, onClose }) => { /* ... 保持不变 ... */ };
const CourseCompleteBlock = ({ onRestart, router }) => { /* ... 保持不变 ... */ };

// --- 4. 主播放器组件 (核心逻辑) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [settings, setSettings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' });
  
  // [新增] WordCard 控制状态
  const [isWordCardVisible, setIsWordCardVisible] = useState(false);
  const [wordCardData, setWordCardData] = useState([]);

  const router = useRouter();
  const totalBlocks = lesson?.blocks?.length || 0;
  const lessonId = lesson?.id;
  
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) { setCurrentIndex((prev) => prev + 1); } 
    else { setIsCompleted(true); }
  }, [currentIndex, totalBlocks]);

  // [修改] 核心触发逻辑
  useEffect(() => {
    const currentBlock = lesson?.blocks?.[currentIndex];
    if (currentBlock?.type === 'word_study') {
      setWordCardData(currentBlock.content.words || []);
      setIsWordCardVisible(true);
    }
  }, [currentIndex, lesson]);

  useEffect(() => {
    const savedIndex = localStorage.getItem(`lesson-progress-${lessonId}`);
    if (savedIndex) {
        const index = parseInt(savedIndex, 10);
        if (index < totalBlocks) { setCurrentIndex(index); }
    }
    const firstBlock = lesson?.blocks?.[0];
    if (firstBlock?.type === 'teaching' && firstBlock?.content?.narrationText) {
        preloadTTS(firstBlock.content.narrationText, settings.chineseVoice);
    }
  }, [lesson, lessonId, totalBlocks, settings.chineseVoice]);
  
  const playAudioForCurrentBlock = useCallback(() => {
    const currentBlock = lesson?.blocks?.[currentIndex];
    if (currentBlock?.type === 'teaching') {
        const textToRead = currentBlock.content?.narrationText || currentBlock.content?.displayText;
        if (textToRead) { playCachedTTS(textToRead, settings.chineseVoice); }
    }
  }, [currentIndex, lesson, settings.chineseVoice]);

  const handleCorrectAndProceed = useCallback(() => {
    sounds.correct?.play();
    confetti();
    setTimeout(() => { goToNext(); }, 1200);
  }, [goToNext]);
  
  const handleCloseWordCard = () => {
      setIsWordCardVisible(false);
      goToNext(); // 关闭后自动进入下一页
  };

  const renderBlock = () => {
    if (isCompleted) return <CourseCompleteBlock onRestart={() => { setIsCompleted(false); setCurrentIndex(0); }} router={router} />;
    const currentBlock = lesson?.blocks?.[currentIndex];
    if (!currentBlock) return <div>错误：页面数据无效。</div>;
    
    const type = currentBlock.type.toLowerCase();
    const baseProps = { data: currentBlock.content, onComplete: handleCorrectAndProceed, settings };
    
    switch (type) {
      case 'teaching': return <TeachingBlock content={currentBlock.content} />;
      case 'word_study': return <div className="text-white text-2xl font-bold p-8 text-center">正在进入单词学习模式...</div>;
      case 'dialogue_cinematic': return <DuiHua {...baseProps} />;
      case 'grammar': return <GrammarPointPlayer {...baseProps} />;
      // ... 您其他的题型组件 case ...
      default: return <div>错误：不支持的页面类型 "{type}"。</div>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center overscroll-y-contain" style={{ backgroundImage: "url(/background.jpg)" }}>
        <div className="w-full h-full flex items-center justify-center p-4">{renderBlock()}</div>
        {!isCompleted && !isWordCardVisible && (
          <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
            {/* ... 您的底部控制栏代码保持不变，只是用 !isWordCardVisible 控制显示 ... */}
            <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-2">
                 <button onClick={() => setCurrentIndex(p => Math.max(0, p-1))} disabled={currentIndex === 0}>Prev</button>
                 <span>{currentIndex + 1} / {totalBlocks}</span>
                 <button onClick={goToNext}>Next</button>
                 <button onClick={playAudioForCurrentBlock} disabled={lesson?.blocks?.[currentIndex]?.type !== 'teaching'}>Play</button>
                 <button onClick={() => setShowSettings(true)}>Settings</button>
            </div>
          </div>
        )}
      </div>
      
      <WordCard
        isOpen={isWordCardVisible}
        words={wordCardData}
        onClose={handleCloseWordCard}
        progressKey={`${lessonId}-words`}
      />
    </>
  );
}
