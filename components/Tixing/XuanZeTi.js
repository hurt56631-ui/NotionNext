import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 简易封装 (缓存 TTS 音频) ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => { console.error("IndexedDB error:", e); reject(e); };
    });
  },
  async get(key) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => { console.error("IDB set error:", e); reject(e); };
    });
  }
};

// --- 2. ✅ 修复后的音频控制器 ---
const audioController = {
  currentAudio: null,
  latestRequestId: 0,

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.latestRequestId++;
  },

  isBurmese(text) {
    // 检测是否包含缅文 Unicode 区块
    return /[\u1000-\u109F]/.test(text);
  },

  getVoice(text, isTitle) {
    // 1. 标题强制使用 Ava
    if (isTitle) return 'en-US-AvaMultilingualNeural';
    
    // 2. 包含缅文 -> 使用 Ava
    if (this.isBurmese(text)) {
      return 'en-US-AvaMultilingualNeural'; 
    }
    
    // 3. 全是中文/其他 -> 使用晓悠
    return 'zh-CN-XiaoyouMultilingualNeural';
  },

  async play(text, isTitle = false, rate = 1.0) {
    if (!text || !text.trim()) return;

    const myRequestId = ++this.latestRequestId;
    this.stop(); 

    // ✅ 修复：正则确保保留中文、缅文、英文、数字
    // 之前的正则可能太严格了，这里放宽一点
    const textToRead = text.replace(/[^\u4e00-\u9fa5\u1000-\u109Fa-zA-Z0-9\s，。！？、]/g, ''); 
    if (!textToRead.trim()) return;

    const voice = this.getVoice(text, isTitle);
    const cacheKey = `tts-${voice}-${textToRead}-${rate}`;
    let audioUrl;

    try {
      const cachedBlob = await idb.get(cacheKey);
      if (myRequestId !== this.latestRequestId) return;

      if (cachedBlob) {
        audioUrl = URL.createObjectURL(cachedBlob);
      } else {
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${voice}&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
        const blob = await res.blob();
        
        if (myRequestId !== this.latestRequestId) return;
        
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      await audio.play().catch(e => console.warn("Auto-play blocked:", e));

      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

    } catch (e) {
      console.error("Audio playback error:", e);
    }
  },

  async preload(text, isTitle = false) {
    if (!text || !text.trim()) return;
    const textToRead = text.replace(/[^\u4e00-\u9fa5\u1000-\u109Fa-zA-Z0-9\s]/g, '');
    if (!textToRead.trim()) return;

    const voice = this.getVoice(text, isTitle);
    const cacheKey = `tts-${voice}-${textToRead}-1.0`;

    try {
      const cachedBlob = await idb.get(cacheKey);
      if (cachedBlob) return;

      const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${voice}&r=0`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const blob = await res.blob();
        await idb.set(cacheKey, blob);
      }
    } catch (e) {
      console.error("Preload error:", e);
    }
  }
};

export const preloadNextLessonAudios = (texts = []) => {
    if (!Array.isArray(texts)) return;
    Promise.allSettled(texts.map(text => audioController.preload(text, false)));
};


// --- 样式定义 (CSS) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&display=swap');

  /* ✅ 禁止页面整体下拉刷新 */
  html, body {
    overscroll-behavior: none;
    touch-action: manipulation;
  }

  .xzt-container { 
    width: 100%; height: 100%; display: flex; flex-direction: column; 
    align-items: center; position: relative; padding: 0 16px; overflow-y: auto; 
    overscroll-behavior: none; /* 容器也加上 */
  }
  
  .spacer { flex: 1; min-height: 5px; max-height: 30px; }

  /* 标题区域 */
  .xzt-question-title {
    padding: 12px;
    text-align: center;
    cursor: pointer;
    width: 100%;
    max-width: 480px;
    margin: 0 auto 10px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    border-radius: 20px;
    transition: background-color 0.2s;
  }
  .xzt-question-title:active { background-color: #f9fafb; }

  .question-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 16px; margin-bottom: 16px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }

  /* 拼音/文字容器：强制横向排列，居中 */
  .pinyin-box { 
    display: flex; 
    flex-wrap: wrap; 
    justify-content: center; 
    gap: 4px; 
    row-gap: 8px; 
    align-items: flex-end; 
    flex-direction: row !important;
  }

  .char-block { display: flex; flex-direction: column; align-items: center; }
  
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -3px; height: 1em; }
  .cn-text { font-size: 1.4rem; font-weight: 700; color: #1e293b; line-height: 1.2; }
  .my-text-title { font-family: 'Padauk', sans-serif; font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.4; }

  /* 选项区域 */
  .xzt-options-grid { display: grid; grid-template-columns: 1fr; gap: 10px; width: 100%; max-width: 480px; padding-bottom: 140px; }
  
  .xzt-option-card {
    position: relative; background: #ffffff; border-radius: 18px; border: 2px solid #f1f5f9;
    /* ✅ 修复：减少内边距，防止卡片太长 */
    padding: 12px; 
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden;
    min-height: 60px;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  /* 布局控制 */
  .layout-text-only { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .layout-with-image { display: flex; flex-direction: row; align-items: center; }

  .opt-img-wrapper { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; background: #f3f4f6; margin-right: 12px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  /* 选项文字容器 */
  .opt-text-box { display: flex; width: 100%; }
  
  /* ✅ 修复：纯文字模式下，内容强制居中 */
  .layout-text-only .opt-text-box { 
    justify-content: center; 
    align-items: center; 
  } 
  
  /* 有图片模式下，内容左对齐 */
  .layout-with-image .opt-text-box { 
    justify-content: flex-start; 
    align-items: center; /* 垂直居中 */
  }

  .opt-pinyin { font-size: 0.75rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; }
  .opt-cn { font-size: 1.2rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-my { font-family: 'Padauk', sans-serif; font-size: 1.25rem; font-weight: 600; color: #334155; }

  /* 底部固定区域 */
  .fixed-bottom-area { 
    position: fixed; bottom: 80px; left: 0; right: 0; 
    display: flex; flex-direction: column; align-items: center; 
    pointer-events: none; z-index: 60; padding: 0 20px; 
  }
  
  .explanation-card { 
    background: #fff; border: 1px solid #fecaca; background-color: #fef2f2; 
    color: #b91c1c; padding: 12px 16px; border-radius: 16px; margin-bottom: 12px; 
    font-size: 0.95rem; line-height: 1.4; text-align: left; width: 100%; 
    max-width: 480px; pointer-events: auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); 
    display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out; 
  }

  .submit-btn { 
    pointer-events: auto; min-width: 150px; padding: 14px 30px; border-radius: 100px; 
    font-size: 1.1rem; font-weight: 800; color: white; 
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); 
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4); border: none; transition: all 0.2s; 
  }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: translateY(20px); opacity: 0; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// 工具函数
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);

const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      if (isChineseChar(char)) {
        return { char, pinyin: pinyins[pyIndex++] || '' };
      }
      return { char, pinyin: '' };
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionData, setQuestionData] = useState({ displayParts: [] });
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 分割混合文本
  const generateDisplayParts = (text) => {
    if(!text) return [];
    const regex = /([\u1000-\u109F]+|[\u4e00-\u9fa5]+|[^ \u4e00-\u9fa5\u1000-\u109F]+)/g;
    const parts = text.match(regex) || [];
    return parts.map(part => {
        if (/[\u1000-\u109F]/.test(part)) return { type: 'my', text: part };
        if (/[\u4e00-\u9fa5]/.test(part)) return { type: 'zh', text: part, pinyinData: generatePinyinData(part) };
        return { type: 'other', text: part };
    });
  }

  useEffect(() => {
    audioController.stop();

    setQuestionData({ displayParts: generateDisplayParts(question.text) });
    
    const processed = options.map(opt => ({
      ...opt,
      displayParts: generateDisplayParts(opt.text),
      hasImage: !!opt.imageUrl
    }));

    setShuffledOptions([...processed].sort(() => Math.random() - 0.5));

    // 自动播放题目 (isTitle=true -> 强制 Ava)
    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, true, 0.9).finally(() => setIsPlaying(false));
    }

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    return () => audioController.stop();
  }, [question, options]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    if (showExplanation) setShowExplanation(false);
    // 朗读选项
    if (option.text) audioController.play(option.text, false, 0.95);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      
      // ✅ 朗读解析
      if (explanation) {
        setShowExplanation(true);
        setTimeout(() => {
           audioController.play(explanation, false, 0.9);
        }, 500);
      }
      
      setTimeout(() => setIsSubmitted(false), 2000);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    // 点击标题朗读 (isTitle=true)
    audioController.play(question.text, true, 0.9).finally(() => setIsPlaying(false));
  };

  const renderTextParts = (parts, isTitle = false, hasImage = false) => (
    <div 
        className={isTitle ? "pinyin-box" : "opt-text-box"}
        style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            flexWrap: 'wrap',
            // ✅ 修复：如果是标题 OR (没有图片且非标题)，则居中
            justifyContent: (isTitle || !hasImage) ? 'center' : 'flex-start', 
            alignItems: isTitle ? 'flex-end' : 'center',
        }}
    >
        {parts.map((part, index) => {
            if (part.type === 'zh') {
                return (
                    <span key={index} style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center' }}>
                        {part.pinyinData.map((item, idx) => (
                             <div key={idx} className="char-block">
                                <span className={isTitle ? "py-text" : "opt-pinyin"}>{item.pinyin || ' '}</span>
                                <span className={isTitle ? "cn-text" : "opt-cn"}>{item.char}</span>
                            </div>
                        ))}
                    </span>
                );
            }
            if (part.type === 'my') {
                return (
                    <span key={index} className={isTitle ? "my-text-title" : "opt-my"} style={{ margin: '0 4px' }}>
                        {part.text}
                    </span>
                );
            }
            return (
                <span key={index} className={isTitle ? "cn-text" : "opt-cn"} style={{ margin: '0 2px' }}>
                    {part.text}
                </span>
            );
        })}
    </div>
  );

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        <div className="spacer" />
        
        {/* 标题 */}
        <div className="xzt-question-title" onClick={handleReadQuestion}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp size={20} className={isPlaying ? 'icon-pulse' : ''} />
          </div>
          {renderTextParts(questionData.displayParts, true)}
        </div>

        <div className="spacer" />

        {/* 选项 */}
        <div className="xzt-options-grid">
          {shuffledOptions.map(option => {
            const optIdStr = String(option.id);
            const selIdStr = String(selectedId);
            const correctIds = correctAnswer.map(String);
            let statusClass = '';
            
            if (isSubmitted) {
              if (correctIds.includes(optIdStr)) statusClass = 'correct';
              else if (optIdStr === selIdStr) statusClass = 'incorrect';
            } else if (optIdStr === selIdStr) {
              statusClass = 'selected';
            }
            
            const layoutClass = option.hasImage ? 'layout-with-image' : 'layout-text-only';
            
            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${layoutClass} ${statusClass}`} 
                onClick={() => handleSelect(option)}
              >
                {option.hasImage && (
                    <div className="opt-img-wrapper">
                        <img src={option.imageUrl} alt="option" className="opt-img" />
                    </div>
                )}
                
                {renderTextParts(option.displayParts, false, option.hasImage)}

                {isSubmitted && correctIds.includes(optIdStr) && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && optIdStr === selIdStr && !correctIds.includes(optIdStr) && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
              </div>
            );
          })}
        </div>

        {/* 底部固定区域 */}
        <div className="fixed-bottom-area">
          {showExplanation && explanation && (
            <div className="explanation-card">
               <FaLightbulb className="flex-shrink-0 mt-1" />
               <div>{explanation}</div>
            </div>
          )}
          <button 
            className="submit-btn" 
            onClick={handleSubmit} 
            disabled={!selectedId || (isSubmitted && !showExplanation)}
          >
            {isSubmitted 
                ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "再试一次") 
                : "确认"
            }
          </button>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
