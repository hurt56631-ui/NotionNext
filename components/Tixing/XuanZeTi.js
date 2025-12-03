import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存封装 (不变) ---
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
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  }
};

// --- 2. 多语言音频控制器 (不变) ---
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

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) {
      return 'my';
    }
    return 'zh';
  },

  async play(text, rate = 1.0) {
    this.stop();
    if (!text) return;

    const textToRead = text.replace(/[^\p{L}\p{N}\s]/gu, '');
    if (!textToRead.trim()) return;

    const myRequestId = ++this.latestRequestId;
    const lang = this.detectLanguage(textToRead);
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';
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
        if (!res.ok) throw new Error(`TTS API failed with status ${res.status}`);
        const blob = await res.blob();
        if (myRequestId !== this.latestRequestId) return;
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      await audio.play();

      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      };
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  }
};


// --- 3. ✅ 全面更新的样式定义 ---
const cssStyles = `
  .xzt-container {
    font-family: "Noto Sans Myanmar", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 20px 16px 0 16px; /* 增加顶部内边距 */
    overflow-y: auto;
    overscroll-behavior-y: contain; /* 禁止下拉刷新 */
  }

  /* --- ✅ 新增：答对动画 --- */
  @keyframes correctAnswerBounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* --- ✅ 修改：标题不再是卡片 --- */
  .xzt-question-area {
    text-align: center;
    cursor: pointer;
    width: 100%;
    max-width: 500px;
    margin: 0 auto 24px auto;
    padding: 16px 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  
  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 16px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }

  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 8px; row-gap: 12px; align-items: flex-end; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.9rem; color: #94a3b8; font-family: monospace; margin-bottom: 2px; }
  .cn-text { font-size: 1.8rem; font-weight: 700; color: #1e293b; line-height: 1.4; }

  /* --- 选项区域 --- */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    width: 100%;
    max-width: 500px;
    padding-bottom: 200px; /* 留出足够空间给底部固定区域 */
  }

  .xzt-option-card {
    position: relative; background: #ffffff; border-radius: 20px; border: 2px solid #f1f5f9;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; transform: scale(1.02); }
  
  /* ✅ 应用答对动画 */
  .xzt-option-card.correct {
    border-color: #4ade80;
    background: #f0fdf4;
    animation: correctAnswerBounce 0.5s ease-out;
  }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  .layout-text-only { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; min-height: 68px; }
  .layout-with-image { display: flex; align-items: center; padding: 16px; min-height: 90px; }
  .opt-img-wrapper { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-right: 16px; flex-shrink: 0; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  .opt-text-box { display: flex; flex-direction: column; justify-content: center; width: 100%; }
  .layout-text-only .opt-text-box { align-items: center; text-align: center; }
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }
  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-my, .opt-en { font-size: 1.2rem; font-weight: 600; color: #475569; }

  /* --- ✅ 修改：底部固定区域，上移并增加安全区 --- */
  .fixed-bottom-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column-reverse; /* 先按钮后解析，更符合视觉 */
    align-items: center;
    gap: 12px;
    padding: 20px 20px calc(20px + env(safe-area-inset-bottom)); /* 适配 iPhone 安全区 */
    background: linear-gradient(to top, white 60%, transparent 100%);
    pointer-events: none;
    z-index: 60;
  }
  .explanation-card {
    background-color: #fff1f2; color: #be123c; padding: 12px 16px;
    border-radius: 16px; font-size: 0.95rem; line-height: 1.4; text-align: left;
    width: 100%; max-width: 500px; pointer-events: auto;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
    display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out;
    border: 1px solid #fecaca;
  }
  .submit-btn {
    pointer-events: auto; width: 100%; max-width: 500px; padding: 16px 30px; border-radius: 100px;
    font-size: 1.1rem; font-weight: 800; color: white; border: none;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
    transition: all 0.2s;
  }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; opacity: 0; pointer-events: none; transform: translateY(10px); }
  .submit-btn:active:not(:disabled) { transform: scale(0.98); }
`;

