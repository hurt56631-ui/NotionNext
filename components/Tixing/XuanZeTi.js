import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存封装 (无变动) ---
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

// --- 2. ✅ 升级版: 多语言音频控制器 ---
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

  // ✅ 新增：语言检测
  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) { // 缅甸语 Unicode 范围
      return 'my'; // Burmese
    }
    return 'zh'; // Default to Chinese
  },

  async play(text, rate = 1.0) {
    this.stop();
    if (!text) return;

    // ✅ 过滤所有不适合朗读的符号
    const textToRead = text.replace(/[^\p{L}\p{N}\s]/gu, '');
    if (!textToRead.trim()) return;

    const myRequestId = ++this.latestRequestId;

    const lang = this.detectLanguage(textToRead);
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';

    // ✅ 缓存键加入 voice，确保不同语言的音频分开缓存
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


// --- 3. 样式定义 ---
const cssStyles = `
  /* ✅ 新增: 缅语字体支持 和 禁止下拉刷新 */
  .xzt-container {
    font-family: "Noto Sans Myanmar", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 0 16px;
    overflow-y: auto;
    overscroll-behavior-y: contain; /* 禁止下拉刷新 */
  }

  .spacer { flex: 1; min-height: 5px; max-height: 30px; }

  .xzt-question-card {
    background: #ffffff; border-radius: 28px; padding: 24px; text-align: center;
    box-shadow: 0 10px 40px -10px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(243, 244, 246, 1);
    cursor: pointer; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    width: 100%; max-width: 480px; margin: 0 auto 10px auto;
    display: flex; flex-direction: column; align-items: center; position: relative;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 16px; margin-bottom: 20px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }

  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; row-gap: 8px; align-items: flex-end; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.3; }

  .xzt-options-grid { display: grid; grid-template-columns: 1fr; gap: 12px; width: 100%; max-width: 480px; padding-bottom: 140px; }
  .xzt-option-card {
    position: relative; background: #ffffff; border-radius: 20px; border: 2px solid #f1f5f9;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  .layout-text-only { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; min-height: 64px; }
  .layout-with-image { display: flex; align-items: center; padding: 16px; min-height: 90px; }
  .opt-img-wrapper { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-right: 16px; flex-shrink: 0; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  .opt-text-box { display: flex; flex-direction: column; justify-content: center; }
  .layout-text-only .opt-text-box { align-items: center; }
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }
  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-en { font-size: 1.1rem; font-weight: 600; color: #475569; }

  .fixed-bottom-area {
    position: fixed; bottom: 20px; left: 0; right: 0; display: flex; flex-direction: column;
    align-items: center; pointer-events: none; z-index: 60; padding: 0 20px;
  }
  .explanation-card {
    background: #fff; border: 1px solid #fecaca; background-color: #fef2f2; color: #b91c1c; padding: 12px 16px;
    border-radius: 16px; margin-bottom: 12px; font-size: 0.95rem; line-height: 1.4; text-align: left;
    width: 100%; max-width: 480px; pointer-events: auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
    display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out;
  }
  .submit-btn {
    pointer-events: auto; min-width: 150px; padding: 14px 30px; border-radius: 100px;
    font-size: 1.1rem; font-weight: 800; color: white; border: none;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
    transition: all 0.2s;
  }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; opacity: 0; pointer-events: none; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// --- 4. 工具函数 ---
const isChineseChar = (char) => /\p{Script=Han}/u.test(char);
const generatePinyinData = (text) => {
  if (!text) return [];
  // ✅ 过滤符号，让拼音更干净
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

// --- 5. React 组件 ---
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    audioController.stop();
    setQuestionPinyin(generatePinyinData(question.text));

    const processed = options.map(opt => ({
      ...opt,
      pinyinData: generatePinyinData(opt.text),
      isChinese: /[\u4e00-\u9fa5]/.test(opt.text),
      hasImage: !!opt.imageUrl
    }));

    // ✅ 不再打乱顺序
    setOrderedOptions(processed);

    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, 0.9).then(() => setIsPlaying(false));
    }

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    return () => audioController.stop();
  }, [question, options]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    audioController.play(option.text, 0.9);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      // ✅ 答对后 1.5 秒自动进入下一题
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      
      if (explanation) {
        setShowExplanation(true);
        setTimeout(() => audioController.play(explanation, 0.9), 500);
      }

      // ✅ 答错后 3 秒自动进入下一题，并触发错题回调
      if (onIncorrect) {
        setTimeout(() => {
            onIncorrect(question); // 将错题信息传回父组件
        }, 3000); // 留出充足时间看解析
      }
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    audioController.play(question.text, 0.9).then(() => setIsPlaying(false));
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        <div className="spacer" />

        <div className="xzt-question-card" onClick={handleReadQuestion}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp size={20} className={isPlaying ? 'icon-pulse' : ''} />
          </div>
          <div className="pinyin-box">
            {questionPinyin.map((item, idx) => (
              <div key={idx} className="char-block">
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />

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
                  {option.isChinese ? (
                    <>
                      <div className="opt-pinyin">{option.pinyinData.map(d => d.pinyin).join(' ')}</div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className="opt-en">{option.text}</div>
                  )}
                </div>
                {isSubmitted && isCorrectAnswer && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && isSelected && !isCorrectAnswer && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area">
          {showExplanation && explanation && (
            <div className="explanation-card">
               <FaLightbulb className="flex-shrink-0 mt-1" />
               <div>{explanation}</div>
            </div>
          )}
          <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || isSubmitted}>
            确认
          </button>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
