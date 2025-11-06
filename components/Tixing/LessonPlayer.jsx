// components/Tixing/LessonPlayer.jsx (学习站模式最终版)

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// --- 1. 动态导入所有“学习站”组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const DuiHua = dynamic(() => import('@/components/Tixing/DuiHua'), { ssr: false }); // 假设它可以处理 scenes 数组
const GrammarPointPlayer = dynamic(() => import('@/components/Tixing/GrammarPointPlayer'), { ssr: false });
const QuizPlayer = dynamic(() => import('@/components/Tixing/QuizPlayer'), { ssr: false });

const TeachingBlock = ({ content }) => { /* ... 保持不变 ... */ };
const CourseCompleteBlock = ({ onRestart, router }) => { /* ... 保持不变 ... */ };

export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const router = useRouter();
  const totalBlocks = lesson?.blocks?.length || 0;
  const lessonId = lesson?.id;
  
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) { setCurrentIndex((prev) => prev + 1); } 
    else { setIsCompleted(true); }
  }, [currentIndex, totalBlocks]);

  const renderBlock = () => {
    if (isCompleted) return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;
    
    const currentBlock = lesson?.blocks?.[currentIndex];
    if (!currentBlock) return <div>错误：页面数据无效。</div>;
    
    const type = currentBlock.type.toLowerCase();
    const baseProps = { data: currentBlock.content, onComplete: goToNext };
    
    switch (type) {
      case 'teaching':
        return <TeachingBlock content={currentBlock.content} />;
        
      case 'word_study':
        // WordCard 是一个全屏组件，我们需要用一个状态来控制它
        return <WordCardWrapper data={baseProps.data.words} lessonId={lessonId} onComplete={goToNext} />;

      case 'grammar_study':
        return <GrammarPointPlayer data={baseProps.data} onComplete={goToNext} />;
        
      case 'practice_session':
        return <QuizPlayer data={baseProps.data} onComplete={goToNext} />;
        
      case 'dialogue_study':
        // 假设您的 DuiHua 组件可以处理一个 scenes 数组
        return <DuiHua data={baseProps.data} onComplete={goToNext} />;
        
      case 'complete':
        return <CourseCompleteBlock onRestart={() => { setIsCompleted(false); setCurrentIndex(0); }} router={router} />;

      default:
        return <div>错误：不支持的学习站类型 "{type}"。</div>;
    }
  };

  return (
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center" style={{ backgroundImage: "url(/background.jpg)" }}>
        {renderBlock()}
        {!isCompleted && (
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
                 <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-4">
                    <button onClick={() => setCurrentIndex(p => Math.max(0, p - 1))} disabled={currentIndex === 0}>上一站</button>
                    <span>第 {currentIndex + 1} 站 / 共 {totalBlocks} 站</span>
                    <button onClick={goToNext}>下一站</button>
                 </div>
            </div>
        )}
      </div>
  );
}

// 一个包裹 WordCard 的小组件，用于控制其显示和关闭
function WordCardWrapper({ data, lessonId, onComplete }) {
    const [isOpen, setIsOpen] = useState(true);

    const handleClose = () => {
        setIsOpen(false);
        onComplete();
    };

    return <WordCard isOpen={isOpen} words={data} onClose={handleClose} progressKey={`${lessonId}-words`} />;
}
