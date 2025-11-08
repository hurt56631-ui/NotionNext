// components/HSK_Mega_Component.jsx (All-in-One Interactive Lesson Player)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import confetti from 'canvas-confetti';
import { Howl } from 'howler';

// --- 从您之前的代码中引入各种题型组件 ---
// 注意：现在我们不再直接渲染这些组件，而是将它们的“渲染逻辑”集成到主组件中。
// 这里只是为了方便我们参考它们的 props 和功能。
import XuanZeTi from './Tixing/XuanZeTi';
import PaiXuTi from './Tixing/PaiXuTi';
import LianXianTi from './Tixing/LianXianTi';
import PanDuanTi from './Tixing/PanDuanTi';
import TianKongTi from './Tixing/TianKongTi';
import GaiCuoTi from './Tixing/GaiCuoTi';
import DuiHua from './Tixing/DuiHua';
import GrammarPointPlayer from './Tixing/GrammarPointPlayer';


// --- 统一的TTS和音效模块 ---
const ttsCache = new Map();
const playTTS = async (text, voice = 'zh-CN-XiaoyouNeural') => {
  if (!text) return;
  const cacheKey = `${text}|${voice}`;
  try {
    let objectUrl = ttsCache.get(cacheKey);
    if (!objectUrl) {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API Error');
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      ttsCache.set(cacheKey, objectUrl);
    }
    new Audio(objectUrl).play();
  } catch (e) { console.error(`播放 "${text}" 失败:`, e); }
};

const sounds = {
  correct: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/correct.mp3'] }) : null,
  incorrect: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/incorrect.mp3'] }) : null,
};
const playSound = (name) => sounds[name]?.play();


