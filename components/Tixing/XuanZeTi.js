import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// ==========================================
// 1. IndexedDB 缓存 (性能优化)
// ==========================================
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (this.db) return;
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = () => resolve(); 
    });
  },
  async get(key) {
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const r = tx.objectStore(STORE_NAME).get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  },
  async set(key, blob) {
    await this.init();
    if (!this.db) return;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch { resolve(); }
    });
  }
};

// ==========================================
// 2. 音频控制器 (强制打断 + 过滤符号)
// ==========================================
const audioController = {
  currentAudio: null,
  latestRequestId: 0,

  stop() {
    this.latestRequestId++;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
  },

  async play(text, rate = 1.0) {
    this.stop(); 
    if (!text) return;
    // 过滤掉所有符号，只读汉字、英文、数字
    const textToRead = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ''); 
    if (!textToRead.trim()) return; 

    const myReq = this.latestRequestId;
    const cacheKey = `tts-${textToRead}-${rate}`;
    let audioUrl;

    try {
      const cached = await idb.get(cacheKey);
      if (myReq !== this.latestRequestId) return;

      if (cached) {
        audioUrl = URL.createObjectURL(cached);
      } else {
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=zh-CN-XiaoyouMultilingualNeural&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("TTS Error");
        const blob = await res.blob();
        if (myReq !== this.latestRequestId) return;
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      this.currentAudio = audio;
      await audio.play().catch(() => {});
      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        if (audioUrl) URL.revokeObjectURL(audioUrl); 
      };
    } catch (e) { this.currentAudio = null; }
  }
};

