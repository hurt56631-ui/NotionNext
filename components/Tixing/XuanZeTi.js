import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaLightbulb, FaBookOpen } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 缓存 ---
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
      req.onsuccess = () => {
        const res = req.result;
        // 如果不是 Blob 或者 size === 0，则视为无缓存
        if (res && typeof res.size === 'number' && res.size > 0) resolve(res);
        else resolve(null);
      };
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

// --- 2. 音频控制器 ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [], 
  latestRequestId: 0,
  // keep refs for cancellation
  _pendingFetches: [],

  stop() {
    // cancel any pending fetch Promises where possible
    this.latestRequestId++;
    this._pendingFetches.forEach(ctrl => {
      try { ctrl.abort(); } catch (e) {}
    });
    this._pendingFetches = [];

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    this.playlist.forEach(a => {
      try { a.pause(); a.src = ''; } catch (e) {}
    });
    this.playlist = [];

    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) {}
      });
      this.activeBlobUrls = [];
    }
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  // fetchAudioBlob 增加 AbortController 支持
  async fetchAudioBlob(text, lang) {
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const rateParam = 0; 
    const cacheKey = `tts-${voice}-${text}-${rateParam}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;
    const controller = new AbortController();
    this._pendingFetches.push(controller);
    const signal = controller.signal;
    try {
      const res = await fetch(apiUrl, { signal });
      if (!res.ok) throw new Error(`TTS Fetch failed: ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) return null;
      await idb.set(cacheKey, blob);
      return blob;
    } finally {
      // remove this controller from pending list
      this._pendingFetches = this._pendingFetches.filter(c => c !== controller);
    }
  },

  async playMixed(text, onStart, onEnd) {
    // stop any current playback
    this.stop();
    if (!text) {
      if (onEnd) onEnd();
      return;
    }
    const reqId = ++this.latestRequestId;
    if (onStart) onStart();

    const segments = [];
    // 保持你修复后的分段正则：汉字与非汉字分段，允许非汉字段中含空格
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim(); // 保留段内空格，去掉首尾
      const isValidContent = /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText);
      if (segmentText && isValidContent) {
        const lang = this.detectLanguage(segmentText);
        segments.push({ text: segmentText, lang });
      }
    }

    if (segments.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    try {
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang))
      );

      if (reqId !== this.latestRequestId) return;

      const validBlobs = [];
      const validSegments = [];
      blobs.forEach((b, i) => {
        if (b) {
          validBlobs.push(b);
          validSegments.push(segments[i]);
        }
      });

      if (validBlobs.length === 0) {
        if (onEnd) onEnd();
        return;
      }

      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);
        const audio = new Audio(url);
        if (validSegments[index].lang === 'zh') {
          audio.playbackRate = 0.7;
        } else {
          audio.playbackRate = 1.0;
        }
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
        audio.onerror = (e) => {
          console.warn(`Audio segment error, skipping...`, e);
          playNext(index + 1);
        };
        audio.onloadedmetadata = () => {
          // double-check rate
          try {
            if (validSegments[index].lang === 'zh') audio.playbackRate = 0.7;
          } catch (e) {}
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Playback prevented:", error);
            // stop all and call onEnd to free UI
            this.stop();
            if (onEnd) onEnd();
          });
        }
      };

      playNext(0);
    } catch (e) {
      console.error("Fatal Load Error:", e);
      if (onEnd) onEnd();
    }
  }
};

