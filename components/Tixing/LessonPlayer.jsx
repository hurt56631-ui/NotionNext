// components/Tixing/LessonPlayer.jsx (最终版 v11 - 包含所有修复和安全检查)

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// --- 1. 动态导入所有“学习站”组件，并添加加载提示 ---
const GrammarPointPlayer = dynamic(
    () => import('@/components/Tixing/GrammarPointPlayer'), 
    { loading: () => <p className="text-white text-xl font-bold">正在加载语法组件...</p> }
);
const QuizPlayer = dynamic(
    () => import('@/components/Tixing/QuizPlayer'),
    { loading: () => <p className="text-white text-xl font-bold">正在加载练习组件...</p> }
);
// ... 您其他的学习站组件，比如 WordCard, DuiHua 等，也可以用同样的方式添加 loading 状态

// --- 2. 辅助组件 ---
const TeachingBlock = ({ content }) => {
    if (!content) return null; // 安全检查
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            {content.pinyin && <p className="text-2xl text-slate-300 mb-2">{content.pinyin}</p>}
            <h1 className="text-6xl font-bold mb-4">{content.displayText}</h1>
            {content.translation && <p className="text-2xl text-slate-200">{content.translation}</p>}
        </div>
    );
};

const CourseCompleteBlock = ({ onRestart, router }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (router) router.push('/');
        }, 5000);
        return () => clearTimeout(timer);
    }, [router]);
    
    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full h-full text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}>🎉 ဂုဏ်ယူပါတယ်။</h1>
            <p className="text-xl md:text-2xl mb-8" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>သင်ခန်းစာပြီးဆုံးပါပြီ။ ပင်မစာမျက်နှာသို့ ပြန်သွားနေသည်...</p>
        </div>
    );
};

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
    if (!currentBlock) return <div className="text-white font-bold text-xl">错误：当前页面数据无效。</div>;
    
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
        // [核心修复] 增加严格的数据安全检查
        if (!props.data || !props.data.grammarPoints || props.data.grammarPoints.length === 0) {
            console.warn("语法站没有数据，自动跳过。");
            // 使用 useEffect 避免在渲染期间更新状态
            useEffect(() => { goToNext(); }, [goToNext]);
            return <div className="text-white text-xl font-bold">沒有语法数据，正在进入下一站...</div>;
        }
        return <GrammarPointPlayer {...props} />;

      case 'practice_session':
        // [核心修复] 增加严格的数据安全检查
        if (!props.data || !props.data.questions || props.data.questions.length === 0) {
            console.warn("练习站没有数据，自动跳过。");
            useEffect(() => { goToNext(); }, [goToNext]);
            return <div className="text-white text-xl font-bold">沒有练习数据，正在进入下一站...</div>;
        }
        return <QuizPlayer {...props} />;
        
      case 'complete':
        return <CourseCompleteBlock onRestart={() => setIsCompleted(false)} router={router} />;

      default:
        return <div className="text-white text-xl font-bold">错误：不支持的学习站类型 "{type}"。</div>;
    }
  };

  return (
      <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center" style={{ backgroundImage: "url(/background.jpg)" }}>
        {renderBlock()}
      </div>
  );
}
