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

// --- 2. 增强版音频控制器 (支持中/缅语 + 预加载) ---
const audioController = {
  currentAudio: null,
  latestRequestId: 0,

  // 用于组件卸载等场景的强制停止
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.latestRequestId++; // 使所有正在进行的请求失效
  },

  isBurmese(text) {
    return /[\u1000-\u109F]/.test(text);
  },

  // ✅ 修复：修正了朗读逻辑，恢复正常播放
  async play(text, rate = 1.0) {
    if (!text || !text.trim()) return;

    // 1. 为本次播放请求生成唯一ID
    const myRequestId = ++this.latestRequestId;

    // 2. 如果有正在播放的音频，先停止它
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    // 3. 根据语言过滤文本（仅用于TTS，不影响显示）
    const isMy = this.isBurmese(text);
    // 移除符号，避免TTS读出奇怪的标点
    const textToRead = isMy ? text : text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
    if (!textToRead.trim()) return;

    const lang = isMy ? 'my-MM' : 'zh-CN';
    const voice = isMy ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-${lang}-${textToRead}-${rate}`;
    let audioUrl;

    try {
      // 检查请求是否已过时
      if (myRequestId !== this.latestRequestId) return;

      const cachedBlob = await idb.get(cacheKey);

      // 在异步操作后再次检查，防止旧请求播放
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
        if (audioUrl && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
        }
      };
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  },

  async preload(text) {
    if (!text || !text.trim()) return;
    const isMy = this.isBurmese(text);
    const textToRead = isMy ? text : text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
    if (!textToRead.trim()) return;
    const lang = isMy ? 'my-MM' : 'zh-CN';
    const voice = isMy ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-${lang}-${textToRead}-1.0`;
    try {
      const cachedBlob = await idb.get(cacheKey);
      if (cachedBlob) return;
      const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${voice}&r=0`;
      const res = await fetch(apiUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      await idb.set(cacheKey, blob);
    } catch (e) {
      console.error("Audio preload error:", e);
    }
  }
};


export const preloadNextLessonAudios = (texts = []) => {
    if (!Array.isArray(texts)) return;
    Promise.allSettled(texts.map(text => audioController.preload(text)));
};


// --- 样式定义 ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&display=swap');
  .xzt-container { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; position: relative; padding: 0 16px; overflow-y: auto; }
  .spacer { flex: 1; min-height: 5px; max-height: 30px; }
  .xzt-question-title { padding: 16px; text-align: center; cursor: pointer; width: 100%; max-width: 480px; margin: 0 auto 10px auto; display: flex; flex-direction: column; align-items: center; position: relative; border-radius: 20px; transition: background-color 0.2s; }
  .xzt-question-title:active { background-color: #f9fafb; }
  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 16px; margin-bottom: 20px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; row-gap: 8px; align-items: flex-end; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; height: 1.2em; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.3; }
  .my-text-title { font-family: 'Padauk', sans-serif; font-size: 1.6rem; font-weight: 700; color: #1e293b; line-height: 1.5; }
  .xzt-options-grid { display: grid; grid-template-columns: 1fr; gap: 12px; width: 100%; max-width: 480px; padding-bottom: 140px; }
  .xzt-option-card { position: relative; background: #ffffff; border-radius: 20px; border: 2px solid #f1f5f9; box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden; }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }
  .layout-text-only { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; min-height: 64px; }
  .layout-with-image { display: flex; flex-direction: row; align-items: center; padding: 16px; min-height: 90px; }
  .opt-img-wrapper { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-right: 16px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  .opt-text-box { display: flex; flex-direction: column; justify-content: center; }
  .layout-text-only .opt-text-box { align-items: center; }
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }
  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-my { font-family: 'Padauk', sans-serif; font-size: 1.3rem; font-weight: 600; color: #334155; }
  .fixed-bottom-area { position: fixed; bottom: 90px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: 60; padding: 0 20px; }
  .explanation-card { background: #fff; border: 1px solid #fecaca; background-color: #fef2f2; color: #b91c1c; padding: 12px 16px; border-radius: 16px; margin-bottom: 12px; font-size: 0.95rem; line-height: 1.4; text-align: left; width: 100%; max-width: 480px; pointer-events: auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out; }
  .submit-btn { pointer-events: auto; min-width: 150px; padding: 14px 30px; border-radius: 100px; font-size: 1.1rem; font-weight: 800; color: white; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4); border: none; transition: all 0.2s; }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: translateY(20px); opacity: 0; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// 工具函数
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);
const isBurmese = (text) => /[\u1000-\u109F]/.test(text);

// ✅ 修复：恢复拼音的音调显示
const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    // 使用 toneType: 'symbol' 来获取带音调的拼音
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      if (isChineseChar(char)) {
        return { char, pinyin: pinyins[pyIndex++] || '' };
      }
      // 对于非中文字符（如【】），正常显示字符，拼音留空
      return { char, pinyin: '' };
    });
  } catch (e) {
    console.error("Pinyin generation error:", e);
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};


const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionData, setQuestionData] = useState({ pinyin: [], isBurmese: false });
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // 组件加载时停止上一题可能在播放的音频
    audioController.stop();

    const qIsBurmese = isBurmese(question.text);
    setQuestionData({
        pinyin: qIsBurmese ? [] : generatePinyinData(question.text),
        isBurmese: qIsBurmese
    });
    
    const processed = options.map(opt => {
      const optIsBurmese = isBurmese(opt.text);
      const optIsChinese = !optIsBurmese && /[\u4e00-\u9fa5]/.test(opt.text);
      return {
        ...opt,
        pinyinData: optIsChinese ? generatePinyinData(opt.text) : [],
        isChinese: optIsChinese,
        isBurmese: optIsBurmese,
        hasImage: !!opt.imageUrl
      };
    });

    setShuffledOptions([...processed].sort(() => Math.random() - 0.5));

    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, 0.9).finally(() => setIsPlaying(false));
    }

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    // 组件卸载时确保停止所有音频
    return () => audioController.stop();
  }, [question, options]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    if (showExplanation) setShowExplanation(false);
    // ✅ 修复：现在可以正常朗读选项了
    if (option.text) audioController.play(option.text, 0.95);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      
      if (explanation) {
        setShowExplanation(true);
        setTimeout(() => audioController.play(explanation, 0.9), 800);
      }
      
      setTimeout(() => setIsSubmitted(false), 1500);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    // ✅ 修复：现在可以正常朗读题目了
    audioController.play(question.text, 0.9).finally(() => setIsPlaying(false));
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        <div className="spacer" />
        <div className="xzt-question-title" onClick={handleReadQuestion}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp size={20} className={isPlaying ? 'icon-pulse' : ''} />
          </div>
          {questionData.isBurmese ? (
            <div className="my-text-title">{question.text}</div>
          ) : (
            <div className="pinyin-box">
              {questionData.pinyin.map((item, idx) => (
                <div key={idx} className="char-block">
                  <span className="py-text">{item.pinyin || ' '}</span>
                  <span className="cn-text">{item.char}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="spacer" />
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
              <div key={option.id} className={`xzt-option-card ${layoutClass} ${statusClass}`} onClick={() => handleSelect(option)}>
                {option.hasImage && <div className="opt-img-wrapper"><img src={option.imageUrl} alt="option" className="opt-img" /></div>}
                <div className="opt-text-box">
                  {option.isChinese ? (
                    <><div className="opt-pinyin">{option.pinyinData.map(d => d.pinyin).join(' ')}</div><div className="opt-cn">{option.text}</div></>
                  ) : option.isBurmese ? (
                    <div className="opt-my">{option.text}</div>
                  ) : (
                    <div className="opt-en">{option.text}</div>
                  )}
                </div>
                {isSubmitted && correctIds.includes(optIdStr) && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && optIdStr === selIdStr && !correctIds.includes(optIdStr) && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
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
          <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || (isSubmitted && !showExplanation)}>
            {isSubmitted ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "再试一次") : "确认"}
          </button>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