// --- 3. 样式定义 ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;600;700&family=Ma+Shan+Zheng&display=swap');

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
  }

  .book-read-btn {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.6rem;
    margin-bottom: 24px;
    box-shadow: 0 8px 15px -3px rgba(124, 58, 237, 0.4);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    z-index: 110;
    pointer-events: auto;
    -webkit-user-select: none;
  }
  .book-read-btn:active { transform: scale(0.9); box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3); }
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
    width: 100%; max-height: 220px; object-fit: contain; 
    border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    pointer-events: none;
  }

  .rich-text-container {
    width: 100%; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end;
    gap: 6px; line-height: 1.8; padding: 0 10px;
    pointer-events: none; /* 背景文字不拦截点击，避免覆盖卡片点击 */
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; position: relative; pointer-events: auto; }
  .pinyin-top { font-size: 1rem; color: #64748b; font-family: monospace; font-weight: 500; height: 1.4em; margin-bottom: -2px; }
  .cn-char { font-size: 1.85rem; font-weight: 600; color: #1e293b; font-family: "Noto Sans SC", serif; line-height: 1.2; text-shadow: 1px 1px 0 rgba(0,0,0,0.02); }
  .other-text-block { font-size: 1.6rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; align-self: flex-end; margin-bottom: 4px; pointer-events: auto; }
  .title-divider { width: 60px; height: 4px; background-color: #f1f5f9; border-radius: 2px; margin-top: 24px; }

  .xzt-options-grid { 
    display: flex; flex-direction: column; gap: 16px; 
    width: 100%; max-width: 500px; padding-bottom: 20px;
    z-index: 15; 
    pointer-events: auto;
  }
  
  .xzt-option-card {
    position: relative; background: #fff; border-radius: 20px; 
    border: 2px solid #e2e8f0;
    box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 6px 0 #cbd5e1; 
    cursor: pointer; transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; justify-content: center;
    padding: 16px 20px; min-height: 72px;
    transform: translateY(0);
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
    pointer-events: auto;
  }
  .xzt-option-card:active { transform: translateY(4px); box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 2px 0 #cbd5e1; background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 6px 0 #ddd6fe; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; box-shadow: 0 6px 0 #bbf7d0; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; box-shadow: 0 6px 0 #fecaca; animation: shake 0.4s; }

  .opt-content { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .opt-py { font-size: 0.85rem; color: #94a3b8; line-height: 1; margin-bottom: 4px; font-family: monospace; }
  .opt-txt { font-size: 1.25rem; font-weight: 600; color: #334155; }
  
  .fixed-bottom-area {
    position: fixed; bottom: 12vh; left: 0; right: 0;
    display: flex; flex-direction: column-reverse; align-items: center;
    pointer-events: none; z-index: 200; gap: 20px;
  }

  .submit-btn {
    pointer-events: auto; width: auto; min-width: 180px; padding: 14px 40px;
    border-radius: 99px; font-size: 1.1rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    transition: all 0.2s; user-select: none;
    z-index: 210;
    -webkit-tap-highlight-color: transparent;
  }
  .submit-btn:active { transform: scale(0.95); }
  .submit-btn:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; opacity: 0.8; }
  .submit-btn.hidden-btn { opacity: 0; pointer-events: none; }

  .explanation-card {
    pointer-events: auto;
    background: #fff1f2; color: #be123c;
    border: 1px solid #fecaca;
    padding: 16px 20px; 
    border-radius: 16px;
    width: 88%; max-width: 450px;
    font-size: 1.05rem;
    line-height: 1.5;
    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
    animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex; gap: 12px; align-items: flex-start;
    cursor: pointer;
    position: fixed;
    bottom: calc(12vh + 96px);
    z-index: 300; 
    left: 50%;
    transform: translateX(-50%);
  }
  .explanation-card > * { pointer-events: none; }

  .tap-hint {
    font-size: 0.8rem; color: #f87171; opacity: 0.7; margin-top: 8px; font-weight: 400;
  }

  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
`;

// --- 4. 文本解析逻辑 ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  // 使用 Unicode Script 判断（支持更全）
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
/*
 Props:
  - question: { text, imageUrl, explanation, ... }
  - options: [{ id, text, imageUrl }]
  - correctAnswer: array of ids (支持多选判断但当前 UI 为单选)
  - onCorrect: ()=>void
  - onIncorrect: ()=>void
  - onNext: ()=>void  // 可选：父组件切换题目回调
*/
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, onNext }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [titleSegments, setTitleSegments] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeExplanation = (question.explanation || '').trim();
  const autoNextTimerRef = useRef(null);
  const explanationPlayRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // 清理上一次的音频和计时器
    audioController.stop();
    clearTimeout(autoNextTimerRef.current);
    autoNextTimerRef.current = null;
    explanationPlayRef.current = false;

    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTitleSegments(parseTitleText(question.text || ''));
    setOrderedOptions((options || []).map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动朗读一次（如果题干有 text）
    if (question.text) {
      // 延迟一点，保证界面渲染完毕
      setTimeout(() => {
        if (!mountedRef.current) return;
        handleTitlePlay(null, true);
      }, 500);
    }

    return () => {
      // 组件卸载或 question 改变时的清理
      audioController.stop();
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, options]);

  // 点击书本朗读
  const handleTitlePlay = (e, isAuto = false) => {
    if (e) e.stopPropagation();
    if (!isAuto && navigator.vibrate) navigator.vibrate(40);

    audioController.playMixed(
      question.text || '',
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  // 全局容器点击逻辑：用于在已提交后点击继续或触发下一题
  const handleGlobalClick = (e) => {
    // 防止点击被解释卡或按钮等覆盖
    if (!isSubmitted) return;
    // 如果答错，点击容器时立即跳到下一题（比自动等待更友好）
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));
    if (!isCorrect) {
      // 立即触发父层 onIncorrect/onNext（如果还没触发）
      triggerIncorrectAndNext();
    } else {
      // 已答对，触发 onCorrect 即可（父组件一般已收到）
      triggerCorrectAndNext();
    }
  };

  // 选项点击
  const handleCardClick = (option, e) => {
    if (isSubmitted) return;
    if (e) e.stopPropagation();
    setSelectedId(option.id);
    if (navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text || '');
  };

  // 触发正确回调并下一题（防重复）
  const triggeredCorrectRef = useRef(false);
  const triggerCorrectAndNext = () => {
    if (triggeredCorrectRef.current) return;
    triggeredCorrectRef.current = true;

    // 播放奖励/声音并稍后触发回调
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
    new Audio('/sounds/correct.mp3').play().catch(()=>{});

    setTimeout(() => {
      try { onCorrect && onCorrect(); } catch (e) { console.warn(e); }
      try { onNext && onNext(); } catch (e) { console.warn(e); }
      // reset flag after a tick to allow next question to reuse this component instance
      triggeredCorrectRef.current = false;
    }, 1500);
  };

  // 触发错误回调并下一题（防重复）
  const triggeredIncorrectRef = useRef(false);
  const triggerIncorrectAndNext = () => {
    if (triggeredIncorrectRef.current) return;
    triggeredIncorrectRef.current = true;

    // 先播放错误音
    new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
    if (navigator.vibrate) navigator.vibrate([50,50,50]);

    // 如果有解析文本，显示并朗读解析，再在 3s 后触发 onIncorrect/onNext
    if (activeExplanation) {
      setShowExplanation(true);
      // 延迟一点播放解析，确保 showExplanation 已渲染
      setTimeout(() => {
        explanationPlayRef.current = true;
        audioController.playMixed(activeExplanation, () => {}, () => {
          explanationPlayRef.current = false;
        });
      }, 400);
    }

    // 3 秒后触发回调并进入下一题（如果父组件没立即切换）
    autoNextTimerRef.current = setTimeout(() => {
      try { onIncorrect && onIncorrect(question); } catch (e) { console.warn(e); }
      try { onNext && onNext(); } catch (e) { console.warn(e); }
      triggeredIncorrectRef.current = false;
      setShowExplanation(false);
      autoNextTimerRef.current = null;
    }, 5000);
  };

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));
    if (isCorrect) {
      // 触发正确处理（内部会调用 onCorrect/onNext）
      triggerCorrectAndNext();
    } else {
      // 显示解析并安排自动下一题
      triggerIncorrectAndNext();
    }
  };

  // 点击解析卡片：立即继续（等效于全局点击）
  const handleExplanationClick = (e) => {
    e.stopPropagation();
    // 如果正在播放解析，尽量停止并直接跳下一题
    audioController.stop();
    clearTimeout(autoNextTimerRef.current);
    autoNextTimerRef.current = null;
    try { onIncorrect && onIncorrect(question); } catch (e) { console.warn(e); }
    try { onNext && onNext(); } catch (e) { console.warn(e); }
    setShowExplanation(false);
    triggeredIncorrectRef.current = false;
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      audioController.stop();
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    };
  }, []);

  return (
    <>
      <style>{cssStyles}</style>

      <div className="xzt-container" onClick={handleGlobalClick} role="region" aria-label="选择题区域">
        <div 
          className={`book-read-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={(e) => handleTitlePlay(e, false)}
          role="button"
          aria-label="朗读题干"
          title="朗读题干"
        >
          <FaBookOpen />
        </div>

        <div className="xzt-question-area">
          {question.imageUrl && <img src={question.imageUrl} alt="" className="question-img" />}

          <div className="rich-text-container" aria-hidden="false">
            {titleSegments.map((seg, i) => {
              if (seg.type === 'zh') {
                return (
                  <div key={i} className="cn-block" aria-hidden="false">
                    <span className="pinyin-top">{seg.pinyin}</span>
                    <span className="cn-char">{seg.char}</span>
                  </div>
                );
              } else {
                return <span key={i} className="other-text-block">{seg.text}</span>;
              }
            })}
          </div>

          <div className="title-divider" />
        </div>

        <div className="xzt-options-grid" role="list" aria-label="选项列表">
          {orderedOptions.map(opt => {
            let status = '';
            const isSel = String(opt.id) === String(selectedId);
            const isRight = correctAnswer.map(String).includes(String(opt.id));
            if (isSubmitted) {
              if (isRight) status = 'correct';
              else if (isSel) status = 'incorrect';
            } else if (isSel) status = 'selected';

            return (
              <div 
                key={opt.id} 
                className={`xzt-option-card ${status}`} 
                onClick={(e) => handleCardClick(opt, e)}
                role="button"
                aria-pressed={isSel}
                aria-label={`选项 ${opt.text}`}
              >
                {opt.hasImage && <img src={opt.imageUrl} alt="" className="w-12 h-12 rounded mr-3 object-cover" style={{width:48,height:48,marginRight:12,borderRadius:8}} />}
                <div className="opt-content">
                  {opt.parsed && opt.parsed.isZh ? (
                    <>
                      <div className="opt-py">{opt.parsed.pinyins}</div>
                      <div className="opt-txt">{opt.text}</div>
                    </>
                  ) : (
                    <div className="opt-txt" style={{fontWeight:500}}>{opt.text}</div>
                  )}
                </div>
                {status === 'correct' && <FaCheckCircle style={{position:'absolute', right:16}} className="text-green-500 text-2xl" />}
                {status === 'incorrect' && <FaTimesCircle style={{position:'absolute', right:16}} className="text-red-500 text-2xl" />}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area" aria-hidden="false">
          <button 
            className={`submit-btn ${isSubmitted ? 'hidden-btn' : ''}`} 
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            disabled={!selectedId}
            aria-disabled={!selectedId}
            aria-label="提交答案"
            title="提交答案"
          >
            提 交
          </button>

          {showExplanation && activeExplanation && (
            <div 
              className="explanation-card"
              onClick={handleExplanationClick}
              role="dialog"
              aria-label="解析"
            >
              <FaLightbulb className="flex-shrink-0 mt-1 text-red-500 text-xl" />
              <div>
                <div>{activeExplanation}</div>
                <div className="tap-hint">点击任意处继续...</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
