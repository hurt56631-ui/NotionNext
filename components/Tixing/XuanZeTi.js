import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 (保持不变) ---
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
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
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

// --- 2. 音频控制器 (混合朗读) ---
const audioController = {
  currentAudio: null,
  playlist: [],
  latestRequestId: 0,

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.playlist = [];
    this.latestRequestId++;
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang, rate) {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-${voice}-${text}-${rate}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate > 1 ? 20 : 0}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('TTS Fetch failed');
    const blob = await res.blob();
    await idb.set(cacheKey, blob);
    return blob;
  },

  async playMixed(text, rate = 1.0) {
    this.stop();
    if (!text) return;
    const reqId = ++this.latestRequestId;

    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].trim()) {
        segments.push({
          text: match[0],
          lang: this.detectLanguage(match[0])
        });
      }
    }

    if (segments.length === 0) return;

    try {
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang, rate))
      );
      if (reqId !== this.latestRequestId) return;

      const audioObjects = blobs.map(blob => new Audio(URL.createObjectURL(blob)));
      this.playlist = audioObjects;

      const playNext = (index) => {
        if (reqId !== this.latestRequestId || index >= audioObjects.length) {
            this.currentAudio = null;
            return;
        }
        const audio = audioObjects[index];
        this.currentAudio = audio;
        audio.onended = () => playNext(index + 1);
        audio.play().catch(e => console.error(e));
      };
      playNext(0);
    } catch (e) {
      console.error(e);
    }
  }
};