// ====================================================================
//                          主播放器组件 (核心)
// ====================================================================
export default function HSK_Mega_Component({ lesson }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const router = useRouter();

    const blocks = useMemo(() => lesson?.blocks || [], [lesson]);
    const totalBlocks = blocks.length;
    const currentBlock = blocks[currentIndex];

    // --- 核心导航函数 ---
    const goToNextStep = useCallback(() => {
        playSound('correct');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setTimeout(() => {
            if (currentIndex < totalBlocks - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                // 课程结束，可以跳转或显示完成页面
                alert('恭喜你，学完了！');
                router.push('/');
            }
        }, 1200);
    }, [currentIndex, totalBlocks, router]);

    // --- 根据区块类型渲染不同UI ---
    const renderBlock = () => {
        if (!currentBlock) {
            return <div className="text-white">正在加载课程...</div>;
        }

        const { type, content } = currentBlock;

        switch (type) {
            case 'teaching':
                return (
                    <div className="text-center text-white animate-fade-in">
                        <p className="text-3xl text-slate-300 mb-2">{content.pinyin}</p>
                        <h1 className="text-7xl font-bold mb-4">{content.displayText}</h1>
                        <p className="text-3xl text-slate-200">{content.translation}</p>
                        <button onClick={goToNextStep} className="mt-12 px-8 py-4 bg-white/90 text-slate-800 font-bold text-lg rounded-full shadow-lg hover:bg-white transition-transform hover:scale-105">
                            继续
                        </button>
                    </div>
                );
            
            case 'new_word':
                // 这里可以渲染一个精美的生词卡片
                return (
                     <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full animate-fade-in">
                        <h2 className="text-5xl font-bold mb-2">{content.word}</h2>
                        <p className="text-2xl text-gray-500 mb-4">{content.pinyin}</p>
                        <p className="text-2xl text-blue-600 font-semibold mb-6">{content.translation}</p>
                        {content.imageUrl && <img src={content.imageUrl} alt={content.word} className="w-full h-48 object-cover rounded-lg mb-6"/>}
                        <div className="text-left bg-gray-100 p-4 rounded-lg">
                            <p className="font-semibold">例句:</p>
                            <p className="text-lg">{content.exampleSentence.hanzi}</p>
                            <p className="text-gray-500">{content.exampleSentence.pinyin}</p>
                            <p className="text-blue-500">{content.exampleSentence.translation}</p>
                        </div>
                        <button onClick={goToNextStep} className="mt-8 w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition">
                            我学会了
                        </button>
                    </div>
                );

            case 'grammar':
                 // 直接使用 GrammarPointPlayer 组件来显示语法
                 // 确保 GrammarPointPlayer 接受 `grammarPoints` 数组
                return <GrammarPointPlayer grammarPoints={[content]} onComplete={goToNextStep} />;

            case 'dialogue':
                // 直接使用 DuiHua 组件
                return <DuiHua data={content} onComplete={goToNextStep} />;

            case 'exercise':
                // 根据 subType 渲染不同的练习题
                return renderExercise(content);

            default:
                return <div className="text-white">未知的区块类型: {type}</div>;
        }
    };

    // --- 练习题渲染的子函数 ---
    const renderExercise = (exerciseContent) => {
        const { subType } = exerciseContent;
        
        // 我们在这里直接“模拟”了各个题型组件的渲染逻辑
        // 这样就不需要再导入和管理那么多文件了
        switch (subType) {
            case 'choice':
                return <XuanZeTi 
                          question={exerciseContent.question}
                          options={exerciseContent.options}
                          correctAnswer={exerciseContent.correctAnswer}
                          explanation={exerciseContent.explanation}
                          onCorrect={goToNextStep} 
                          onNext={goToNextStep} // 确保答对后能进入下一步
                        />;
            case 'ordering':
                return <PaiXuTi
                          title={exerciseContent.title}
                          items={exerciseContent.items}
                          correctOrder={exerciseContent.correctOrder}
                          onCorrect={goToNextStep} // 自定义onCorrect逻辑
                        />;
             case 'matching':
                return <LianXianTi
                          title={exerciseContent.title}
                          columnA={exerciseContent.columnA}
                          columnB={exerciseContent.columnB}
                          pairs={exerciseContent.pairs}
                          onCorrect={goToNextStep}
                        />;
            case 'true_false':
                return <PanDuanTi
                          question={exerciseContent.question}
                          correctAnswer={exerciseContent.correctAnswer}
                          explanation={exerciseContent.explanation}
                          onCorrect={goToNextStep}
                          onNext={goToNextStep}
                        />;
            case 'fill_in_the_blank':
                 return <TianKongTi
                           id={exerciseContent.id}
                           title={exerciseContent.title}
                           words={exerciseContent.words}
                           imageOptions={exerciseContent.imageOptions}
                           correctAnswers={exerciseContent.correctAnswers}
                           onCorrect={goToNextStep}
                           onNext={goToNextStep}
                         />;
            case 'error_correction':
                return <GaiCuoTi
                            title={exerciseContent.title}
                            sentence={exerciseContent.sentence}
                            correctAnswers={exerciseContent.correctAnswers}
                            explanation={exerciseContent.explanation}
                            onCorrect={goToNextStep}
                        />;

            default:
                return <div className="text-white bg-red-500 p-4 rounded-lg">未知的练习题类型: {subType}</div>;
        }
    };

    // --- 渲染主界面，包括进度条 ---
    const progress = totalBlocks > 0 ? ((currentIndex + 1) / totalBlocks) * 100 : 0;

    return (
        <div className="fixed inset-0 w-full h-full bg-cover bg-fixed bg-center flex flex-col items-center justify-center p-4" style={{ backgroundImage: "url(/background.jpg)" }}>
            <div className="w-full max-w-4xl absolute top-4 px-4 z-10">
                <div className="w-full bg-gray-600/50 rounded-full h-2.5">
                    <div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}></div>
                </div>
                 <div className="text-right text-white text-sm mt-1 font-mono">
                    {currentIndex + 1} / {totalBlocks}
                </div>
            </div>
            
            <div className="w-full h-full flex items-center justify-center">
                {renderBlock()}
            </div>
        </div>
    );
}
