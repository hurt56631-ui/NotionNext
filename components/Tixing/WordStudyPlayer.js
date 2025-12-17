import React, { useState, useEffect } from 'react';
import { FaVolumeUp, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { pinyin } from 'pinyin-pro'; // 确保安装了 npm install pinyin-pro

// 简单的发音播放函数 (复用你之前的逻辑)
const playAudio = (text) => {
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  new Audio(url).play().catch(() => {});
};

export default function WordStudyPlayer({ data, onNext, onPrev, isFirstBlock }) {
  const words = data.words || [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false); // 如果你想做翻转卡片效果，预留状态

  const currentWord = words[index];
  const total = words.length;

  // 自动播放当前单词发音 (可选)
  useEffect(() => {
    if (currentWord) {
      // 延迟一点播放，避免切换太快
      const timer = setTimeout(() => playAudio(currentWord.word), 300);
      return () => clearTimeout(timer);
    }
  }, [index, currentWord]);

  const handleNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      onNext(); // 最后一个单词了，去下一个Block
    }
  };

  const handlePrev = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else {
      onPrev(); // 第一个单词了，去上一个Block
    }
  };

  if (!currentWord) return <div>No words data</div>;

  // 自动生成拼音 (如果数据里没提供)
  const displayPinyin = currentWord.pinyin || pinyin(currentWord.word);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 relative overflow-hidden">
      
      {/* 1. 顶部进度条 */}
      <div className="px-6 py-4 flex items-center justify-between z-10">
        <div className="text-slate-400 text-sm font-bold">
          {index + 1} / {total}
        </div>
        <div className="flex-1 mx-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 2. 卡片主体 (居中) */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 overflow-y-auto">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
          
          {/* 大字展示区 */}
          <div className="bg-blue-50 p-8 flex flex-col items-center justify-center border-b border-blue-100 relative">
            <button 
              onClick={() => playAudio(currentWord.word)}
              className="absolute top-4 right-4 text-blue-400 p-2 rounded-full hover:bg-blue-100 active:scale-95 transition-all"
            >
              <FaVolumeUp size={20} />
            </button>
            
            <h1 className="text-6xl font-black text-slate-800 mb-2">{currentWord.word}</h1>
            <div className="text-xl font-medium text-slate-500 mb-1">{displayPinyin}</div>
            
            {/* 谐音 (如果有) */}
            {currentWord.similar_sound && (
              <div className="text-sm px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full mt-2 font-bold">
                谐音: {currentWord.similar_sound}
              </div>
            )}
          </div>

          {/* 释义区 */}
          <div className="p-6 space-y-6">
            
            {/* 缅语 & 中文释义 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-800 mb-1">{currentWord.burmese || "Burmese Def"}</div>
              <div className="text-slate-400">{currentWord.definition || "Definition"}</div>
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            {/* 例句 */}
            {currentWord.example && (
              <div 
                className="bg-slate-50 p-4 rounded-xl cursor-pointer active:bg-slate-100 transition-colors"
                onClick={() => playAudio(currentWord.example)}
              >
                <div className="flex items-center gap-2 mb-1 text-xs text-blue-500 font-bold uppercase tracking-wider">
                  <FaVolumeUp size={10} /> 例句
                </div>
                <div className="text-slate-700 text-lg leading-relaxed">{currentWord.example}</div>
                {currentWord.example_burmese && (
                  <div className="text-slate-400 text-sm mt-1">{currentWord.example_burmese}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 底部导航栏 */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-between z-20">
        <button 
          onClick={handlePrev}
          // 如果是第一个单词且是第一个Block，可能禁用返回，或者允许返回上一页
          disabled={index === 0 && isFirstBlock} 
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all ${index === 0 && isFirstBlock ? 'text-slate-300' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <FaChevronLeft /> Prev
        </button>

        <button 
          onClick={handleNext}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
        >
          {index === total - 1 ? "完成 (Finish)" : "下一个 (Next)"} <FaChevronRight />
        </button>
      </div>

    </div>
  );
}
