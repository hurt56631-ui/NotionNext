import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 简易封装 (缓存 TTS) ---
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e);
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
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
    });
  }
};

// --- 2. 音频控制器 ---
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

  async play(text, rate = 1.0) {
    if (!text) return;
    // 过滤：保留中文、英文、数字、缅语
    const textToRead = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\u1000-\u109F]/g, ''); 
    if (!textToRead.trim()) return; 

    const myRequestId = ++this.latestRequestId;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    const cacheKey = `tts-${textToRead}-${rate}`;
    let audioUrl;

    try {
      const cachedBlob = await idb.get(cacheKey);
      if (myRequestId !== this.latestRequestId) return;

      if (cachedBlob) {
        audioUrl = URL.createObjectURL(cachedBlob);
      } else {
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=zh-CN-XiaoyouMultilingualNeural&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        const blob = await res.blob();
        if (myRequestId !== this.latestRequestId) return;
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;
      await audio.play().catch(e => {});
      
      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        if (audioUrl) URL.revokeObjectURL(audioUrl); 
      };
    } catch (e) { console.error("Audio error:", e); }
  }
};

// --- 样式定义 ---
const cssStyles = `
  /* 禁止下拉刷新，防止页面弹性滚动 */
  html, body {
    overscroll-behavior-y: none;
    touch-action: pan-x pan-y;
  }

  .xzt-container { 
    width: 100%; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
    align-items: center;
    position: relative; 
    padding: 0 16px;
    overflow-y: auto;
    overscroll-behavior-y: none; /* 再次确保容器不回弹 */
    -webkit-tap-highlight-color: transparent;
  }
  
  .spacer { flex: 1; min-height: 5px; max-height: 30px; }

  /* --- 题目卡片 --- */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 24px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 8px 30px -5px rgba(139, 92, 246, 0.12), 
                0 0 0 1px rgba(243, 244, 246, 1);
    cursor: pointer;
    width: 100%;
    max-width: 460px; /* 稍微调窄一点 */
    margin: 0 auto 10px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    user-select: none;
  }
  
  .question-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; margin-bottom: 16px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }

  .pinyin-box { 
    display: flex; 
    flex-wrap: wrap; 
    justify-content: center; 
    gap: 4px; 
    row-gap: 6px;
    align-items: flex-end;
  }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; min-height: 1rem; }
  .cn-text { font-size: 1.4rem; font-weight: 700; color: #1e293b; line-height: 1.3; }

  /* --- 选项区域 --- */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    width: 100%;
    max-width: 460px;
    padding-bottom: 160px; /* 增加底部留白，防止按钮遮挡 */
  }

  .xzt-option-card {
    position: relative;
    background: #ffffff;
    border-radius: 18px;
    border: 2px solid #f1f5f9;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04);
    cursor: pointer;
    transition: all 0.15s ease;
    overflow: hidden;
    user-select: none;
    /* 关键：Flex布局确保内容撑满，点击区域覆盖全卡片 */
    display: flex;
    align-items: center; 
    width: 100%; 
  }
  
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  /* 调整卡片内边距 */
  .layout-text-only { padding: 14px 16px; min-height: 60px; }
  .layout-with-image { padding: 12px; min-height: 80px; }

  .opt-img-wrapper { width: 60px; height: 60px; border-radius: 10px; overflow: hidden; background: #f3f4f6; margin-right: 14px; flex-shrink: 0; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  /* 关键：flex: 1 让文字区域占据剩余所有空间，解决点击右侧才有效的问题 */
  .opt-text-box { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    width: 0; /* 防止长文本溢出 flex 容器 */
  }
  .layout-text-only .opt-text-box { align-items: center; text-align: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }

  .opt-pinyin { font-size: 0.75rem; color: #94a3b8; font-family: monospace; height: 1.1em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 100%; }
  .opt-cn { font-size: 1.2rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-en { font-size: 1.05rem; font-weight: 600; color: #475569; }

  /* 底部固定区域 (按钮 + 解析) */
  .fixed-bottom-area {
    position: fixed;
    bottom: 140px; /* 按钮位置整体上移 */
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    z-index: 60;
    padding: 0 20px;
  }

  /* 解析卡片 */
  .explanation-card {
    background: #fff;
    border: 1px solid #fecaca;
    background-color: #fef2f2;
    color: #b91c1c;
    padding: 12px 16px;
    border-radius: 16px;
    margin-bottom: 12px;
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: left;
    width: 100%;
    max-width: 460px;
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
    display: flex;
    align-items: flex-start;
    gap: 8px;
    animation: slideUp 0.3s ease-out;
  }

  .submit-btn {
    pointer-events: auto;
    min-width: 160px;
    padding: 14px 0;
    border-radius: 100px;
    font-size: 1.15rem;
    font-weight: 800;
    color: white;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
    border: none;
    transition: all 0.2s;
    text-align: center;
    cursor: pointer;
  }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: translateY(20px); opacity: 0; pointer-events: none; }
  .submit-btn:active:not(:disabled) { transform: scale(0.96); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// 工具函数：生成拼音数据，移除拼音中的标点
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);
const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      if (isChineseChar(char)) {
        let py = pinyins[pyIndex] || '';
        pyIndex++;
        return { char, pinyin: py };
      } else {
        // 如果不是中文，拼音字段置空，或者你想显示空字符串
        // 修改：确保拼音字段里不出现标点符号
        return { char, pinyin: '' };
      }
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化：只在 question 变化时刷新乱序，当页重试不刷新
  useEffect(() => {
    // 1. 停止音频
    audioController.stop();

    // 2. 生成题目拼音
    setQuestionPinyin(generatePinyinData(question.text));

    // 3. 处理选项数据（增加拼音，标记是否含图）
    const processed = options.map(opt => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text);
      return {
        ...opt,
        pinyinData: hasChinese ? generatePinyinData(opt.text) : [],
        isChinese: hasChinese,
        hasImage: !!opt.imageUrl
      };
    });

    // 4. 乱序逻辑：只在题目加载时执行一次
    const shuffled = [...processed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledOptions(shuffled);

    // 5. 自动播放题目音频
    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, 0.9).then(() => setIsPlaying(false));
    }

    // 6. 重置状态
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    return () => audioController.stop();
  }, [question.id, question.text]); // 关键修改：依赖项仅为 question 的属性，不依赖 options 引用

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    // 优化：点击发音，轻微延时避免过于频繁
    if (option.text) audioController.play(option.text, 0.8);
  };

  const handleSubmit = (e) => {
    // 防止冒泡或重复点击
    e && e.preventDefault();
    e && e.stopPropagation();

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
        setTimeout(() => {
          audioController.play(explanation, 0.9);
        }, 800);
      }

      setTimeout(() => {
        // 错误后不刷新题目顺序，只是重置选中状态（如果无解析则快速重置，有解析则保留状态）
        if (!explanation) {
            setIsSubmitted(false);
            setSelectedId(null);
        } else {
            setIsSubmitted(false);
            // 这里保留 selectedId 让用户看清楚刚才选错了哪个，或者你可以选择 setSelectedId(null)
        }
      }, 2000);
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
          {question.imageUrl && (
            <img src={question.imageUrl} alt="Q" className="question-img" />
          )}

          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {questionPinyin.map((item, idx) => (
              <div key={idx} className="char-block">
                {/* 仅当 pinyin 存在且非空时显示 */}
                {item.pinyin ? <span className="py-text">{item.pinyin}</span> : <span className="py-text"></span>}
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />

        <div className="xzt-options-grid">
          {shuffledOptions.map(option => {
            let statusClass = '';
            const optId = String(option.id);
            const selId = String(selectedId);
            const corrIds = correctAnswer.map(String);

            if (isSubmitted) {
              if (corrIds.includes(optId)) statusClass = 'correct'; 
              else if (optId === selId) statusClass = 'incorrect';
            } else {
              if (optId === selId) statusClass = 'selected';
            }

            const layoutClass = option.hasImage ? 'layout-with-image' : 'layout-text-only';

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${layoutClass} ${statusClass}`}
                onClick={(e) => {
                    e.stopPropagation(); // 阻止事件冒泡，防止意外触发
                    if(showExplanation) setShowExplanation(false);
                    handleSelect(option);
                }}
              >
                {option.hasImage && (
                  <div className="opt-img-wrapper">
                    <img src={option.imageUrl} alt="opt" className="opt-img" />
                  </div>
                )}

                <div className="opt-text-box">
                  {option.isChinese ? (
                    <>
                      <div className="opt-pinyin">
                        {/* 过滤拼音中的标点 */}
                        {option.pinyinData.map(d => d.pinyin).join(' ')}
                      </div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className="opt-en">{option.text}</div>
                  )}
                </div>
                
                {isSubmitted && corrIds.includes(optId) && <FaCheckCircle className="text-green-500 absolute right-4 text-xl"/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && <FaTimesCircle className="text-red-500 absolute right-4 text-xl"/>}
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

          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            // 修复：确保 disable 逻辑正确，提交后只有等重置才能再点
            disabled={!selectedId || (isSubmitted && !showExplanation)} 
            type="button" 
          >
            {isSubmitted 
              ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "再试一次") 
              : "确认"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