// ==========================================
// 3. 样式定义 (修复按钮位置、禁止刷新)
// ==========================================
const cssStyles = `
  html, body {
    overscroll-behavior-y: none;
    overscroll-behavior: none;
    touch-action: pan-x pan-y;
    height: 100%;
    overflow: hidden; 
  }

  .xzt-container { 
    width: 100%; 
    height: 100vh;
    display: flex; 
    flex-direction: column; 
    align-items: center;
    position: relative; 
    padding: 10px 16px;
    box-sizing: border-box;
    overflow-y: auto; 
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
  }
  
  .spacer { flex: 1; min-height: 10px; max-height: 40px; }

  /* 题目卡片 */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 20px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    border: 1px solid #f1f5f9;
    cursor: pointer;
    width: 100%;
    max-width: 500px;
    margin: 0 auto 10px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    user-select: none;
  }
  
  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; background-color: #f8fafc; }
  .icon-pulse { animation: pulse 1.2s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  .pinyin-box { 
    display: flex; 
    flex-wrap: wrap; 
    justify-content: center; 
    gap: 4px; 
    row-gap: 8px;
    align-items: flex-end;
    margin-top: 4px;
  }
  .char-block { display: flex; flex-direction: column; align-items: center; min-width: 1.2em; }
  .py-text { font-size: 0.85rem; color: #64748b; font-family: monospace; margin-bottom: -2px; min-height: 1rem; line-height: 1; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.25; }

  /* 选项区域 */
  .xzt-options-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 500px;
    /* 底部预留足够空间，防止按钮遮挡 */
    padding-bottom: 180px; 
  }

  .xzt-option-card {
    position: relative;
    background: #ffffff;
    border-radius: 16px;
    border: 2px solid #e2e8f0;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
    cursor: pointer;
    transition: transform 0.1s, background 0.2s, border-color 0.2s;
    user-select: none;
    display: flex; /* Flex布局保证内容撑开 */
    align-items: center; 
    width: 100%; 
    box-sizing: border-box;
  }
  
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2); }
  .xzt-option-card.correct { border-color: #22c55e; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #ef4444; background: #fef2f2; animation: shake 0.4s; }

  .layout-text-only { padding: 16px; min-height: 64px; }
  .layout-with-image { padding: 12px; min-height: 80px; }

  .opt-img-wrapper { width: 56px; height: 56px; border-radius: 8px; overflow: hidden; background: #f1f5f9; margin-right: 12px; flex-shrink: 0; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  /* 点击区域修复：让文本盒子占据剩余所有空间，确保点击空白处也生效 */
  .opt-text-box { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    min-width: 0; 
  }
  .layout-text-only .opt-text-box { align-items: center; text-align: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }

  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .opt-cn { font-size: 1.15rem; font-weight: 700; color: #334155; line-height: 1.2; word-break: break-word; }
  .opt-en { font-size: 1.1rem; font-weight: 600; color: #475569; }

  /* 底部固定区域：大幅提高 bottom 值 */
  .fixed-bottom-area {
    position: fixed;
    /* 提升到 100px，确保不在屏幕最底端 */
    bottom: 100px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 100;
    padding: 0 20px;
    pointer-events: none; 
  }

  .explanation-card {
    pointer-events: auto;
    background: #fff;
    border: 1px solid #fecaca;
    background-color: #fff1f2;
    color: #991b1b;
    padding: 14px;
    border-radius: 12px;
    margin-bottom: 12px;
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: left;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);
    display: flex;
    gap: 10px;
    align-items: flex-start;
    animation: slideUp 0.3s ease-out;
  }

  .submit-btn {
    pointer-events: auto;
    width: 100%;
    max-width: 500px;
    padding: 16px 0;
    border-radius: 999px;
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: white;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
    border: none;
    transition: all 0.2s;
    text-align: center;
    cursor: pointer;
  }
  .submit-btn:disabled { 
    background: #e2e8f0; 
    color: #cbd5e1; 
    box-shadow: none; 
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.97); }

  .status-icon { position: absolute; right: 16px; font-size: 22px; }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

// ==========================================
// 4. 拼音处理 (严格过滤，修复符号问题)
// ==========================================
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);

const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      // 核心修复：只有纯汉字才去匹配拼音
      if (isChineseChar(char)) {
        let py = pinyins[pyIndex] || '';
        pyIndex++;
        return { char, pinyin: py };
      } 
      // 标点、数字、空格 -> 拼音设为空
      return { char, pinyin: '' };
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

// ==========================================
// 5. 辅助函数：统一获取正确答案ID列表
// ==========================================
const getCorrectIds = (question, correctAnswerProp) => {
  let ids = [];
  // 优先看 question.correct
  if (question && question.correct !== undefined) {
    ids = Array.isArray(question.correct) ? question.correct : [question.correct];
  } 
  // 如果没有，再看 props.correctAnswer
  else if (correctAnswerProp !== undefined) {
    ids = Array.isArray(correctAnswerProp) ? correctAnswerProp : [correctAnswerProp];
  }
  // 全部转为字符串，防止 1 !== "1" 的问题
  return ids.map(id => String(id));
};

// ==========================================
// 6. 主组件
// ==========================================
const XuanZeTi = ({ 
  question,         
  options, // 兼容旧代码传入的 options
  correctAnswer, // 兼容旧代码传入的 correctAnswer
  onNext,           
  explanation 
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const isMounted = useRef(true);

  // 1. JS层拦截下拉刷新
  useEffect(() => {
    isMounted.current = true;
    const preventPullToRefresh = (e) => {
      if (window.scrollY === 0 && e.touches[0].clientY > e.touches[0].target.offsetTop) {
        if(e.cancelable) e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => {
      isMounted.current = false;
      document.removeEventListener('touchmove', preventPullToRefresh);
    };
  }, []);

  // 2. 初始化逻辑 (修复乱序问题)
  // 依赖项只写 question.id，保证只有换题时才刷新，答错重试时不刷新
  useEffect(() => {
    if (!question) return;

    audioController.stop();

    // 生成拼音
    const text = question.text || "";
    setQuestionPinyin(generatePinyinData(text));

    // 获取选项数据 (合并 question.options 和 props.options)
    const sourceOptions = question.options || options || [];
    
    // 处理选项 (加拼音)
    const processed = sourceOptions.map(opt => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text || "");
      return {
        ...opt,
        pinyinData: hasChinese ? generatePinyinData(opt.text) : [],
        isChinese: hasChinese,
        hasImage: !!opt.imageUrl
      };
    });

    // 乱序 (Fisher-Yates)
    const shuffled = [...processed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledOptions(shuffled);

    // 重置状态
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    // 自动读题
    setTimeout(() => {
      if (isMounted.current && text) {
        setIsPlaying(true);
        audioController.play(text, 0.9).then(() => {
            if(isMounted.current) setIsPlaying(false);
        });
      }
    }, 300);

  }, [question?.id]); // 核心修复：只依赖 ID 变化

  // 点击选项
  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    if (option.text) audioController.play(option.text, 0.85);
  };

  // 提交
  const handleSubmit = (e) => {
    e && e.stopPropagation();
    if (!selectedId || isSubmitted) return;

    setIsSubmitted(true);
    
    // 修复判题逻辑：合并获取正确答案ID，并转字符串比对
    const correctIds = getCorrectIds(question, correctAnswer);
    const selectedStr = String(selectedId);
    const isCorrect = correctIds.includes(selectedStr);

    if (isCorrect) {
      // === 正确 ===
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.65 }, colors: ['#a78bfa', '#34d399', '#fcd34d'] });
      try { new Audio('/sounds/correct.mp3').play().catch(()=>{}); } catch (e) {}
      
      if (onNext) {
        setTimeout(() => {
           if(isMounted.current) onNext({ correct: true, question });
        }, 1200);
      }
    } else {
      // === 错误 ===
      try { new Audio('/sounds/incorrect.mp3').play().catch(()=>{}); } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(200);
      
      const explainText = explanation || question.explanation;
      if (explainText) {
        setShowExplanation(true);
        setTimeout(() => {
          if(isMounted.current) audioController.play(explainText, 0.95);
        }, 600);
      }

      // 错误后：等待 2.5 秒重置状态（保留顺序，让用户重试）
      setTimeout(() => {
        if(isMounted.current) {
            setIsSubmitted(false);
            // 这里的 selectedId 可以保留，方便用户看到刚才选的是哪个
        }
      }, 2500);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    audioController.play(question.text || "", 0.9).then(() => {
        if(isMounted.current) setIsPlaying(false);
    });
  };

  if (!question) return null;

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        <div className="spacer" />

        {/* 题目卡片 */}
        <div className="xzt-question-card" onClick={handleReadQuestion}>
          <div style={{position:'absolute', top:16, right:16, color: isPlaying ? '#8b5cf6' : '#cbd5e1', transition:'color 0.3s'}}>
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} size={20} />
          </div>

          {question.imageUrl && (
            <img src={question.imageUrl} alt="Q" className="question-img" />
          )}

          <div className="pinyin-box">
            {questionPinyin.map((item, idx) => (
              <div key={idx} className="char-block">
                {/* 只有有拼音才显示，符号不显示拼音 */}
                <span className="py-text">{item.pinyin}</span>
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />

        {/* 选项列表 */}
        <div className="xzt-options-grid">
          {shuffledOptions.map(option => {
            let statusClass = '';
            const optId = String(option.id);
            const selId = String(selectedId);
            
            // 获取正确答案列表
            const corrIds = getCorrectIds(question, correctAnswer);

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
                    // 修复：停止冒泡，确保点击整个卡片生效
                    e.stopPropagation(); 
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
                        {(option.pinyinData || []).map(d => d.pinyin).join(' ')}
                      </div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className="opt-en">{option.text || "暂无文本"}</div>
                  )}
                </div>
                
                {isSubmitted && corrIds.includes(optId) && 
                  <FaCheckCircle className="status-icon" style={{color:'#22c55e'}}/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && 
                  <FaTimesCircle className="status-icon" style={{color:'#ef4444'}}/>}
              </div>
            );
          })}
        </div>

        {/* 底部固定区域：已提升高度 */}
        <div className="fixed-bottom-area">
          {showExplanation && (
            <div className="explanation-card">
               <FaLightbulb size={18} style={{flexShrink:0, marginTop:2}} />
               <div>{explanation || question.explanation || "暂无解析"}</div>
            </div>
          )}

          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || (isSubmitted && !showExplanation)} 
          >
            {isSubmitted 
              ? (getCorrectIds(question, correctAnswer).includes(String(selectedId)) ? "正确" : "请重试") 
              : "确认"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
