import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { FaChevronLeft, FaTimes } from "react-icons/fa";
import confetti from 'canvas-confetti'; // 确保安装了: npm install canvas-confetti

// --- 外部题型组件 (假设你已经有了这些组件) ---
// 如果没有，暂时可以用简单的占位符组件测试，或者注释掉
import XuanZeTi from './XuanZeTi';
import PanDuanTi from './PanDuanTi';
import PaiXuTi from './PaiXuTi';
import LianXianTi from './LianXianTi';
import GaiCuoTi from './GaiCuoTi';
import DuiHua from './DuiHua';
import TianKongTi from './TianKongTi';
import GrammarPointPlayer from './GrammarPointPlayer'; // 我们刚才做的那个

// --- 学习卡片 ---
import WordCard from '../WordCard';
import PhraseCard from '../PhraseCard';

// --- Audio Manager (保持不变，省略以节省篇幅) ---
const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-NilarNeural' };
const audioManager = (() => {
  if (typeof window === 'undefined') return null;
  let audioEl = null;
  const stop = () => { if(audioEl) { audioEl.pause(); audioEl = null; } };
  const playTTS = async (t) => {
      // 简易模拟，实际请用你的完整代码
      console.log("Playing:", t);
  };
  return { stop, playTTS, playDing: () => console.log("Ding!") };
})();

// --- 简单的列表渲染器 (适配你的代码) ---
const CardListRenderer = ({ data, type, onNext }) => {
  const list = data.words || data.sentences || []; 
  return (
    <div className="w-full h-full flex flex-col bg-slate-50 relative">
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-2xl font-black text-slate-800 text-center mb-4">{data.title}</h2>
        <div className="grid grid-cols-1 gap-4">
            {list.map((item, i) => (
                <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-slate-100" onClick={() => audioManager.playTTS(item.chinese)}>
                    <div className="font-bold text-lg">{item.chinese}</div>
                    <div className="text-slate-500">{item.pinyin}</div>
                </div>
            ))}
        </div>
      </div>
      {/* 子组件自己控制导航 */}
      <div className="p-4 bg-white border-t border-slate-100">
        <button onClick={onNext} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform">
          我学会了 (Next)
        </button>
      </div>
    </div>
  );
};

// --- 完成页面 ---
const CompletionBlock = ({ onExit }) => { 
  useEffect(() => { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }, []);
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white">
      <div className="text-8xl mb-6 animate-bounce">🎉</div>
      <h2 className="text-3xl font-black text-slate-800 mb-8">课程完成！</h2>
      <button onClick={onExit} className="px-8 py-3 bg-green-500 text-white font-bold rounded-full shadow-lg">
        返回列表
      </button>
    </div>
  ); 
};

// --- 未知类型处理 ---
const UnknownBlockHandler = ({ type, onNext }) => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p>开发中: {type}</p>
        <button onClick={onNext} className="mt-4 text-blue-500 underline">跳过</button>
    </div>
);


// ---------------- 主组件 ----------------
export default function InteractiveLesson({ lesson }) {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 确保数据存在
  const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentIndex];

  useEffect(() => { setHasMounted(true); }, []);

  // 进度保存逻辑 (保持你原有的逻辑)
  useEffect(() => { 
    if (lesson?.id && hasMounted) { 
        const isFinished = currentIndex >= totalBlocks;
        if (isFinished) {
            localStorage.removeItem(`lesson-progress-${lesson.id}`);
        } else {
            localStorage.setItem(`lesson-progress-${lesson.id}`, currentIndex.toString());
        }
    }
  }, [currentIndex, lesson?.id, hasMounted, totalBlocks]);

  // 导航函数
  const goNext = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex < totalBlocks) setCurrentIndex(prev => prev + 1); 
  }, [currentIndex, totalBlocks]);

  const goPrev = useCallback(() => { 
    audioManager?.stop(); 
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1); 
  }, [currentIndex]);
  
  // 答对时的特效 + 自动跳转 (用于选择题等)
  const handleCorrect = useCallback(() => {
    audioManager.playDing();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#2563eb', '#22c55e'] });
    setTimeout(() => goNext(), 1000); 
  }, [goNext]);

  // 退出
  const handleExit = () => router.back();

  // 渲染当前区块
  const renderBlock = () => {
    if (!currentBlock) return null;
    
    // 准备通用 Props，传给所有子组件
    const commonProps = { 
      key: `${lesson.id}-${currentIndex}`, 
      data: currentBlock.content, 
      onCorrect: handleCorrect,  // 答对自动跳
      onComplete: goNext,        // 完成当前项（用于学习卡片、语法讲解）
      onNext: goNext,            // 手动下一步
      onPrev: goPrev,            // 手动上一步
      isFirst: currentIndex === 0,
      isLast: currentIndex === totalBlocks - 1,
      settings: { playTTS: audioManager?.playTTS } 
    };

    // 全屏容器 (无 Padding)
    const FullScreen = ({ children }) => <div className="w-full h-full">{children}</div>;
    // 居中容器 (有 Padding，适合题目)
    const QuestionWrapper = ({ children }) => <div className="w-full h-full flex flex-col justify-center p-4 bg-slate-50">{children}</div>;

    const type = (currentBlock.type || '').toLowerCase();

    switch (type) {
      case 'word_study': 
      case 'phrase_study': 
        return <FullScreen><CardListRenderer {...commonProps} type={type} /></FullScreen>;

      case 'grammar_study': 
        // 语法组件通常自带复杂的全屏UI，直接渲染
        return <FullScreen><GrammarPointPlayer grammarPoints={commonProps.data.grammarPoints} onComplete={goNext} /></FullScreen>;

      // 以下为互动题，通常需要居中显示
      case 'choice': 
         // 注意：你需要确保 XuanZeTi 组件内部调用了 onCorrect 或 onNext
         return <QuestionWrapper><XuanZeTi {...commonProps} /></QuestionWrapper>;
      
      case 'panduan': return <QuestionWrapper><PanDuanTi {...commonProps} /></QuestionWrapper>;
      case 'lianxian': return <QuestionWrapper><LianXianTi {...commonProps} /></QuestionWrapper>;
      case 'paixu': return <QuestionWrapper><PaiXuTi {...commonProps} /></QuestionWrapper>;
      case 'gaicuo': return <QuestionWrapper><GaiCuoTi {...commonProps} /></QuestionWrapper>;
      
      default: return <UnknownBlockHandler type={type} onNext={goNext} />;
    }
  };

  if (!hasMounted) return null;

  // 如果完成了所有block
  if (currentIndex >= totalBlocks) {
      return <CompletionBlock onExit={handleExit} />;
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden font-sans">
      {/* 顶部进度条 - 始终显示，给用户进度感 */}
      <div className="absolute top-0 left-0 right-0 z-50 px-4 py-3 pointer-events-none">
          <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden backdrop-blur-sm shadow-sm">
            <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${((currentIndex) / totalBlocks) * 100}%` }} 
            />
          </div>
      </div>

      {/* 顶部退出按钮 (可选，防止用户卡死) */}
      <button 
        onClick={handleExit}
        className="absolute top-4 left-4 z-50 w-8 h-8 flex items-center justify-center bg-black/10 rounded-full text-slate-600 active:bg-black/20"
      >
        <FaTimes size={14} />
      </button>

      {/* 主内容区 */}
      <main className="w-full h-full">
        {renderBlock()}
      </main>
    </div>
  );
}
