import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaVolumeUp, FaCheck, FaTimes, FaArrowRight, FaLightbulb } from 'react-icons/fa';
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


// --- 3. 样式定义 (重点修改：气泡、人物、Overlay解析) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

  :root {
    --primary-color: #6366f1;
    --primary-light: #818cf8;
    --primary-dark: #4f46e5;
    --success-color: #10b981;
    --error-color: #ef4444;
    --bg-color: #f1f5f9;
    --text-main: #1e293b;
    --text-sub: #64748b;
    --white: #ffffff;
  }

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    background-color: var(--bg-color);
    overflow: hidden;
  }

  /* 滚动区域 */
  .xzt-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0 160px 0; /* 底部留出空间 */
    display: flex; flex-direction: column; align-items: center;
    scrollbar-width: none;
  }
  .xzt-scroll-area::-webkit-scrollbar { display: none; }

  /* --- 场景区域 (人物 + 气泡) --- */
  .scene-wrapper {
    width: 100%; max-width: 600px;
    padding: 20px 20px 0 20px;
    display: flex;
    align-items: flex-end; /* 底部对齐 */
    justify-content: center;
    margin-bottom: 20px;
    position: relative;
  }

  /* 人物图片 */
  .teacher-img {
    height: 220px; /* 调大人物尺寸 */
    width: auto;
    object-fit: contain;
    margin-right: -10px; /* 稍微重叠一点气泡 */
    z-index: 2;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
  }

  /* 气泡容器 */
  .bubble-container {
    flex: 1;
    background: var(--white);
    border-radius: 24px;
    padding: 20px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    position: relative;
    z-index: 1;
    margin-bottom: 40px; /* 把人物对齐到底部 */
    margin-left: 10px;
    border: 1px solid rgba(255,255,255,0.8);
  }

  /* 尖锐的气泡尾巴 */
  .bubble-tail {
    position: absolute;
    bottom: 30px;
    left: -14px;
    width: 0; 
    height: 0; 
    border-top: 15px solid transparent;
    border-bottom: 15px solid transparent; 
    border-right: 25px solid var(--white); /* 白色三角形 */
    filter: drop-shadow(-4px 0 2px rgba(0,0,0,0.03));
  }

  /* 气泡内的内容布局 */
  .bubble-content {
    display: flex; flex-direction: column; 
  }
  
  .rich-text-container {
    display: flex; flex-wrap: wrap;
    align-items: flex-end;
    gap: 4px; line-height: 1.5;
    margin-bottom: 12px;
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; }
  .pinyin-top { font-size: 0.9rem; color: var(--text-sub); margin-bottom: -4px; font-weight: 500; }
  .cn-char { font-size: 1.6rem; font-weight: 700; color: var(--text-main); }
  .other-text-block { font-size: 1.4rem; font-weight: 600; color: var(--text-main); margin: 0 4px; transform: translateY(-3px); }

  /* 朗读按钮 (气泡内) */
  .bubble-audio-btn {
    align-self: flex-end;
    width: 36px; height: 36px;
    background: #eef2ff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: var(--primary-color);
    cursor: pointer;
    transition: all 0.2s;
  }
  .bubble-audio-btn:active { transform: scale(0.9); background: #e0e7ff; }
  .bubble-audio-btn.playing { background: var(--primary-color); color: white; animation: pulse 1.5s infinite; }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
    70% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  }

  /* 题目图片 (如果题目本身带图) */
  .question-ref-img {
    width: 100%; max-height: 180px; object-fit: cover;
    border-radius: 12px; margin-top: 10px; margin-bottom: 10px;
    border: 1px solid #f1f5f9;
  }

  /* --- 选项区域 --- */
  .xzt-options-grid { 
    width: 100%; max-width: 600px;
    padding: 0 20px;
    display: grid; gap: 14px;
  }
  
  .xzt-option-card {
    position: relative;
    background: white;
    border-radius: 18px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    cursor: pointer;
    padding: 16px;
    display: flex; align-items: center;
    border: 2px solid transparent;
    transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  
  .xzt-option-card:not(.disabled):active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: var(--primary-color); background: #eef2ff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15); }
  
  /* 结果状态 */
  .xzt-option-card.correct-answer { border-color: var(--success-color); background: #ecfdf5; }
  .xzt-option-card.wrong-answer { border-color: var(--error-color); background: #fef2f2; opacity: 0.9; }
  .xzt-option-card.disabled { pointer-events: none; }

  .opt-img {
    width: 60px; height: 60px; border-radius: 12px;
    object-fit: cover; margin-right: 16px; flex-shrink: 0;
    background-color: #f1f5f9;
  }

  .opt-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .opt-py { font-size: 0.85rem; color: var(--text-sub); margin-bottom: 2px; }
  .opt-txt { font-size: 1.15rem; font-weight: 600; color: var(--text-main); }
  
  .status-icon { font-size: 1.5rem; margin-left: 12px; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
  .text-green { color: var(--success-color); }
  .text-red { color: var(--error-color); }

  /* --- 底部提交按钮 --- */
  .bottom-submit-area {
    position: fixed; bottom: 30px; left: 0; right: 0;
    display: flex; justify-content: center;
    pointer-events: none; z-index: 50;
  }
  .submit-btn {
    pointer-events: auto;
    background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
    color: white; border: none;
    padding: 16px 80px;
    border-radius: 99px;
    font-size: 1.2rem; font-weight: 700;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
    letter-spacing: 0.5px;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; cursor: not-allowed; }
  .submit-btn:active { transform: scale(0.96); }

  /* --- 解析遮罩层 (Overlay) --- */
  .overlay-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.3);
    backdrop-filter: blur(2px);
    z-index: 90;
    opacity: 0; pointer-events: none;
    transition: opacity 0.3s;
  }
  .overlay-backdrop.show { opacity: 1; pointer-events: auto; }

  .explanation-sheet {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white;
    border-radius: 28px 28px 0 0;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
    z-index: 100;
    transform: translateY(110%);
    transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
    padding: 24px 24px 40px 24px;
    display: flex; flex-direction: column; gap: 16px;
    max-height: 70vh; overflow-y: auto;
  }
  .explanation-sheet.show { transform: translateY(0); }

  .sheet-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .result-badge {
    padding: 6px 16px; border-radius: 20px;
    font-size: 1.1rem; font-weight: 800;
    display: flex; align-items: center; gap: 8px;
  }
  .result-badge.correct { background: #ecfdf5; color: var(--success-color); }
  .result-badge.wrong { background: #fef2f2; color: var(--error-color); }

  .explanation-box {
    background: #f8fafc;
    border-radius: 16px;
    padding: 18px;
    border: 1px solid #e2e8f0;
  }
  .exp-label { font-size: 0.95rem; font-weight: 700; color: var(--text-sub); margin-bottom: 6px; display:flex; align-items:center; gap:6px;}
  .exp-text { font-size: 1.05rem; color: var(--text-main); line-height: 1.6; }

  .next-btn {
    width: 100%;
    background: var(--text-main);
    color: white; border: none;
    padding: 18px;
    border-radius: 20px;
    font-size: 1.15rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-top: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .next-btn:active { transform: scale(0.98); opacity: 0.95; }
  .next-btn.is-correct { 
    background: var(--success-color); 
    box-shadow: 0 8px 25px -5px rgba(16, 185, 129, 0.5); 
  }
`;

// --- 4. 文本解析 (保持不变) ---
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
  const rawData = props.data || props;
  const rawQuestion = props.question || rawData.question || {};
  const rawOptions = props.options || rawData.options || [];
  const rawCorrectAnswer = props.correctAnswer || rawData.correctAnswer || [];
  const explanationText = props.explanation || rawData.explanation || "";

  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = typeof rawQuestion === 'object' ? rawQuestion.imageUrl : null;
  const teacherImage = "https://audio.886.best/chinese-vocab-audio/%E5%9B%BE%E7%89%87/1765952194374.png";
  
  const { onCorrect, onIncorrect, onNext } = props;

  // 状态
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mountedRef = useRef(true);
  const hasAutoPlayedRef = useRef(false);

  // 初始化与重置逻辑
  useEffect(() => {
    mountedRef.current = true;
    
    // 切换题目时强制重置所有状态
    audioController.stop();
    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setIsRight(false);
    hasAutoPlayedRef.current = false;

    // 解析新数据
    setTitleSegments(parseTitleText(questionText));
    setOrderedOptions(rawOptions.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 延时自动播放，提升体验
    if (questionText) {
      const timer = setTimeout(() => {
        if (mountedRef.current && !hasAutoPlayedRef.current) {
          handleTitlePlay(null, true);
          hasAutoPlayedRef.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    return () => { mountedRef.current = false; audioController.stop(); };
  }, [questionText, rawOptions]); // 依赖项确保数据变化时重置

  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    if (!isAuto && navigator.vibrate) navigator.vibrate(30);

    audioController.playMixed(
      questionText,
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  const handleCardClick = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    audioController.playMixed(option.text || '');
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    
    const isCorrect = rawCorrectAnswer.map(String).includes(String(selectedId));
    setIsRight(isCorrect);
    setIsSubmitted(true);
    audioController.stop();

    if (isCorrect) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ['#10b981', '#34d399', '#fcd34d'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  // 修复后的下一题逻辑
  const handleNext = () => {
    // 1. 处理得分回调
    if (isRight) {
      if (onCorrect) onCorrect();
    } else {
      if (onIncorrect) onIncorrect();
    }

    // 2. 调用父级切换题目
    // 注意：这里不需要手动 setIsSubmitted(false)，
    // 因为父组件更新 props.question 后，上面的 useEffect 会自动执行重置。
    if (onNext) {
      onNext();
    }
  };

  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container">
        
        {/* 滚动区域 */}
        <div className="xzt-scroll-area">
          
          {/* 场景区域：人物+气泡 */}
          <div className="scene-wrapper">
            <img src={teacherImage} alt="Teacher" className="teacher-img" />
            
            <div className="bubble-container">
              <div className="bubble-tail"></div>
              
              <div className="bubble-content">
                {questionImage && <img src={questionImage} alt="ref" className="question-ref-img" />}
                
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

                <div 
                  className={`bubble-audio-btn ${isPlaying ? 'playing' : ''}`} 
                  onClick={(e) => handleTitlePlay(e, false)}
                >
                  <FaVolumeUp />
                </div>
              </div>
            </div>
          </div>

          {/* 选项网格 */}
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

        {/* 遮罩层 */}
        <div className={`overlay-backdrop ${isSubmitted ? 'show' : ''}`} onClick={() => {}} />

        {/* 底部解析面板 (Overlay) */}
        <div className={`explanation-sheet ${isSubmitted ? 'show' : ''}`}>
          <div className="sheet-header">
            <div className={`result-badge ${isRight ? 'correct' : 'wrong'}`}>
              {isRight ? <FaCheck /> : <FaTimes />}
              <span>{isRight ? 'မှန်ပါတယ်' : 'မှားပါတယ်'}</span>
            </div>
          </div>

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
