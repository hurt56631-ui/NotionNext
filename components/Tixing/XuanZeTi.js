import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaLightbulb, FaBookOpen } from 'react-icons/fa';
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

// --- 2. 音频控制器 ---
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
    if (/[\u1000-\u109F]/.test(text)) return 'my'; // 缅文
    return 'zh'; // 默认中文
  },

  async fetchAudioBlob(text, lang) {
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const rateParam = 0; 
    
    const cacheKey = `tts-${voice}-${text}-${rateParam}`;
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('TTS Fetch failed');
    const blob = await res.blob();
    await idb.set(cacheKey, blob);
    return blob;
  },

  async playMixed(text) {
    this.stop();
    if (!text) return;
    const reqId = ++this.latestRequestId;

    const segments = [];
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].trim()) {
        const lang = this.detectLanguage(match[0]);
        segments.push({ text: match[0], lang });
      }
    }

    if (segments.length === 0) return;

    try {
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang))
      );
      if (reqId !== this.latestRequestId) return;

      const audioObjects = blobs.map((blob, index) => {
        const audio = new Audio(URL.createObjectURL(blob));
        // 设置中文语速 0.7，其他语言 1.0 (正常)
        if (segments[index].lang === 'zh') {
          audio.playbackRate = 0.7; 
        } else {
          audio.playbackRate = 1.0;
        }
        return audio;
      });
      
      this.playlist = audioObjects;

      const playNext = (index) => {
        if (reqId !== this.latestRequestId || index >= audioObjects.length) {
            this.currentAudio = null;
            return;
        }
        const audio = audioObjects[index];
        this.currentAudio = audio;
        audio.onended = () => playNext(index + 1);
        
        audio.onloadedmetadata = () => {
             if (segments[index].lang === 'zh') audio.playbackRate = 0.7;
        };
        
        audio.play().catch(e => console.error(e));
      };
      playNext(0);
    } catch (e) {
      console.error(e);
    }
  }
};