// --- 3. 样式定义 (已按要求调整) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    /* ✅ 修改：左右内边距增加到 32px，让卡片看起来更短（两边留白更多） */
    padding: 10px 32px 160px 32px; 
    overflow-y: auto;
    background-color: #fff;
  }

  /* 标题区域 */
  .xzt-question-area {
    width: 100%;
    max-width: 500px;
    margin: 10px auto 20px auto;
    text-align: center;
    cursor: pointer;
    position: relative;
  }
  
  .question-img { 
    width: 100%; max-height: 200px; object-fit: contain; 
    border-radius: 12px; background-color: #f8fafc; margin-bottom: 12px; 
  }

  .title-text-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 4px;
    line-height: 1.6;
  }

  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 1px; }
  .pinyin-top { font-size: 0.85rem; color: #94a3b8; font-family: monospace; height: 1.2em; }
  .cn-char { font-size: 1.6rem; font-weight: 600; color: #1e293b; }
  .other-text-block { font-size: 1.5rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; }

  /* 选项列表 */
  .xzt-options-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    max-width: 500px;
  }

  .xzt-option-card {
    position: relative; background: #fff; border-radius: 18px; border: 2px solid #f1f5f9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center; /* 内容居中 */
    padding: 14px 16px;
    min-height: 68px;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  /* ✅ 修改：选项文字居中 */
  .opt-content { 
    flex: 1; 
    text-align: center; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
  }
  
  .opt-py { font-size: 0.85rem; color: #94a3b8; line-height: 1; margin-bottom: 4px; font-family: monospace; }
  .opt-txt { font-size: 1.2rem; font-weight: 600; color: #334155; }
  
  /* ✅ 修改：底部固定区域，bottom 增加到 85px (约2cm + 安全区) */
  .fixed-bottom-area {
    position: fixed;
    bottom: 85px; 
    left: 0; right: 0;
    display: flex;
    flex-direction: column-reverse; /* 解析在按钮上方 */
    align-items: center;
    pointer-events: none;
    z-index: 100;
    gap: 20px;
  }

  /* 提交按钮 */
  .submit-btn {
    pointer-events: auto;
    width: auto;
    min-width: 160px; /* 稍微宽一点点 */
    padding: 14px 40px;
    border-radius: 99px;
    font-size: 1.15rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
    transition: all 0.2s;
  }
  .submit-btn:active { transform: scale(0.95); }
  .submit-btn:disabled { opacity: 0; transform: translateY(20px); pointer-events: none; }

  /* 解析卡片 */
  .explanation-card {
    pointer-events: auto;
    background: #fff1f2; color: #be123c;
    border: 1px solid #fecaca;
    padding: 14px 20px; 
    border-radius: 16px;
    width: 85%; max-width: 420px;
    font-size: 1rem;
    line-height: 1.5;
    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    animation: slideUp 0.3s ease-out;
    display: flex; gap: 10px; align-items: flex-start;
  }

  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

// --- 4. 文本解析逻辑 ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      const chars = segment.split('');
      chars.forEach((char, i) => {
        result.push({ type: 'zh', char, pinyin: pinyins[i] || '' });
      });
    } else {
      result.push({ type: 'other', text: segment });
    }
  }
  return result;
};

const parseOptionText = (text) => {
  const isZh = /[\u4e00-\u9fa5]/.test(text);
  if (!isZh) return { isZh: false, text };
  const pinyins = pinyin(text, { type: 'array', toneType: 'symbol', nonZh: 'consecutive' });
  return { isZh: true, text, pinyins: pinyins.join(' ') };
};

// --- 5. 组件主体 ---
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);

  useEffect(() => {
    audioController.stop();
    setTitleSegments(parseTitleText(question.text));
    setOrderedOptions(options.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    if (question.text) audioController.playMixed(question.text);
  }, [question, options]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    if (navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      // --- 答对 ---
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      setTimeout(() => onCorrect && onCorrect(), 1500);
    } else {
      // --- 答错 ---
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      
      // ✅ 关键逻辑修改：判断是否有解析
      if (explanation && explanation.trim() !== '') {
        // 有解析：显示卡片，播放音频，延迟较长
        setShowExplanation(true);
        setTimeout(() => audioController.playMixed(explanation), 600);
        
        // 估算阅读时间，至少 3 秒
        const waitTime = Math.max(3000, explanation.length * 300);
        setTimeout(() => {
           onIncorrect && onIncorrect(question);
        }, waitTime);
      } else {
        // ✅ 无解析：不显示卡片，1.2秒后自动下一题
        setShowExplanation(false);
        setTimeout(() => {
           onIncorrect && onIncorrect(question);
        }, 1200);
      }
    }
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        <div className="xzt-question-area" onClick={() => audioController.playMixed(question.text)}>
          {question.imageUrl && <img src={question.imageUrl} alt="" className="question-img" />}
          
          <div className="title-text-container">
            {titleSegments.map((seg, i) => {
              if (seg.type === 'zh') {
                return (
                  <div key={i} className="cn-block">
                    <span className="pinyin-top">{seg.pinyin}</span>
                    <span className="cn-char">{seg.char}</span>
                  </div>
                );
              } else {
                return <span key={i} className="other-text-block">{seg.text}</span>;
              }
            })}
             <FaVolumeUp className="text-purple-400 ml-2 mb-1" size={20} />
          </div>
        </div>

        <div className="xzt-options-grid">
          {orderedOptions.map(opt => {
            let status = '';
            const isSel = String(opt.id) === String(selectedId);
            const isRight = correctAnswer.map(String).includes(String(opt.id));
            if (isSubmitted) {
              if (isRight) status = 'correct';
              else if (isSel) status = 'incorrect';
            } else if (isSel) status = 'selected';

            return (
              <div key={opt.id} className={`xzt-option-card ${status}`} onClick={() => handleSelect(opt)}>
                {opt.hasImage && <img src={opt.imageUrl} className="w-12 h-12 rounded mr-3 object-cover bg-gray-100" />}
                <div className="opt-content">
                  {opt.parsed.isZh ? (
                    <>
                      <div className="opt-py">{opt.parsed.pinyins}</div>
                      <div className="opt-txt">{opt.text}</div>
                    </>
                  ) : (
                    <div className="opt-txt font-medium">{opt.text}</div>
                  )}
                </div>
                {status === 'correct' && <FaCheckCircle className="text-green-500 text-xl absolute right-4" />}
                {status === 'incorrect' && <FaTimesCircle className="text-red-500 text-xl absolute right-4" />}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area">
          <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || isSubmitted}>
            提 交
          </button>

          {showExplanation && explanation && (
            <div className="explanation-card">
              <FaLightbulb className="flex-shrink-0 mt-1 text-red-500" />
              <div>{explanation}</div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