// --- 4. 工具函数 (不变) ---
const isChineseChar = (char) => /\p{Script=Han}/u.test(char);
const generateTextData = (text) => {
  if (!text) return [];
  const cleanText = text.replace(/[【】“”"'()]/g, '');
  try {
    const pinyins = pinyin(cleanText, { type: 'array', toneType: 'symbol' });
    const chars = cleanText.split('');
    let pyIndex = 0;
    return chars.map((char) => ({
      char,
      pinyin: isChineseChar(char) ? pinyins[pyIndex++] || '' : '',
    }));
  } catch (e) {
    return cleanText.split('').map(c => ({ char: c, pinyin: '' }));
  }
};


// --- 5. ✅ 全面更新的 React 组件 ---
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionData, setQuestionData] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    audioController.stop();
    
    // ✅ 统一使用 generateTextData 处理
    setQuestionData(generateTextData(question.text));

    const processed = options.map(opt => {
      const lang = audioController.detectLanguage(opt.text);
      return {
        ...opt,
        // ✅ 只为中文生成拼音数据
        textData: lang === 'zh' ? generateTextData(opt.text) : [],
        lang: lang,
        hasImage: !!opt.imageUrl
      };
    });

    setOrderedOptions(processed);

    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, 0.9).finally(() => setIsPlaying(false));
    }

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    return () => audioController.stop();
  }, [question, options]);

  // ✅ 选中选项的处理函数
  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    audioController.play(option.text, 0.9);
    // ✅ 新增：选中震动反馈
    if (navigator.vibrate) {
      navigator.vibrate(50); // 50ms 的短促震动
    }
  };

  // ✅ 提交答案的处理函数
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // 错误的震动模式
      
      if (explanation) {
        setShowExplanation(true);
        setTimeout(() => audioController.play(explanation, 0.9), 500);
      }

      if (onIncorrect) {
        setTimeout(() => {
            onIncorrect(question);
        }, 3000);
      }
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    audioController.play(question.text, 0.9).finally(() => setIsPlaying(false));
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        {/* ✅ 修改：使用新的标题区域样式 */}
        <div className="xzt-question-area" onClick={handleReadQuestion}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp size={22} className={isPlaying ? 'icon-pulse' : ''} />
          </div>
          <div className="pinyin-box">
            {questionData.map((item, idx) => (
              <div key={idx} className="char-block">
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xzt-options-grid">
          {orderedOptions.map(option => {
            let statusClass = '';
            const isSelected = String(option.id) === String(selectedId);
            const isCorrectAnswer = correctAnswer.map(String).includes(String(option.id));

            if (isSubmitted) {
              if (isCorrectAnswer) statusClass = 'correct'; 
              else if (isSelected) statusClass = 'incorrect';
            } else if (isSelected) {
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
                    <img src={option.imageUrl} alt="Option" className="opt-img" />
                  </div>
                )}
                <div className="opt-text-box">
                  {/* ✅ 优化：根据语言选择渲染方式 */}
                  {option.lang === 'zh' ? (
                    <>
                      <div className="opt-pinyin">{option.textData.map(d => d.pinyin).join(' ')}</div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className={option.lang === 'my' ? 'opt-my' : 'opt-en'}>{option.text}</div>
                  )}
                </div>
                {isSubmitted && isCorrectAnswer && <FaCheckCircle className="text-green-500 absolute right-4 top-1/2 -translate-y-1/2 text-2xl"/>}
                {isSubmitted && isSelected && !isCorrectAnswer && <FaTimesCircle className="text-red-500 absolute right-4 top-1/2 -translate-y-1/2 text-2xl"/>}
              </div>
            );
          })}
        </div>
        
        {/* ✅ 修改：使用新的底部固定区域样式 */}
        <div className="fixed-bottom-area">
           <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || isSubmitted}>
            确认
          </button>
          {showExplanation && explanation && (
            <div className="explanation-card">
               <FaLightbulb className="flex-shrink-0 mt-1 text-red-400" />
               <div>{explanation}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