// --- 3. 样式定义 ---
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
    padding: 40px 32px 180px 32px; 
    overflow-y: auto;
    background-color: #fdfdfd;
  }

  /* 标题区域容器 */
  .xzt-question-area {
    width: 100%;
    max-width: 500px;
    margin: 0 auto 30px auto; 
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* 注意：移除了外层的 onClick 和 cursor，移交给内部卡片 */
  }
  
  .question-img { 
    width: 100%; 
    max-height: 200px; 
    object-fit: contain; 
    border-radius: 12px; 
    background-color: #f8fafc; 
    margin-bottom: 16px; 
  }

  /* 标题透明卡片：增加 user-select: none 防止选中文本干扰点击 */
  .title-card-wrapper {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 20px;
    
    background-color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(226, 232, 240, 0.6);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
    
    cursor: pointer;
    user-select: none; /* 关键修复：禁止文字被选中，确保点击一定触发 */
    -webkit-user-select: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* 增加按压效果，让用户知道点中了 */
  .title-card-wrapper:active {
    background-color: rgba(241, 245, 249, 0.9);
    transform: scale(0.98); 
  }

  /* 书本图标 */
  .book-icon-left {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    background-color: #f3e8ff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8b5cf6;
    font-size: 1.3rem;
    box-shadow: 0 2px 4px rgba(139, 92, 246, 0.15);
  }

  /* 文字容器 */
  .title-text-container {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: flex-start;
    gap: 4px;
    line-height: 1.6;
    flex: 1;
    pointer-events: none; /* 让文字不响应鼠标事件，事件全部由父级卡片处理 */
  }

  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 1px; }
  .pinyin-top { font-size: 0.85rem; color: #94a3b8; font-family: monospace; height: 1.2em; }
  .cn-char { font-size: 1.6rem; font-weight: 600; color: #1e293b; }
  .other-text-block { font-size: 1.5rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; }

  /* 选项列表 */
  .xzt-options-grid {
    display: flex;
    flex-direction: column;
    gap: 16px; 
    width: 100%;
    max-width: 500px;
  }

  /* 选项卡片 */
  .xzt-option-card {
    position: relative; 
    background: #fff; 
    border-radius: 20px; 
    border: 2px solid #e2e8f0;
    box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 6px 0 #cbd5e1; 
    cursor: pointer; 
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; justify-content: center;
    padding: 16px 20px;
    min-height: 72px;
    transform: translateY(0);
    user-select: none; /* 选项也不要让选中文字 */
    -webkit-user-select: none;
  }
  
  .xzt-option-card:active { 
    transform: translateY(4px); 
    box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 2px 0 #cbd5e1; 
    background: #f8fafc; 
  }
  
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 6px 0 #ddd6fe; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; box-shadow: 0 6px 0 #bbf7d0; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; box-shadow: 0 6px 0 #fecaca; animation: shake 0.4s; }

  .opt-content { 
    flex: 1; 
    text-align: center; 
    display: flex; flex-direction: column; align-items: center; justify-content: center; 
  }
  
  .opt-py { font-size: 0.85rem; color: #94a3b8; line-height: 1; margin-bottom: 4px; font-family: monospace; }
  .opt-txt { font-size: 1.25rem; font-weight: 600; color: #334155; }
  
  /* 底部固定区域 */
  .fixed-bottom-area {
    position: fixed;
    bottom: 15vh;
    left: 0; right: 0;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    pointer-events: none;
    z-index: 100;
    gap: 20px;
  }

  /* 提交按钮 */
  .submit-btn {
    pointer-events: auto;
    width: auto; min-width: 180px;
    padding: 14px 40px;
    border-radius: 99px;
    font-size: 1.1rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    transition: all 0.2s;
    user-select: none;
  }
  .submit-btn:active { transform: scale(0.95); }
  .submit-btn:disabled { background: #e2e8f0; color: #94a3b8; box-shadow: none; opacity: 0.8; }
  .submit-btn.hidden-btn { opacity: 0; pointer-events: none; }

  /* 解析卡片 */
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
  }

  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
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
  
  const activeExplanation = explanation || question.explanation || "";

  useEffect(() => {
    // 每次题目更新时，强制停止音频并重置所有状态
    audioController.stop();
    
    // 强制重置状态
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTitleSegments(parseTitleText(question.text));
    setOrderedOptions(options.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动朗读标题一次
    if (question.text) audioController.playMixed(question.text);
  }, [question, options]);

  // 点击卡片仅选中
  const handleCardClick = (option) => {
    if (isSubmitted) return;
    
    setSelectedId(option.id);
    if (navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text);
  };

  // 点击“提交”按钮触发的逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      // --- 答对 ---
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      setTimeout(() => onCorrect && onCorrect(), 1500);
    } else {
      // --- 答错 ---
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      
      if (activeExplanation && activeExplanation.trim() !== '') {
        setShowExplanation(true);
        setTimeout(() => audioController.playMixed(activeExplanation), 500);
      } else {
        setShowExplanation(false);
      }

      // ✅ 强制 1.5 秒后自动下一题
      setTimeout(() => {
         if (onIncorrect) onIncorrect(question);
      }, 1500);
    }
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* 标题区域：外层只负责布局，点击事件交给内部卡片 */}
        <div className="xzt-question-area">
          
          {question.imageUrl && <img src={question.imageUrl} alt="" className="question-img" />}
          
          {/* 
              修改说明：
              1. onClick 移到了这个 div 上。
              2. CSS 中加入了 user-select: none 防止选中文本。
              3. CSS 中加入了 :active 缩放效果，提供点击反馈。
          */}
          <div 
            className="title-card-wrapper" 
            onClick={(e) => {
              e.stopPropagation(); // 防止事件冒泡干扰
              audioController.playMixed(question.text);
            }}
          >
            {/* 书本图标 */}
            <div className="book-icon-left">
              <FaBookOpen />
            </div>

            {/* 文字区域 */}
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
            </div>
          </div>
        </div>

        {/* 选项区域 */}
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
              <div 
                key={opt.id} 
                className={`xzt-option-card ${status}`} 
                onClick={() => handleCardClick(opt)}
              >
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
                {status === 'correct' && <FaCheckCircle className="text-green-500 text-2xl absolute right-4" />}
                {status === 'incorrect' && <FaTimesCircle className="text-red-500 text-2xl absolute right-4" />}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area">
          <button 
            className={`submit-btn ${isSubmitted ? 'hidden-btn' : ''}`} 
            onClick={handleSubmit} 
            disabled={!selectedId}
          >
            提 交
          </button>

          {showExplanation && activeExplanation && (
            <div className="explanation-card">
              <FaLightbulb className="flex-shrink-0 mt-1 text-red-500 text-xl" />
              <div>{activeExplanation}</div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
