// components/Tixing/LessonPlayer.jsx (最终版 v6 - 数据适配与跳转)

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// --- 1. 动态导入所有“学习站”组件 ---
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false });
const QuizPlayer = dynamic(() => import('@/components/Tixing/QuizPlayer'), { ssr: false });
// 您其他的学习站组件...

// --- 2. 辅助组件 ---
const TeachingBlock = ({ content }) => {
    if (!content) return null; // 增加安全检查
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            {content.pinyin && <p className="text-2xl md:text-3xl text-slate-300 mb-2 tracking-wider" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>{content.pinyin}</p>}
            <h1 className="text-6xl md:text-8xl font-bold mb-4" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>{content.displayText}</h1>
            {content.translation && <p className="text-2xl md:text-3xl text-slate-200" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>{content.translation}</p>}
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
            <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>🎉 ဂုဏ်ယူပါတယ်။</h1>
            <p className="text-xl md:text-2xl mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>သင်ခန်းစာပြီးဆုံးပါပြီ။ ပင်မစာမျက်နှာသို့ ပြန်သွားနေသည်...</p>
        </div>
    );
};

// WordCard 的包裹器，负责数据格式转换和状态控制
function WordCardWrapper({ data, lessonId, onComplete }) {
    const [isOpen, setIsOpen] = useState(true);

    // [核心修复] 将课程JSON的单词格式转换为 WordCard 需要的格式
    const formattedWords = data.map(word => ({
        hanzi: word.chinese,       // 映射 chinese -> hanzi
        pinyin: word.pinyin || '',   // 提供 pinyin
        translation: word.burmese, // 映射 burmese -> translation
        // 其他 WordCard 可能需要的字段可以在这里映射
    }));

    const handleClose = () => {
        setIsOpen(false);
        // 延迟执行 onComplete 以确保 WordCard 的关闭动画完成
        setTimeout(onComplete, 300); 
    };

    return <WordCard isOpen={isOpen} words={formattedWords} onClose={handleClose} progressKey={`${lessonId}-words`} />;
}

// --- 3. 主播放器组件 (核心逻辑) ---
export default function LessonPlayer({ lesson }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const router = useRouter();
  const totalBlocks = lesson?.blocks?.length || 0;
  const lessonId = lesson?.id;
  const currentBlock = lesson?.blocks?.[currentIndex];
  
  const goToNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) { 
        setCurrentIndex(prev => prev + 1); 
    } else { 
        setIsCompleted(true); 
    }
  }, [currentIndex, totalBlocks]);

  const goToPrev = useCallback(() => {
      setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const jumpToStation = () => {
      const pageNum = prompt(`ခုန်သွားလိုသော စာမျက်နှာ (1-${totalBlocks}):`);
      if (pageNum && !isNaN(pageNum)) {
          const targetIndex = parseInt(pageNum, 10) - 1;
          if (targetIndex >= 0 && targetIndex < totalBlocks) { 
              setIsCompleted(false); 
              setCurrentIndex(targetIndex); 
          } else { 
              alert('စာမျက်နှာ နံပါတ် မှားယွင်းနေပါသည်။'); 
          }
      }
  };
  
  const renderBlock = () => {
    if (isCompleted) return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;
    if (!currentBlock) return <div className="p-8 text-center text-white bg-red-500/70 rounded-xl">Error: Invalid block data.</div>;
    
    const type = currentBlock.type.toLowerCase();
    
    switch (type) {
      case 'teaching':
        return <TeachingBlock content={currentBlock.content} />;
        
      case 'word_study':
        return <WordCardWrapper data={currentBlock.content.words || []} lessonId={lessonId} onComplete={goToNext} />;

      case 'practice_session':
        return <QuizPlayer data={currentBlock.content} onComplete={goToNext} />;

      case 'complete':
        // 在 render 阶段调用 setIsCompleted 是不安全的，移到 goToNext
        return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;
        
      default:
        return <div className="p-8 text-center text-white">Error: Unsupported station type "{type}".</div>;
    }
  };

  const isWordCardActive = currentBlock?.type === 'word_study';

  return (
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center" style={{ backgroundImage: "url(/background.jpg)" }}>
        
        {/* 只有当 WordCard 不活动时才渲染主界面内容 */}
        {!isWordCardActive && renderBlock()}
        
        {/* 控制栏只在课程未完成且 WordCard 不活动时显示 */}
        {!isCompleted && !isWordCardActive && (
            <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center">
                 <div className="bg-white/80 backdrop-blur-sm rounded-full shadow-lg p-2 flex items-center space-x-4">
                    <button onClick={goToPrev} disabled={currentIndex === 0} className="px-4 py-2 rounded-full hover:bg-gray-200 disabled:opacity-50">«</button>
                    <button onClick={jumpToStation} className="text-sm font-mono px-2 select-none">站 {currentIndex + 1} / {totalBlocks}</button>
                    <button onClick={goToNext} disabled={currentIndex >= totalBlocks - 1} className="px-4 py-2 rounded-full hover:bg-gray-200 disabled:opacity-50">»</button>
                 </div>
            </div>
        )}
      </div>
  );
}
