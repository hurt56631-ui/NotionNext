import React, { useState, useEffect, useRef } from 'react';
import { FaVolumeUp, FaChevronLeft, FaChevronRight, FaTimes, FaPuzzlePiece } from "react-icons/fa";
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';

// --- 1. 音频控制工具 ---
const stopAllAudio = () => {
  Howl.unload();
};

const playR2Audio = (wordObj) => {
  stopAllAudio();
  
  // 1. 检查必要数据，如果没有 HSK 等级或 ID，直接回退到 TTS
  if (!wordObj.id || !wordObj.hsk_level) {
    playTTS(wordObj.word || wordObj.chinese);
    return;
  }

  // 2. 构建 R2 URL (ID 需要补全为 4 位，例如 1 -> 0001)
  const formattedId = String(wordObj.id).padStart(4, '0');
  const level = wordObj.hsk_level;
  const audioUrl = `https://audio.886.best/chinese-vocab-audio/hsk${level}/${formattedId}.mp3`;

  // 3. 尝试播放
  const sound = new Howl({
    src: [audioUrl],
    html5: true, // 强制 HTML5 Audio 以支持流式播放
    onloaderror: () => {
      console.warn("R2 Audio load failed, fallback to TTS");
      playTTS(wordObj.word || wordObj.chinese);
    },
    onplayerror: () => {
      console.warn("R2 Audio play failed, fallback to TTS");
      playTTS(wordObj.word || wordObj.chinese);
    }
  });
  
  sound.play();
};

