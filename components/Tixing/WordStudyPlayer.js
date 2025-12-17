import React, { useState, useEffect, useRef } from 'react';
import { FaVolumeUp, FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';

// --- 1. 音频控制工具 ---
const stopAllAudio = () => {
  Howl.unload();
};

// 播放单词音频 (HSK分级 + 数字ID)
const playWordAudio = (wordObj) => {
  stopAllAudio();
  
  // 1. 检查必要数据
  if (!wordObj.id || !wordObj.hsk_level) {
    playTTS(wordObj.word || wordObj.chinese);
    return;
  }

  // 2. 构建 URL: hsk1/0001.mp3
  const formattedId = String(wordObj.id).padStart(4, '0');
  const level = wordObj.hsk_level;
  const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

  // 3. 播放
  const sound = new Howl({
    src: [audioUrl],
    html5: true, 
    onloaderror: () => {
      console.warn(`R2 Word Audio missing: ${audioUrl}`);
      playTTS(wordObj.word || wordObj.chinese);
    },
    onplayerror: () => {
      playTTS(wordObj.word || wordObj.chinese);
    }
  });
  
  sound.play();
};

// 播放拼读单字音频 (拼音文件名)
const playSpellingAudio = (pyWithTone) => {
  return new Promise((resolve) => {
    // 构建 URL: .../拼读音频/biào.mp3
    // encodeURIComponent 处理特殊字符和中文
    const filename = encodeURIComponent(pyWithTone); 
    const url = `https://audio.886.best/chinese-vocab-audio/%E6%8B%BC%E8%AF%BB%E9%9F%B3%E9%A2%91/${filename}.mp3`;
    
    const sound = new Howl({
      src: [url],
      html5: true,
      onend: resolve,
      onloaderror: () => {
        console.warn(`Spelling Audio missing: ${url}`);
        resolve(); // 失败也继续，避免卡死
      },
      onplayerror: () => {
        resolve();
      }
    });
    sound.play();
  });
};

const playTTS = (text) => {
  if (!text) return;
  stopAllAudio();
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  new Audio(url).play().catch(e => console.error("TTS play failed", e));
};

// --- 2. 拼读弹窗组件 ---
const SpellingModal = ({ word, onClose }) => {
  const [activeCharIndex, setActiveCharIndex] = useState(-1);

  useEffect(() => {
    let isCancelled = false;

    const runSpellingSequence = async () => {
      const chars = word.split('');
      
      // 1. 逐字朗读
      for (let i = 0; i < chars.length; i++) {
        if (isCancelled) return;
        setActiveCharIndex(i);
        
        // 获取单字拼音 (带声调，如 nǐ)
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        
        // 播放对应的拼读音频文件
        await playSpellingAudio(charPinyin);

        // 稍微停顿
        await new Promise(r => setTimeout(r, 100));
      }

      if (isCancelled) return;

      // 2. 整词朗读
      setActiveCharIndex('all');
      // 这里如果传入了完整的 wordObj 最好，现在只有 string，先尝试播放整词 TTS 或后续逻辑
      playTTS(word);

      // 3. 自动关闭
      setTimeout(() => {
        if (!isCancelled) onClose();
      }, 1500);
    };

    runSpellingSequence();

    return () => {
      isCancelled = true;
      stopAllAudio();
    };
  }, [word, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm flex flex-col items-center relative">
        <button onClick={onClose} className="absolute -top-12 right-0 text-slate-400 p-2"><FaTimes size={24}/></button>
        <h3 className="text-sm font-bold text-slate-400 mb-8 tracking-widest uppercase">SPELLING</h3>
        
        <div className="flex flex-wrap justify-center gap-6">
          {word.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center transition-all duration-200">
                 <span className={`text-xl font-mono mb-2 ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>
                   {py}
                 </span>
                 <span className={`text-7xl font-black transition-all transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-800 scale-100'}`}>
                   {char}
                 </span>
               </div>
             )
          })}
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

  useEffect(() => {
    if (currentWord) {
      const timer = setTimeout(() => {
        playWordAudio(currentWord);
      }, 400); 
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

  if (!currentWord) return <div className="p-10 text-center">No data available</div>;

  const displayPinyin = currentWord.pinyin || pinyin(currentWord.word || currentWord.chinese);
  const displayWord = currentWord.word || currentWord.chinese;

  return (
    // 使用 bg-white 实现全屏扁平化，去除所有阴影和圆角边框
    <div className="w-full h-[100dvh] flex flex-col bg-white text-slate-800 relative overflow-hidden">
      
      {/* 1. 顶部进度条 (极简) */}
      <div className="flex-none px-6 pt-4 pb-2 flex items-center justify-between z-10">
        <div className="flex-1 mr-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 rounded-full"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <div className="text-slate-300 text-xs font-bold font-mono">
          {index + 1}/{total}
        </div>
      </div>

      {/* 2. 主内容区域 (垂直分布，紧凑) */}
      <div className="flex-1 flex flex-col items-center w-full px-5 overflow-y-auto pb-32">
        
        {/* 上半部分：单词核心展示 */}
        <div className="w-full flex flex-col items-center pt-8 pb-4">
          <div className="text-xl text-orange-500 font-medium font-mono mb-1">{displayPinyin}</div>
          
          <div className="relative mb-6">
             <h1 className="text-7xl font-black text-slate-900 tracking-tight leading-none" onClick={() => playWordAudio(currentWord)}>
               {displayWord}
             </h1>
             {/* 拼读入口小按钮 */}
             <button 
                onClick={(e) => { e.stopPropagation(); setShowSpelling(true); }}
                className="absolute -right-8 top-0 text-xs font-bold text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100"
             >
               拼
             </button>
          </div>

          <div className="flex gap-4 mb-6">
             <button onClick={() => playWordAudio(currentWord)} className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
               <FaVolumeUp size={20} />
             </button>
          </div>

          {/* 释义 (重点突出缅语) */}
          <div className="text-center w-full max-w-md">
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
        </div>

        {/* 分隔线 */}
        <div className="w-16 h-1 bg-slate-100 rounded-full my-2 flex-none"></div>

        {/* 下半部分：例句列表 (紧凑，带拼音) */}
        <div className="w-full max-w-md space-y-4 mt-2">
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
        className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-50 px-6 pt-3"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-4 max-w-md mx-auto">
            <button 
              onClick={handlePrev}
              disabled={index === 0 && isFirstBlock} 
              className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all
                ${index === 0 && isFirstBlock 
                  ? 'border-slate-100 text-slate-200 cursor-not-allowed' 
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-95'}`}
            >
              <FaChevronLeft size={18} />
            </button>

            <button 
              onClick={handleNext}
              className="flex-1 h-14 bg-blue-600 text-white rounded-full font-bold text-lg shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {index === total - 1 ? "完成" : "下一个"} <FaChevronRight size={16} />
            </button>
        </div>
      </div>

      {/* 拼读模态框 */}
      {showSpelling && (
        <SpellingModal word={displayWord} onClose={() => setShowSpelling(false)} />
      )}

    </div>
  );
}

// 辅助组件：例句行 (增加拼音显示)
const ExampleRow = ({ text, translation }) => {
  const py = pinyin(text, { toneType: 'symbol' });
  
  return (
    <div 
      className="flex flex-col py-2 border-b border-slate-50 last:border-0 cursor-pointer active:opacity-70 transition-opacity"
      onClick={() => playTTS(text)} // 点击播放例句 TTS
    >
      {/* 拼音行 */}
      <div className="text-xs text-orange-400 mb-0.5 font-mono leading-none truncate">
        {py}
      </div>
      {/* 汉字行 */}
      <div className="text-lg text-slate-700 font-medium leading-snug">
        {text}
      </div>
      {/* 翻译行 */}
      {translation && (
        <div className="text-sm text-slate-400 mt-1 font-['Padauk']">
          {translation}
        </div>
      )}
    </div>
  );
};
