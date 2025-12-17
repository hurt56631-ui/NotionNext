import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaBookOpen, FaArrowRight } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 (保持不变) ---
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
        if (res && typeof res.size === 'number' && res.size > 0) resolve(res);
        else resolve(null);
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
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    this.playlist.forEach(a => {
      try { a.onended = null; a.onerror = null; a.pause(); a.src = ''; } catch (e) {}
    });
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
    const rateParam = 0;
    const cacheKey = `tts-${voice}-${text}-${rateParam}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;
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
        if (e.name !== 'AbortError') console.warn(e);
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
        audio.preload = 'auto';
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
        audio.play().catch(e => {
            console.error(e);
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


// --- 3. 样式定义 (保持不变) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;600;700&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; 
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 24px 220px 24px; 
    overflow-y: auto;
    background-color: #fcfcfc;
    -webkit-tap-highlight-color: transparent;
    scrollbar-width: none; 
  }
  .xzt-container::-webkit-scrollbar { display: none; }

  .book-read-btn {
    width: 50px; height: 50px;
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 1.4rem;
    margin-bottom: 20px;
    box-shadow: 0 8px 15px -3px rgba(124, 58, 237, 0.4);
    cursor: pointer;
    transition: all 0.2s;
    z-index: 110;
    flex-shrink: 0;
  }
  .book-read-btn:active { transform: scale(0.9); }
  .book-read-btn.playing { animation: pulse-purple 2s infinite; background: #7c3aed; }

  @keyframes pulse-purple {
    0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7); }
    70% { box-shadow: 0 0 0 15px rgba(124, 58, 237, 0); }
    100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  }

  .xzt-question-area {
    width: 100%; max-width: 500px; margin: 0 auto 32px auto; 
    display: flex; flex-direction: column; align-items: center;
    flex-shrink: 0;
    z-index: 10;
  }
  
  .question-img { 
    width: auto; max-width: 100%; max-height: 200px; 
    object-fit: contain; 
    border-radius: 12px; margin-bottom: 20px; 
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);
  }

  .rich-text-container {
    width: 100%; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end;
    gap: 6px; line-height: 1.8; padding: 0 10px;
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
  .pinyin-top { font-size: 0.75rem; color: #64748b; font-family: monospace; font-weight: 500; height: 1.4em; }
  .cn-char { font-size: 1.35rem; font-weight: 600; color: #1e293b; font-family: "Noto Sans SC", serif; line-height: 1.2; }
  .other-text-block { font-size: 1.2rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; align-self: flex-end; margin-bottom: 4px; }

  .xzt-options-grid { 
    display: flex; flex-direction: column; gap: 14px; 
    width: 100%; max-width: 400px; 
    padding-bottom: 20px;
    z-index: 15; 
  }
  
  .xzt-option-card {
    position: relative; background: #fff; border-radius: 16px; 
    border: 2px solid #e2e8f0;
    box-shadow: 0 3px 0 #cbd5e1; 
    cursor: pointer; transition: all 0.1s;
    display: flex; align-items: center; justify-content: center;
    padding: 14px 16px; min-height: 64px;
    user-select: none;
  }
  .xzt-option-card:active { transform: translateY(3px); box-shadow: none; background: #f8fafc; }
  
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 3px 0 #ddd6fe; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; box-shadow: 0 3px 0 #bbf7d0; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; box-shadow: 0 3px 0 #fecaca; animation: shake 0.4s; }

  .opt-img {
    width: 48px; height: 48px; border-radius: 8px; 
    object-fit: cover; margin-right: 12px; flex-shrink: 0;
    background-color: #eee;
  }

  .opt-content { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .opt-py { font-size: 0.85rem; color: #94a3b8; line-height: 1; margin-bottom: 2px; font-family: monospace; }
  .opt-txt { font-size: 1.15rem; font-weight: 600; color: #334155; }
  
  .fixed-bottom-area {
    position: fixed; bottom: 8vh; left: 0; right: 0;
    display: flex; justify-content: center;
    pointer-events: none; z-index: 200;
  }

  .bottom-actions-container {
    pointer-events: auto; 
    display: flex; justify-content: center; width: 100%;
  }

  .action-btn {
    width: auto; min-width: 200px; padding: 14px 40px;
    border-radius: 99px; font-size: 1.1rem; font-weight: 700; color: white; border: none;
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    transition: all 0.2s; user-select: none;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .action-btn:active { transform: scale(0.96); }
  
  .submit-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }
  .submit-btn:disabled { background: #cbd5e1; color: #94a3b8; box-shadow: none; opacity: 0.8; }

  .next-btn {
    background: linear-gradient(135deg, #10b981, #059669); /* 绿色系 */
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
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


// --- 5. 组件主体 (核心修改) ---
const XuanZeTi = (props) => {
  // 🔥🔥🔥 核心修复：数据标准化 🔥🔥🔥
  // 1. 尝试从 props.data 中获取，如果不存在则直接用 props
  const rawData = props.data || props;
  
  // 2. 尝试获取 question 和 options，如果不存在则给默认值
  const rawQuestion = props.question || rawData.question || {};
  const rawOptions = props.options || rawData.options || [];
  const rawCorrectAnswer = props.correctAnswer || rawData.correctAnswer || [];

  // 3. 提取题目文本 (兼容旧版 String 和新版 Object)
  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = typeof rawQuestion === 'object' ? rawQuestion.imageUrl : null;
  
  // 4. 事件回调 (直接解构 props，因为这些通常是直接传的)
  const { onCorrect, onIncorrect, onNext } = props;

  // --- 状态 ---
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mountedRef = useRef(true);
  const transitioningRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);

  // --- 手动跳转逻辑 ---
  const handleManualNext = () => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    audioController.stop();

    const isCorrect = rawCorrectAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      try { 
        if (onCorrect) { onCorrect(); } 
        else if (onNext) { onNext(); }
      } catch (e) { console.warn(e); }
    } else {
      try { 
        if (onIncorrect) onIncorrect(rawQuestion);
        if (onNext) onNext();
      } catch (e) { console.warn(e); }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // 重置状态
    audioController.stop();
    transitioningRef.current = false;
    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    hasAutoPlayedRef.current = false;

    // 解析文本：使用处理过的 questionText
    setTitleSegments(parseTitleText(questionText));
    
    // 处理选项
    setOrderedOptions(rawOptions.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动播放题干
    if (questionText) {
      setTimeout(() => {
        if (!mountedRef.current || transitioningRef.current || hasAutoPlayedRef.current) return;
        handleTitlePlay(null, true);
        hasAutoPlayedRef.current = true;
      }, 500);
    }

    return () => { audioController.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText, rawOptions]); // 依赖项改为解析后的文本

  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    if (transitioningRef.current) return;
    if (!isAuto && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);

    audioController.playMixed(
      questionText, // 使用处理过的 questionText
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  const handleCardClick = (option, e) => {
    if (isSubmitted || transitioningRef.current) return;
    if (e) e.stopPropagation();
    setSelectedId(option.id);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text || '');
  };

  const playFeedbackEffects = (isCorrect) => {
    try {
        if (typeof window !== 'undefined') {
            if (isCorrect) {
                confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
                new Audio('/sounds/correct.mp3').play().catch(()=>{});
            } else {
                new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
                if (navigator.vibrate) navigator.vibrate([50,50,50]);
            }
        }
    } catch(e) {}
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted || transitioningRef.current) return;
    setIsSubmitted(true); 
    
    const isCorrect = rawCorrectAnswer.map(String).includes(String(selectedId));
    playFeedbackEffects(isCorrect);
  };

  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container" role="region" aria-label="选择题区域">
        <div 
          className={`book-read-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={(e) => handleTitlePlay(e, false)}
          role="button" title="朗读题干"
        >
          <FaBookOpen />
        </div>

        <div className="xzt-question-area">
          {/* 使用处理过的 questionImage */}
          {questionImage && (
            <img src={questionImage} alt="Question" className="question-img" />
          )}

          <div className="rich-text-container" aria-hidden="false">
            {titleSegments.length > 0 ? titleSegments.map((seg, i) => {
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
            }) : (
               /* 如果解析结果为空，显示一个占位符，方便调试 */
               <div className="text-gray-400 text-sm">暂无题目文本</div>
            )}
          </div>
        </div>

        <div className="xzt-options-grid" role="list">
          {orderedOptions.map(opt => {
            let status = '';
            const isSel = String(opt.id) === String(selectedId);
            const isRight = rawCorrectAnswer.map(String).includes(String(opt.id));
            
            if (isSubmitted) {
              if (isRight) status = 'correct';
              else if (isSel) status = 'incorrect';
            } else if (isSel) {
              status = 'selected';
            }

            return (
              <div 
                key={opt.id} 
                className={`xzt-option-card ${status}`} 
                onClick={(e) => handleCardClick(opt, e)}
                role="button"
              >
                {/* 选项图片支持 */}
                {opt.hasImage && <img src={opt.imageUrl} alt="" className="opt-img" />}
                
                <div className="opt-content">
                  {opt.parsed && opt.parsed.isZh ? (
                    <>
                      <div className="opt-py">{opt.parsed.pinyins}</div>
                      <div className="opt-txt">{opt.text}</div>
                    </>
                  ) : (
                    <div className="opt-txt">{opt.text}</div>
                  )}
                </div>
                {status === 'correct' && <FaCheckCircle style={{position:'absolute', right:12}} className="text-green-500 text-2xl" />}
                {status === 'incorrect' && <FaTimesCircle style={{position:'absolute', right:12}} className="text-red-500 text-2xl" />}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area" aria-hidden="false">
          <div className="bottom-actions-container">
            {!isSubmitted ? (
              <button 
                className="action-btn submit-btn"
                onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                disabled={!selectedId}
              >
                တင်သွင်းသည်
              </button>
            ) : (
              <button 
                className="action-btn next-btn"
                onClick={(e) => { e.stopPropagation(); handleManualNext(); }}
              >
                နောက်တစ်ပုဒ် <FaArrowRight />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