const playTTS = (text) => {
  if (!text) return;
  stopAllAudio();
  // 使用简单的 TTS 接口作为备选
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
        
        // 获取单字拼音
        const charPinyin = pinyin(chars[i], { toneType: 'symbol' });
        
        // 播放单字音频 (这里暂时用 TTS 模拟单字发音，如果有单字音频库更好)
        await new Promise(resolve => {
           const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(charPinyin)}&v=zh-CN-XiaoxiaoNeural&s=0.8`;
           const audio = new Audio(url);
           audio.onended = resolve;
           audio.onerror = resolve; 
           audio.play().catch(resolve);
        });

        // 稍微停顿
        await new Promise(r => setTimeout(r, 200));
      }

      if (isCancelled) return;

      // 2. 整词朗读
      setActiveCharIndex('all');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm flex flex-col items-center shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500 p-2"><FaTimes size={20}/></button>
        <h3 className="text-lg font-bold text-slate-500 mb-8 tracking-widest uppercase">拼读演示</h3>
        
        <div className="flex flex-wrap justify-center gap-6">
          {word.split('').map((char, idx) => {
             const py = pinyin(char, { toneType: 'symbol' });
             const isActive = idx === activeCharIndex || activeCharIndex === 'all';
             return (
               <div key={idx} className="flex flex-col items-center transition-all duration-300">
                 <span className={`text-xl font-mono mb-2 transition-colors ${isActive ? 'text-orange-500 font-bold' : 'text-slate-300'}`}>
                   {py}
                 </span>
                 <span className={`text-6xl font-black transition-all transform ${isActive ? 'text-blue-600 scale-110' : 'text-slate-800 scale-100'}`}>
                   {char}
                 </span>
               </div>
             )
          })}
        </div>
        <div className="mt-10 text-slate-400 text-sm font-medium animate-pulse">正在拼读...</div>
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

  // 切换单词时自动播放
  useEffect(() => {
    if (currentWord) {
      const timer = setTimeout(() => {
        playR2Audio(currentWord);
      }, 400); // 稍微延迟，体验更流畅
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
    // h-[100dvh] 解决移动端浏览器地址栏遮挡问题
    <div className="w-full h-[100dvh] flex flex-col bg-slate-50 relative overflow-hidden">
      
      {/* 1. 顶部进度条 (固定) */}
      <div className="flex-none px-6 py-4 flex items-center justify-between z-10 bg-slate-50">
        <div className="text-slate-400 text-sm font-bold font-mono tracking-wider">
          {index + 1} <span className="text-slate-300">/</span> {total}
        </div>
        <div className="flex-1 mx-4 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 2. 可滚动内容区域 (flex-1) */}
      {/* pb-32 确保底部内容不被按钮遮挡 */}
      <div className="flex-1 overflow-y-auto px-4 pb-40 w-full max-w-3xl mx-auto scrollbar-hide">
        
        {/* 卡片容器 */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative mt-2">
          
          {/* A. 顶部单词展示区 */}
          <div className="bg-gradient-to-b from-blue-50 to-white p-8 pb-6 flex flex-col items-center justify-center border-b border-slate-50 relative">
            
            {/* 顶部控制按钮 */}
            <div className="absolute top-4 right-4 flex gap-3">
               {/* 拼读按钮 */}
               <button 
                onClick={() => setShowSpelling(true)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-orange-500 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all font-serif font-bold text-lg"
                title="拼读"
              >
                拼
              </button>
              {/* 播放按钮 */}
              <button 
                onClick={() => playR2Audio(currentWord)}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 text-blue-500 flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 transition-all"
              >
                <FaVolumeUp size={16} />
              </button>
            </div>
            
            <div className="mt-4 text-xl font-medium text-orange-500 mb-2 font-mono">{displayPinyin}</div>
            <h1 className="text-6xl md:text-7xl font-black text-slate-800 mb-4 tracking-tight">{displayWord}</h1>
            
            {/* 单词分解 (如果有 decomposition 字段，或者手动拆分) */}
            <div className="flex gap-2 mb-2">
               {(currentWord.decomposition || displayWord.split('')).map((char, i) => (
                 <span key={i} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-sm font-medium flex items-center gap-1">
                   {i === 0 && <FaPuzzlePiece size={10} className="text-slate-400"/>}
                   {char}
                 </span>
               ))}
            </div>

            {/* 谐音 */}
            {currentWord.similar_sound && (
              <div className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full font-bold mt-2">
                谐音: {currentWord.similar_sound}
              </div>
            )}
          </div>

          {/* B. 详情区 */}
          <div className="p-6 md:p-8 space-y-8">
            
            {/* 释义与翻译 - 分开显示 */}
            <div className="text-center space-y-3">
              {currentWord.burmese && (
                  <div className="text-2xl font-bold text-slate-800 leading-snug font-['Padauk']">
                    {currentWord.burmese}
                  </div>
              )}
              
              {/* 定义/解释 (如果有，且不等于翻译) */}
              {(currentWord.definition || currentWord.explanation) && (
                <div className="text-slate-500 text-lg leading-relaxed bg-slate-50 p-3 rounded-xl inline-block">
                  {currentWord.explanation || currentWord.definition}
                </div>
              )}
            </div>

            <div className="w-full h-px bg-slate-100"></div>

            {/* 例句区域 - 支持两个例句 */}
            <div className="space-y-4">
              {/* 例句 1 */}
              {currentWord.example && (
                <ExampleItem 
                  text={currentWord.example} 
                  translation={currentWord.example_burmese} 
                  onClick={() => playTTS(currentWord.example)}
                />
              )}
              
              {/* 例句 2 */}
              {currentWord.example2 && (
                <ExampleItem 
                  text={currentWord.example2} 
                  translation={currentWord.example2_burmese} 
                  onClick={() => playTTS(currentWord.example2)}
                />
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 3. 底部固定导航栏 */}
      {/* pb-[env(safe-area-inset-bottom)] 适配 iPhone 底部横条 */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-6 pt-4"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between max-w-3xl mx-auto gap-4">
            <button 
              onClick={handlePrev}
              disabled={index === 0 && isFirstBlock} 
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-bold text-lg transition-all border border-transparent
                ${index === 0 && isFirstBlock 
                  ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95'}`}
            >
              <FaChevronLeft size={16} /> Prev
            </button>

            <button 
              onClick={handleNext}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform hover:bg-blue-700"
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

// 辅助组件：例句条目
const ExampleItem = ({ text, translation, onClick }) => (
  <div 
    className="bg-slate-50 p-5 rounded-2xl cursor-pointer hover:bg-slate-100 active:scale-[0.99] transition-all border border-transparent hover:border-slate-200 group"
    onClick={onClick}
  >
    <div className="flex items-center gap-2 mb-2 text-xs text-blue-500 font-bold uppercase tracking-wider opacity-70 group-hover:opacity-100">
      <FaVolumeUp size={10} /> 例句
    </div>
    <div className="text-slate-700 text-lg leading-relaxed font-medium mb-1">
      {text}
    </div>
    {translation && (
      <div className="text-slate-400 text-base font-['Padauk']">
        {translation}
      </div>
    )}
  </div>
);
