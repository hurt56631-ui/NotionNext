import React, { useState, useEffect, useRef } from 'react';
import { FaVolumeUp, FaChevronLeft, FaChevronRight, FaTimes, FaMagic } from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';

// --- 1. 音频控制工具 ---

// 停止所有正在播放的声音
const stopAllAudio = () => {
  Howl.unload(); // 卸载所有 Howl 实例
  // 停止所有原生 Audio 元素 (如果有)
  const audioElements = document.getElementsByTagName('audio');
  for (let i = 0; i < audioElements.length; i++) {
    audioElements[i].pause();
  }
};

// 播放单词 R2 音频
const playR2Audio = (wordObj) => {
  stopAllAudio();
  
  // 1. 检查数据，如果没有 HSK 等级或 ID，回退到 TTS
  if (!wordObj || !wordObj.id || !wordObj.hsk_level) {
    const text = wordObj?.word || wordObj?.chinese;
    if (text) playTTS(text);
    return;
  }

  // 2. 构建 R2 URL (例如 hsk1/0001.mp3)
  const formattedId = String(wordObj.id).padStart(4, '0');
  const level = wordObj.hsk_level;
  const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

  // 3. 播放
  const sound = new Howl({
    src: [audioUrl],
    html5: true, // 强制 HTML5 Audio，支持流式和跨域
    volume: 1.0,
    onloaderror: (id, err) => {
      console.warn("R2 Audio missing, fallback to TTS:", err);
      playTTS(wordObj.word || wordObj.chinese);
    },
    onplayerror: (id, err) => {
      console.warn("R2 Audio play error:", err);
      playTTS(wordObj.word || wordObj.chinese);
    }
  });
  
  sound.play();
};

// 播放拼读单字音频 (拼音文件名)
const playSpellingAudio = (pyWithTone) => {
  return new Promise((resolve) => {
    // URL 编码处理特殊字符
    const filename = encodeURIComponent(pyWithTone); 
    const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${filename}.mp3`;
    
    const sound = new Howl({
      src: [url],
      html5: true,
      onend: resolve,
      onloaderror: () => {
        // 如果拼读音频缺失，尝试用 TTS 补救，或者直接跳过
        resolve(); 
      },
      onplayerror: () => {
        resolve();
      }
    });
    sound.play();
  });
};

// 播放 TTS (用于例句或回退)
const playTTS = (text) => {
  if (!text) return;
  stopAllAudio();
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.error("TTS play failed", e));
};

// --- 2. 拼读弹窗组件 ---
const SpellingModal = ({ wordObj, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const word = wordObj.word || wordObj.chinese || "";

  useEffect(() => {
    let isCancelled = false;

    const runSpellingSequence = async () => {
      const chars = word.split('');
      
      // 1. 逐字朗读拼音
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        
        // 获取单字拼音 (带声调)
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        
        // 播放对应的拼读音频文件
        await playSpellingAudio(charPinyin);

        // 稍微停顿
        await new Promise(r => setTimeout(r, 150));
      }

      if (isCancelled) return;

      // 2. 拼读结束后，播放单词原音 (R2音频)
      setActiveCharIndex('all');
      playR2Audio(wordObj);

      // 3. 播放完单词音频后延迟关闭
      // 这里没办法精确知道 playR2Audio 什么时候结束(除非改造 playR2Audio 返回 Promise)
      // 所以给一个估算时间，或者让用户手动关闭也可以，这里设置 1.5秒后自动关闭
      setTimeout(() => {
        if (!isCancelled) onClose();
      }, 1500);
    };

    runSpellingSequence();

    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [word, wordObj, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm flex flex-col items-center relative">
        <button onClick={onClose} className="absolute -top-16 right-0 text-slate-400 p-2 hover:text-slate-600">
            <FaTimes size={28}/>
        </button>
        <h3 className="text-sm font-bold text-slate-400 mb-10 tracking-[0.3em] uppercase">Spelling Mode</h3>
        
        <div className="flex flex-wrap justify-center gap-6">
          {word.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center transition-all duration-200">
                 <span className={`text-2xl font-mono mb-3 transition-colors ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>
                   {py}
                 </span>
                 <span className={`text-7xl font-black transition-all transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-800 scale-100'}`}>
                   {char}
                 </span>
               </div>
             )
          })}
        </div>
        <div className="mt-12 text-slate-400 text-sm animate-pulse font-medium">
            {activeCharIndex === 'all' ? '完整朗读' : '拼读中...'}
        </div>
      </div>
    </div>
  );
};

