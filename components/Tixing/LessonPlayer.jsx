// components/Tixing/LessonPlayer.jsx (最终版 v10 - 语法+练习模式)

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// --- 1. 动态导入所有“学习站”组件 ---
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });
const QuizPlayer = dynamic(() => import('@/components/Tixing/QuizPlayer'), { ssr: false });

// --- 2. 辅助组件 ---
const TeachingBlock = ({ content }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
        {content.pinyin && <p className="text-2xl text-slate-300 mb-2">{content.pinyin}</p>}
        <h1 className="text-6xl font-bold mb-4">{content.displayText}</h1>
        {content.translation && <p className="text-2xl text-slate-200">{content.translation}</p>}
    </div>
);
const CourseCompleteBlock = ({ onRestart, router }) => { /* ... */ };


// --- 3. 主播放器组件 (核心逻辑 - “导游”模式) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [settings] = useState({ chineseVoice: 'zh-CN-XiaoyouNeural' }); // 全局设置
  
  const router = useRouter();
  const totalBlocks = lesson?.blocks?.length || 0;
  
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) { 
        setCurrentIndex(prev => prev + 1); 
    } else { 
        setIsCompleted(true); 
    }
  }, [currentIndex, totalBlocks]);

  const renderBlock = () => {
    if (isCompleted) return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;
    
    const currentBlock = lesson?.blocks?.[currentIndex];
    if (!currentBlock) return <div className="text-white">错误：页面数据无效。</div>;
    
    const type = currentBlock.type.toLowerCase();
    const props = { data: currentBlock.content, onComplete: goToNext, settings };
    
    switch (type) {
      case 'teaching':
        return (
            <div>
                <TeachingBlock content={currentBlock.content} />
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                    <button onClick={goToNext} className="px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                        စတင်လေ့လာမည် (Start Learning)
                    </button>
                </div>
            </div>
        );
        
      case 'grammar_study':
        return <GrammarPointPlayer {...props} />;

      case 'practice_session':
        return <QuizPlayer {...props} />;
        
      case 'complete':
        return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;

      default:
        return <div className="text-white">错误：不支持的学习站类型 "{type}"。</div>;
    }
  };

  return (
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center" style={{ backgroundImage: "url(/background.jpg)" }}>
        {renderBlock()}
      </div>
  );
}
