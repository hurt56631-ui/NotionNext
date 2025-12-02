import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp } from 'react-icons/fa';
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

// --- 2. 音频控制器 (修复重叠问题的核心) ---
const audioController = {
  currentAudio: null,
  latestRequestId: 0, // 核心：请求计数器

  stop() {
    // 停止当前正在播放的
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    // 增加计数器，这会让所有正在下载中的旧请求失效
    this.latestRequestId++; 
  },

  async play(text, rate = 1.0) {
    if (!text) return;

    // 1. 生成本次播放的唯一 ID
    const myRequestId = ++this.latestRequestId;

    // 2. 立即停止上一首
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    const cacheKey = `tts-${text}-${rate}`;
    let audioUrl;

    try {
      // 尝试取缓存
      const cachedBlob = await idb.get(cacheKey);
      
      // --- 关键检查点 1 ---
      // 如果在读取缓存期间用户又点了别的，ID 变了，直接退出
      if (myRequestId !== this.latestRequestId) return;

      if (cachedBlob) {
        audioUrl = URL.createObjectURL(cachedBlob);
      } else {
        // 网络请求
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        const blob = await res.blob();
        
        // --- 关键检查点 2 ---
        // 下载很慢，如果下载完发现用户切题了，直接退出，不要播放！
        if (myRequestId !== this.latestRequestId) return;

        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      // 3. 播放
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;
      
      await audio.play().catch(e => { /* 忽略自动播放限制错误 */ });
      
      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl); 
      };

    } catch (e) {
      console.error("Audio error:", e);
    }
  }
};

// --- 样式定义 ---
const cssStyles = `
  /* 容器 */
  .xzt-container { 
    width: 100%; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
    align-items: center;
    position: relative; 
    padding: 0 16px;
    overflow-y: auto; 
  }
  
  .spacer { flex: 1; min-height: 20px; }

  /* --- 题目卡片 --- */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 28px;
    padding: 24px;
    text-align: center;
    box-shadow: 0 10px 40px -10px rgba(139, 92, 246, 0.15), 
                0 0 0 1px rgba(243, 244, 246, 1);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    width: 100%;
    max-width: 480px;
    margin: 0 auto 30px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  /* 题目图片 */
  .question-img {
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    border-radius: 16px;
    margin-bottom: 20px;
    background-color: #f9fafb;
  }

  /* 喇叭图标 */
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }

  /* 题目文字 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; row-gap: 12px; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.9rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; }
  .cn-text { font-size: 2.0rem; font-weight: 800; color: #1e293b; line-height: 1.2; }

  /* --- 选项区域 --- */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    width: 100%;
    max-width: 480px;
    padding-bottom: 120px; 
  }

  /* 选项卡片 */
  .xzt-option-card {
    position: relative;
    background: #ffffff;
    border-radius: 20px;
    border: 2px solid #f1f5f9;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04);
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
  }
  
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  /* 布局A：纯文字 */
  .layout-text-only {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    min-height: 64px;
  }

  /* 布局B：有图片 (居中) */
  .layout-with-image {
    display: flex;
    flex-direction: row; 
    align-items: center;
    justify-content: center;
    padding: 16px;
    min-height: 90px;
  }

  .opt-img-wrapper {
    width: 70px;
    height: 70px;
    border-radius: 12px;
    overflow: hidden;
    background: #f3f4f6;
    margin-right: 16px;
    flex-shrink: 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  .opt-text-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .layout-text-only .opt-text-box { align-items: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }

  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-en { font-size: 1.1rem; font-weight: 600; color: #475569; }

  /* 提交按钮 */
  .submit-btn-wrapper {
    position: fixed;
    bottom: 90px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none; 
    z-index: 60;
  }
  .submit-btn {
    pointer-events: auto;
    min-width: 150px;
    padding: 14px 30px;
    border-radius: 100px;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4);
    border: none;
    transition: all 0.2s;
  }
  .submit-btn:disabled { 
    background: #e5e7eb; 
    color: #9ca3af;
    box-shadow: none; 
    transform: translateY(20px); 
    opacity: 0;
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

// 工具函数
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);
const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      if (isChineseChar(char)) {
        const py = pinyins[pyIndex] || '';
        pyIndex++;
        return { char, pinyin: py };
      } else {
        return { char, pinyin: '' };
      }
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化
  useEffect(() => {
    // 1. 停止上一个音频 (防止快速切题时声音残留)
    audioController.stop();

    // 2. 处理题目拼音
    setQuestionPinyin(generatePinyinData(question.text));

    // 3. 处理选项
    const processed = options.map(opt => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text);
      return {
        ...opt,
        pinyinData: hasChinese ? generatePinyinData(opt.text) : [],
        isChinese: hasChinese,
        hasImage: !!opt.imageUrl
      };
    });

    // 4. 随机排序
    const shuffled = [...processed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledOptions(shuffled);

    // 5. 自动播放题目音频 (语速 0.9)
    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, 0.9).then(() => {
        setIsPlaying(false);
      });
    }

    setSelectedId(null);
    setIsSubmitted(false);

    // 卸载时清理
    return () => audioController.stop();
  }, [question, options]);

  // 选中
  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    
    // 播放选项音 (语速 0.8)
    if (option.text) {
      audioController.play(option.text, 0.8);
    }
  };

  // 提交
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] });
      // 这里的音效通常很短，可以用 new Audio 直接播，或者集成进 audioController
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedId(null);
      }, 1500);
    }
  };

  // 点击题目朗读
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
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
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
                onClick={() => handleSelect(option)}
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
                        {option.pinyinData.map(d => d.pinyin).join(' ')}
                      </div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className="opt-en">{option.text}</div>
                  )}
                </div>
                
                {isSubmitted && corrIds.includes(optId) && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
              </div>
            );
          })}
        </div>

        <div className="submit-btn-wrapper">
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || isSubmitted}
          >
            {isSubmitted 
              ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "错误") 
              : "确认"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
