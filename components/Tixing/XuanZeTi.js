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

// --- 2. 音频控制器 (混合朗读无缝拼接) ---
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
    // 检测是否包含缅文
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang, rate) {
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';
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

    // 分割文本：一段中文，或者一段非中文（缅文/英文/符号）
    // 逻辑：遇到中文单独切分或组合，遇到缅文保持连续
    // 这里简单按“语言块”分割
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

// --- 3. 样式定义 (修复乱码与按钮位置) ---
const cssStyles = `
  /* 引入缅文字体，解决乱码根本问题 */
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap');

  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif; /* 优先使用 Padauk 渲染缅文 */
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 10px 16px 140px 16px; /* 底部留白给浮动按钮 */
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

  /* 标题文本容器 */
  .title-text-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: 4px;
    line-height: 1.6;
  }

  /* 中文单字块 */
  .cn-block {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    margin: 0 1px;
  }
  .pinyin-top {
    font-size: 0.85rem;
    color: #94a3b8;
    font-family: monospace;
    height: 1.2em; /* 占位防止跳动 */
  }
  .cn-char {
    font-size: 1.6rem; /* 字体适中 */
    font-weight: 600;
    color: #1e293b;
  }

  /* 缅文/其他文本块 - 关键修复：不切分，保持连贯 */
  .other-text-block {
    font-size: 1.5rem;
    font-weight: 500;
    color: #334155;
    padding: 0 4px; /* 增加一点呼吸感 */
    display: inline-block;
  }

  /* 选项列表 */
  .xzt-options-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 500px;
  }

  .xzt-option-card {
    position: relative; background: #fff; border-radius: 16px; border: 2px solid #f1f5f9;
    box-shadow: 0 2px 6px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center;
    padding: 12px 16px;
    min-height: 64px;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; animation: bounce 0.4s; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  .opt-content { flex: 1; text-align: left; }
  .opt-py { font-size: 0.8rem; color: #94a3b8; line-height: 1; margin-bottom: 2px;}
  .opt-txt { font-size: 1.1rem; font-weight: 600; color: #334155; }
  
  /* 底部固定区域 */
  .fixed-bottom-area {
    position: fixed;
    bottom: 5vh; /* 距离底部 5% 的高度，明显抬高 */
    left: 0; right: 0;
    display: flex;
    flex-direction: column-reverse; /* 解析在按钮上方 */
    align-items: center;
    pointer-events: none;
    z-index: 100;
    gap: 16px;
  }

  /* 提交按钮 - 短小精悍 */
  .submit-btn {
    pointer-events: auto;
    width: auto;
    min-width: 140px;
    padding: 12px 40px;
    border-radius: 99px; /* 完全胶囊圆角 */
    font-size: 1.1rem; font-weight: 700; color: white; border: none;
    background: #6366f1;
    box-shadow: 0 6px 15px rgba(99, 102, 241, 0.4);
    transition: all 0.2s;
  }
  .submit-btn:active { transform: scale(0.95); }
  .submit-btn:disabled { opacity: 0; transform: translateY(20px); }

  /* 解析卡片 */
  .explanation-card {
    pointer-events: auto;
    background: #fff1f2; color: #be123c;
    border: 1px solid #fecaca;
    padding: 12px 16px; 
    border-radius: 12px;
    width: 90%; max-width: 400px;
    font-size: 0.95rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    animation: slideUp 0.3s ease-out;
    display: flex; gap: 8px; align-items: flex-start;
  }

  @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

// --- 4. 关键：混合文本解析器 (解决缅文乱码) ---
const parseTitleText = (text) => {
  if (!text) return [];
  const result = [];
  
  // 正则：捕获所有中文(含标点)，或者 非中文连续片段
  // \p{Script=Han} 匹配汉字
  const regex = /([\p{Script=Han}]+)|([^\p{Script=Han}]+)/gu;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const segment = match[0];
    // 如果是中文片段，再按字切分生成拼音
    if (/\p{Script=Han}/u.test(segment)) {
      const pinyins = pinyin(segment, { type: 'array', toneType: 'symbol' });
      const chars = segment.split('');
      chars.forEach((char, i) => {
        result.push({ type: 'zh', char, pinyin: pinyins[i] || '' });
      });
    } else {
      // 如果是非中文（缅文、英文、数字、空格），整体作为一个块，不要切分！
      // 这里的关键是保留 segment 原样，不 split
      result.push({ type: 'other', text: segment });
    }
  }
  return result;
};

// 选项也用类似逻辑，简单生成拼音数据
const parseOptionText = (text) => {
  const isZh = /[\u4e00-\u9fa5]/.test(text);
  if (!isZh) return { isZh: false, text };
  
  const pinyins = pinyin(text, { type: 'array', toneType: 'symbol', nonZh: 'consecutive' });
  // 这里简化处理，选项一般比较短
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
    
    // 1. 解析标题：混合排版
    setTitleSegments(parseTitleText(question.text));

    // 2. 解析选项
    setOrderedOptions(options.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    // 自动播放题目
    if (question.text) {
      audioController.playMixed(question.text);
    }
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
      // 答对
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      setTimeout(() => onCorrect && onCorrect(), 1500);
    } else {
      // 答错
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      
      if (explanation) {
        setShowExplanation(true);
        setTimeout(() => audioController.playMixed(explanation), 800);
      }

      // 答错逻辑：等待解析读完或固定时间，再触发 onIncorrect (用于重随)
      const waitTime = explanation ? Math.max(3000, explanation.length * 300) : 2000;
      setTimeout(() => {
        onIncorrect && onIncorrect(question);
      }, waitTime);
    }
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* 标题区域：支持缅文完整显示 + 中文拼音 */}
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
                // 缅文或标点，直接渲染，不拆分
                return <span key={i} className="other-text-block">{seg.text}</span>;
              }
            })}
             <FaVolumeUp className="text-purple-400 ml-2 mb-1" size={20} />
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
              <div key={opt.id} className={`xzt-option-card ${status}`} onClick={() => handleSelect(opt)}>
                {opt.hasImage && <img src={opt.imageUrl} className="w-12 h-12 rounded mr-3 object-cover bg-gray-100" />}
                <div className="opt-content">
                  {opt.parsed.isZh ? (
                    <>
                      <div className="opt-py">{opt.parsed.pinyins}</div>
                      <div className="opt-txt">{opt.text}</div>
                    </>
                  ) : (
                    // 缅文选项直接显示，不加拼音
                    <div className="opt-txt font-medium">{opt.text}</div>
                  )}
                </div>
                {status === 'correct' && <FaCheckCircle className="text-green-500 text-xl" />}
                {status === 'incorrect' && <FaTimesCircle className="text-red-500 text-xl" />}
              </div>
            );
          })}
        </div>

        {/* 悬浮底部区域：解析 + 按钮 */}
        <div className="fixed-bottom-area">
          <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || isSubmitted}>
            提 交
          </button>

          {showExplanation && explanation && (
            <div className="explanation-card">
              <FaLightbulb className="flex-shrink-0 mt-1" />
              <div>{explanation}</div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