// --- 3. 主组件 ---
export default function WordStudyPlayer({ data, onNext, onPrev, isFirstBlock }) {
  const words = data.words || [];
  const [index, setIndex] = useState(0);
  const [showSpelling, setShowSpelling] = useState(false);

  const currentWord = words[index];
  const total = words.length;

  // 切换单词时自动播放 R2 音频
  useEffect(() => {
    if (currentWord) {
      const timer = setTimeout(() => {
        playR2Audio(currentWord);
      }, 500); // 延迟 500ms 播放，体验更柔和
      return () => clearTimeout(timer);
    }
  }, [index, currentWord]);

  const handleNext = () => {
    if (index < total - 1) setIndex(index + 1);
    else onNext && onNext();
  };

  const handlePrev = () => {
    if (index > 0) setIndex(index - 1);
    else onPrev && onPrev();
  };

  if (!currentWord) return <div className="p-10 text-center text-slate-400">Loading words...</div>;

  const displayPinyin = currentWord.pinyin || pinyin(currentWord.word || currentWord.chinese);
  const displayWord = currentWord.word || currentWord.chinese;

  return (
    // 使用 bg-white 实现全屏扁平化，去除所有阴影和圆角边框
    <div className="w-full h-[100dvh] flex flex-col bg-white text-slate-800 relative overflow-hidden">
      
      {/* 1. 顶部区域 (移除进度条，只保留简单的计数，或者留白) */}
      <div className="flex-none h-14 px-6 flex items-center justify-end z-10">
        <div className="text-slate-300 text-xs font-bold font-mono bg-slate-50 px-2 py-1 rounded">
          {index + 1} / {total}
        </div>
      </div>

      {/* 2. 主内容区域 (垂直分布，居中) */}
      <div className="flex-1 flex flex-col items-center w-full px-6 overflow-y-auto pb-32 no-scrollbar">
        
        {/* 上半部分：单词核心展示 */}
        <div className="w-full flex flex-col items-center pt-4 pb-8">
          
          {/* 拼音 */}
          <div className="text-xl text-orange-500 font-medium font-mono mb-2">{displayPinyin}</div>
          
          {/* 大字 */}
          <h1 
            className="text-7xl font-black text-slate-900 tracking-tight leading-none mb-4 cursor-pointer active:scale-95 transition-transform" 
            onClick={() => playR2Audio(currentWord)}
          >
            {displayWord}
          </h1>

          {/* 谐音 (如果存在) */}
          {currentWord.similar_sound && (
            <div className="mb-6 px-3 py-1 bg-yellow-50 text-yellow-600 text-sm font-bold rounded-full border border-yellow-100">
              谐音: {currentWord.similar_sound}
            </div>
          )}

          {/* 释义 (重点突出缅语) */}
          <div className="text-center w-full max-w-md mb-8">
             {currentWord.burmese && (
               <div className="text-2xl font-bold text-slate-800 mb-2 font-['Padauk'] leading-snug">
                 {currentWord.burmese}
               </div>
             )}
             {(currentWord.explanation || currentWord.definition) && (
               <div className="text-slate-500 text-base leading-relaxed">
                 {currentWord.explanation || currentWord.definition}
               </div>
             )}
          </div>

          {/* 功能按钮组 */}
          <div className="flex items-center gap-4 mb-8">
             {/* 拼读按钮 - 显著样式 */}
             <button 
                onClick={(e) => { e.stopPropagation(); setShowSpelling(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-105 active:scale-95 transition-all font-bold"
             >
               <FaMagic className="animate-pulse" /> 拼读演示
             </button>

             {/* 普通播放按钮 */}
             <button 
                onClick={() => playR2Audio(currentWord)} 
                className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors"
             >
               <FaVolumeUp size={20} />
             </button>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="w-24 h-px bg-slate-100 mb-8 flex-none"></div>

        {/* 下半部分：例句列表 (居中显示，带TTS) */}
        <div className="w-full max-w-lg space-y-6 text-center">
            {currentWord.example && (
              <ExampleRow 
                text={currentWord.example} 
                translation={currentWord.example_burmese} 
              />
            )}
            {currentWord.example2 && (
              <ExampleRow 
                text={currentWord.example2} 
                translation={currentWord.example2_burmese} 
              />
            )}
        </div>

      </div>

      {/* 3. 底部固定按钮 (扁平化) */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-slate-50 px-6 pt-4"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-6 max-w-md mx-auto">
            <button 
              onClick={handlePrev}
              disabled={index === 0 && isFirstBlock} 
              className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all
                ${index === 0 && isFirstBlock 
                  ? 'border-slate-100 text-slate-200 cursor-not-allowed' 
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 active:scale-95'}`}
            >
              <FaChevronLeft size={20} />
            </button>

            <button 
              onClick={handleNext}
              className="flex-1 h-14 bg-slate-900 text-white rounded-full font-bold text-lg shadow-xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-slate-800"
            >
              {index === total - 1 ? "完成" : "下一个"} <FaChevronRight size={16} />
            </button>
        </div>
      </div>

      {/* 拼读模态框 */}
      {showSpelling && (
        <SpellingModal wordObj={currentWord} onClose={() => setShowSpelling(false)} />
      )}

    </div>
  );
}

// 辅助组件：例句行 (增加拼音显示，居中对齐)
const ExampleRow = ({ text, translation }) => {
  const py = pinyin(text, { toneType: 'symbol' });
  
  return (
    <div 
      className="flex flex-col items-center py-2 cursor-pointer group active:scale-[0.99] transition-transform"
      onClick={() => playTTS(text)} // 点击例句播放 TTS
    >
      {/* 拼音行 */}
      <div className="text-sm text-orange-400 mb-1 font-mono leading-none opacity-80 group-hover:opacity-100">
        {py}
      </div>
      {/* 汉字行 */}
      <div className="text-xl text-slate-700 font-medium leading-relaxed">
        {text}
      </div>
      {/* 翻译行 */}
      {translation && (
        <div className="text-base text-slate-400 mt-1 font-['Padauk']">
          {translation}
        </div>
      )}
      {/* 小喇叭图标提示 */}
      <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400 text-xs flex items-center gap-1">
        <FaVolumeUp /> 点击朗读
      </div>
    </div>
  );
};
