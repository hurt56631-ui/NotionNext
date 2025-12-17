import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 (保持核心逻辑不变) ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(); return; }
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
    if (typeof window === 'undefined') return null;
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const res = req.result;
        resolve((res && res.size > 0) ? res : null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (typeof window === 'undefined') return;
    await this.init();
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(blob, key);
    });
  }
};

// --- 2. 音频控制器 (保持不变) ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [],
  latestRequestId: 0,
  _pendingFetches: [],

  stop() {
    if (typeof window === 'undefined') return;
    this.latestRequestId++;
    this._pendingFetches.forEach(ctrl => { try { ctrl.abort(); } catch (e) {} });
    this._pendingFetches = [];
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    this.playlist = [];
    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (e) {} });
      this.activeBlobUrls = [];
    }
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang) {
    if (typeof window === 'undefined') return null;
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-${voice}-${text}-0`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
    const controller = new AbortController();
    this._pendingFetches.push(controller);
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`TTS Fetch failed`);
      const blob = await res.blob();
      if (blob.size === 0) return null;
      await idb.set(cacheKey, blob);
      return blob;
    } catch (e) {
        return null;
    } finally {
      this._pendingFetches = this._pendingFetches.filter(c => c !== controller);
    }
  },

  async playMixed(text, onStart, onEnd) {
    if (typeof window === 'undefined') return;
    this.stop();
    if (!text) { if (onEnd) onEnd(); return; }
    const reqId = ++this.latestRequestId;
    if (onStart) onStart();

    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim();
      if (segmentText && /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText)) {
        segments.push({ text: segmentText, lang: this.detectLanguage(segmentText) });
      }
    }

    if (segments.length === 0) { if (onEnd) onEnd(); return; }

    try {
      const blobs = await Promise.all(segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang)));
      if (reqId !== this.latestRequestId) return;

      const validBlobs = [];
      const validSegments = [];
      blobs.forEach((b, i) => { if (b) { validBlobs.push(b); validSegments.push(segments[i]); } });

      if (validBlobs.length === 0) { if (onEnd) onEnd(); return; }

      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);
        const audio = new Audio(url);
        audio.playbackRate = validSegments[index].lang === 'zh' ? 0.7 : 1.0;
        return audio;
      });

      this.playlist = audioObjects;

      const playNext = (index) => {
        if (reqId !== this.latestRequestId) return;
        if (index >= audioObjects.length) {
          this.currentAudio = null;
          if (onEnd) onEnd();
          return;
        }
        const audio = audioObjects[index];
        this.currentAudio = audio;
        audio.onended = () => playNext(index + 1);
        audio.onerror = () => playNext(index + 1);
        audio.play().catch(() => {
            this.stop();
            if (onEnd) onEnd();
        });
      };
      playNext(0);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }
};


// --- 3. 样式定义 (美化版) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

  :root {
    --primary-color: #6366f1; /* Indigo 500 */
    --primary-dark: #4f46e5;
    --success-color: #10b981; /* Emerald 500 */
    --error-color: #ef4444; /* Red 500 */
    --bg-color: #f8fafc;
    --text-main: #1e293b;
    --text-sub: #64748b;
  }

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: var(--bg-color);
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }

  /* 滚动区域 */
  .xzt-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px 20px 180px 20px; /* 底部留白给固定区域 */
    display: flex; flex-direction: column; align-items: center;
    scrollbar-width: none;
  }
  .xzt-scroll-area::-webkit-scrollbar { display: none; }

  /* 题干朗读按钮 */
  .audio-btn-wrapper {
    display: flex; justify-content: flex-end; width: 100%; max-width: 600px;
    margin-bottom: 10px;
  }
  .book-read-btn {
    width: 44px; height: 44px;
    background: white;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: var(--primary-color);
    font-size: 1.2rem;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
    cursor: pointer; transition: all 0.2s;
    border: 1px solid #e0e7ff;
  }
  .book-read-btn:active { transform: scale(0.95); }
  .book-read-btn.playing { 
    background: var(--primary-color); color: white;
    animation: pulse-ring 2s infinite;
  }

  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  }

  /* 题目区域 */
  .xzt-question-area {
    width: 100%; max-width: 600px;
    background: white;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 4px 20px -5px rgba(0,0,0,0.05);
    margin-bottom: 24px;
    display: flex; flex-direction: column; align-items: center;
  }
  
  .question-img { 
    width: 100%; max-height: 220px; object-fit: contain; 
    border-radius: 12px; margin-bottom: 20px;
  }

  .rich-text-container {
    width: 100%; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end;
    gap: 4px; line-height: 1.6;
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 1px; }
  .pinyin-top { font-size: 0.8rem; color: var(--text-sub); margin-bottom: -2px; font-weight: 500; }
  .cn-char { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
  .other-text-block { font-size: 1.3rem; font-weight: 600; color: var(--text-main); margin: 0 4px; transform: translateY(-3px); }

  /* 选项区域 */
  .xzt-options-grid { 
    width: 100%; max-width: 600px;
    display: grid; gap: 12px;
  }
  
  .xzt-option-card {
    position: relative;
    background: white;
    border-radius: 16px;
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    cursor: pointer;
    padding: 16px;
    display: flex; align-items: center;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  
  .xzt-option-card:not(.disabled):active { transform: scale(0.98); background: #f1f5f9; }
  .xzt-option-card.selected { border-color: var(--primary-color); background: #eef2ff; }
  
  /* 提交后的状态颜色 */
  .xzt-option-card.correct-answer { border-color: var(--success-color); background: #ecfdf5; }
  .xzt-option-card.wrong-answer { border-color: var(--error-color); background: #fef2f2; opacity: 0.8; }
  .xzt-option-card.disabled { pointer-events: none; }

  .opt-img {
    width: 56px; height: 56px; border-radius: 10px;
    object-fit: cover; margin-right: 16px; flex-shrink: 0;
    background-color: #f1f5f9; border: 1px solid #e2e8f0;
  }

  .opt-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .opt-py { font-size: 0.85rem; color: var(--text-sub); margin-bottom: 2px; }
  .opt-txt { font-size: 1.1rem; font-weight: 600; color: var(--text-main); }
  
  .status-icon { font-size: 1.4rem; margin-left: 12px; }
  .text-green { color: var(--success-color); }
  .text-red { color: var(--error-color); }

  /* 底部固定操作栏 (提交前) */
  .bottom-submit-area {
    position: fixed; bottom: 30px; left: 0; right: 0;
    display: flex; justify-content: center;
    pointer-events: none; z-index: 50;
  }
  .submit-btn {
    pointer-events: auto;
    background: var(--primary-color);
    color: white; border: none;
    padding: 16px 60px;
    border-radius: 99px;
    font-size: 1.1rem; font-weight: 700;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
    transition: transform 0.2s;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; }
  .submit-btn:active { transform: scale(0.95); }

  /* 底部解析面板 (提交后) - 核心修改 */
  .explanation-sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white;
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
    z-index: 100;
    transform: translateY(110%);
    transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    padding: 24px 24px 40px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .explanation-sheet.show { transform: translateY(0); }

  .sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .result-title { font-size: 1.4rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .result-title.correct { color: var(--success-color); }
  .result-title.wrong { color: var(--error-color); }

  .explanation-box {
    background: #f8fafc;
    border-radius: 12px;
    padding: 16px;
    border-left: 4px solid var(--primary-color);
  }
  .exp-label { font-size: 0.9rem; font-weight: 700; color: var(--text-sub); margin-bottom: 4px; display:flex; align-items:center; gap:6px;}
  .exp-text { font-size: 1rem; color: var(--text-main); line-height: 1.6; }

  .next-btn {
    width: 100%;
    background: var(--text-main);
    color: white; border: none;
    padding: 18px;
    border-radius: 16px;
    font-size: 1.1rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-top: 10px;
    cursor: pointer;
  }
  .next-btn:active { transform: scale(0.98); opacity: 0.9; }
  /* 正确时按钮绿色，错误时保持深色或根据需求调整 */
  .next-btn.is-correct { background: var(--success-color); box-shadow: 0 8px 20px -4px rgba(16, 185, 129, 0.4); }
  
`;


// --- 4. 文本解析逻辑 (保持不变) ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      segment.split('').forEach((char, i) => {
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
const XuanZeTi = (props) => {
  // 数据解构与容错处理
  const rawData = props.data || props;
  const rawQuestion = props.question || rawData.question || {};
  const rawOptions = props.options || rawData.options || [];
  const rawCorrectAnswer = props.correctAnswer || rawData.correctAnswer || [];
  const explanationText = props.explanation || rawData.explanation || ""; // 新增解析字段

  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = typeof rawQuestion === 'object' ? rawQuestion.imageUrl : null;
  
  const { onCorrect, onIncorrect, onNext } = props;

  // 状态管理
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mountedRef = useRef(true);
  const hasAutoPlayedRef = useRef(false);

  // 初始化
  useEffect(() => {
    mountedRef.current = true;
    
    // 重置状态
    audioController.stop();
    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setIsRight(false);
    hasAutoPlayedRef.current = false;

    // 解析数据
    setTitleSegments(parseTitleText(questionText));
    setOrderedOptions(rawOptions.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动播放
    if (questionText) {
      setTimeout(() => {
        if (mountedRef.current && !hasAutoPlayedRef.current) {
          handleTitlePlay(null, true);
          hasAutoPlayedRef.current = true;
        }
      }, 600);
    }

    return () => { mountedRef.current = false; audioController.stop(); };
  }, [questionText, rawOptions]); 

  // 播放处理
  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    if (!isAuto && navigator.vibrate) navigator.vibrate(40);

    audioController.playMixed(
      questionText,
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  // 选项点击
  const handleCardClick = (option) => {
    if (isSubmitted) return; // 提交后禁止更改
    setSelectedId(option.id);
    audioController.playMixed(option.text || '');
  };

  // 提交答案
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    
    const isCorrect = rawCorrectAnswer.map(String).includes(String(selectedId));
    setIsRight(isCorrect);
    setIsSubmitted(true); // 触发底部面板动画
    audioController.stop();

    // 播放音效
    if (isCorrect) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 }, colors: ['#10b981', '#34d399'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  // 进入下一题 (修复了无法跳转的Bug)
  const handleNext = () => {
    // 1. 先处理积分逻辑
    if (isRight) {
      if (onCorrect) onCorrect();
    } else {
      if (onIncorrect) onIncorrect();
    }

    // 2. 强制执行跳转
    if (onNext) {
      onNext();
    } else {
      console.warn("未提供 onNext 回调，无法跳转");
    }
  };

  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container">
        
        {/* 可滚动区域 */}
        <div className="xzt-scroll-area">
          
          <div className="audio-btn-wrapper">
            <div 
              className={`book-read-btn ${isPlaying ? 'playing' : ''}`} 
              onClick={(e) => handleTitlePlay(e, false)}
            >
              <FaVolumeUp />
            </div>
          </div>

          <div className="xzt-question-area">
            {questionImage && (
              <img src={questionImage} alt="Question" className="question-img" />
            )}

            <div className="rich-text-container">
              {titleSegments.map((seg, i) => (
                seg.type === 'zh' ? (
                  <div key={i} className="cn-block">
                    <span className="pinyin-top">{seg.pinyin}</span>
                    <span className="cn-char">{seg.char}</span>
                  </div>
                ) : (
                  <span key={i} className="other-text-block">{seg.text}</span>
                )
              ))}
            </div>
          </div>

          <div className="xzt-options-grid">
            {orderedOptions.map(opt => {
              const isSel = String(opt.id) === String(selectedId);
              const isCorrectOpt = rawCorrectAnswer.map(String).includes(String(opt.id));
              
              let cardClass = "";
              if (isSubmitted) {
                cardClass = "disabled ";
                if (isCorrectOpt) cardClass += "correct-answer";
                else if (isSel) cardClass += "wrong-answer";
              } else if (isSel) {
                cardClass = "selected";
              }

              return (
                <div 
                  key={opt.id} 
                  className={`xzt-option-card ${cardClass}`} 
                  onClick={() => handleCardClick(opt)}
                >
                  {opt.hasImage && <img src={opt.imageUrl} alt="" className="opt-img" />}
                  
                  <div className="opt-content">
                    {opt.parsed.isZh ? (
                      <>
                        <div className="opt-py">{opt.parsed.pinyins}</div>
                        <div className="opt-txt">{opt.text}</div>
                      </>
                    ) : (
                      <div className="opt-txt">{opt.text}</div>
                    )}
                  </div>
                  
                  {isSubmitted && isCorrectOpt && <FaCheck className="status-icon text-green" />}
                  {isSubmitted && isSel && !isCorrectOpt && <FaTimes className="status-icon text-red" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部按钮 (未提交时显示) */}
        {!isSubmitted && (
          <div className="bottom-submit-area">
            <button 
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!selectedId}
            >
              တင်သွင်းသည်
            </button>
          </div>
        )}

        {/* 底部解析面板 (提交后滑出，覆盖底部内容) */}
        <div className={`explanation-sheet ${isSubmitted ? 'show' : ''}`}>
          <div className="sheet-header">
            <div className={`result-title ${isRight ? 'correct' : 'wrong'}`}>
              {isRight ? <FaCheck /> : <FaTimes />}
              <span>{isRight ? 'မှန်ပါတယ်' : 'မှားပါတယ်'}</span>
            </div>
          </div>

          {/* 如果有解析文本，显示解析框 */}
          {explanationText && (
            <div className="explanation-box">
              <div className="exp-label"><FaLightbulb /> ရှင်းလင်းချက်</div>
              <div className="exp-text">{explanationText}</div>
            </div>
          )}

          <button 
            className={`next-btn ${isRight ? 'is-correct' : ''}`}
            onClick={handleNext}
          >
            နောက်တစ်ပုဒ် <FaArrowRight />
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
