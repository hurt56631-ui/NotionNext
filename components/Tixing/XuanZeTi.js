import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// ==========================================
// 1. IndexedDB 缓存 (保持不变)
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
// 2. 音频控制器 (修改：增加预缓存功能)
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

  // 新增：预缓存音频函数
  async precache(text, rate = 1.0) {
    if (!text) return;
    const textToRead = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
    if (!textToRead.trim()) return;

    const cacheKey = `tts-${textToRead}-${rate}`;
    try {
      const cached = await idb.get(cacheKey);
      if (cached) return; // 如果已缓存，则跳过

      const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=zh-CN-XiaoyouMultilingualNeural&r=${rate > 1 ? 20 : 0}`;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("TTS Precache Error");
      const blob = await res.blob();
      await idb.set(cacheKey, blob);
    } catch (e) {
      // 预缓存失败是正常的，不提示用户
      // console.error(`Failed to precache audio for: "${textToRead}"`, e);
    }
  },

  async play(text, rate = 1.0) {
    this.stop(); 
    if (!text) return;
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
// 3. 样式定义 (修改：修复确认按钮点击区域)
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
    padding: 10px 32px; 
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
    max-width: 460px;
    margin: 0 auto 10px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    user-select: none;
  }
  
  .question-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; margin-bottom: 12px; background-color: #f8fafc; }
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
    max-width: 460px;
    padding-bottom: 180px; 
  }

  .xzt-option-card {
    position: relative;
    background: #ffffff;
    border-radius: 16px;
    border: 2px solid #e2e8f0;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    user-select: none;
    display: flex; 
    align-items: center; 
    width: 100%; 
    box-sizing: border-box;
    min-height: auto;
  }
  
  .xzt-option-card:active { transform: scale(0.97); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2); }
  .xzt-option-card.correct { 
    border-color: #22c55e; 
    background: #f0fdf4; 
    animation: success-pop 0.5s ease-out forwards;
  }
  .xzt-option-card.incorrect { border-color: #ef4444; background: #fef2f2; animation: shake 0.4s; }

  @keyframes success-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.05); box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); }
    100% { transform: scale(1); }
  }

  .layout-text-only { padding: 14px 20px; } 
  .layout-with-image { padding: 12px; }

  .opt-img-wrapper { 
    width: 48px; height: 48px; 
    border-radius: 10px; 
    overflow: hidden; 
    background: #f1f5f9; 
    margin-right: 14px; 
    flex-shrink: 0; 
    pointer-events: none; 
  }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  .opt-text-box { 
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    min-width: 0; 
    word-break: break-word; 
    pointer-events: none; 
  }
  
  .layout-text-only .opt-text-box { align-items: center; text-align: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }

  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: 2px; line-height: 1.1; }
  .opt-cn { font-size: 1.1rem; font-weight: 700; color: #334155; line-height: 1.3; }
  .opt-en { font-size: 1.05rem; font-weight: 600; color: #475569; }

  /* 底部固定区域 (修改：修复点击区域) */
  .fixed-bottom-area {
    position: fixed;
    bottom: 100px;
    /* 修改：使用 left/right 代替 padding，确保整个区域可交互 */
    left: 32px;
    right: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 100;
    pointer-events: none; 
  }

  .explanation-card {
    pointer-events: auto;
    background: #fff;
    border: 1px solid #fecaca;
    background-color: #fff1f2;
    color: #991b1b;
    padding: 12px 14px;
    border-radius: 12px;
    margin-bottom: 12px;
    font-size: 0.9rem;
    line-height: 1.4;
    text-align: left;
    width: 100%;
    max-width: 460px;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);
    display: flex;
    gap: 10px;
    align-items: flex-start;
    animation: slideUp 0.3s ease-out;
  }

  .submit-btn {
    pointer-events: auto;
    width: 100%;
    max-width: 460px;
    padding: 14px 0;
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

  .status-icon { position: absolute; right: 12px; font-size: 20px; }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

// ==========================================
// 4. 拼音处理 (严格过滤符号)
// ==========================================
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
      } 
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
  if (question && question.correct !== undefined) {
    ids = Array.isArray(question.correct) ? question.correct : [question.correct];
  } 
  else if (correctAnswerProp !== undefined) {
    ids = Array.isArray(correctAnswerProp) ? correctAnswerProp : [correctAnswerProp];
  }
  return ids.map(id => String(id));
};

// ==========================================
// 6. 主组件 (修改：增加预缓存逻辑)
// ==========================================
const XuanZeTi = ({ 
  question,         
  options, 
  correctAnswer, 
  onNext,           
  explanation,
  // 新增 props 用于预缓存
  allQuestions = [],
  currentIndex = 0,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [displayOptions, setDisplayOptions] = useState([]);
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

  // 2. 初始化逻辑
  useEffect(() => {
    if (!question) return;

    audioController.stop();

    const text = question.text || "";
    setQuestionPinyin(generatePinyinData(text));

    const sourceOptions = question.options || options || [];
    
    const processed = sourceOptions.map(opt => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text || "");
      return {
        ...opt,
        pinyinData: hasChinese ? generatePinyinData(opt.text) : [],
        isChinese: hasChinese,
        hasImage: !!opt.imageUrl
      };
    });

    setDisplayOptions(processed);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTimeout(() => {
      if (isMounted.current && text) {
        setIsPlaying(true);
        audioController.play(text, 0.9).then(() => {
            if(isMounted.current) setIsPlaying(false);
        });
      }
    }, 300);

  }, [question?.id]); 

  // 3. 新增：音频预缓存的 Effect
  useEffect(() => {
    if (!allQuestions || allQuestions.length === 0 || currentIndex >= allQuestions.length - 1) {
        return;
    }

    // 定义一个延迟执行的预缓存函数，避免阻塞当前题目渲染
    const precacheTask = setTimeout(() => {
        const textsToCache = new Set();
        // 缓存后5个题目
        const nextQuestions = allQuestions.slice(currentIndex + 1, currentIndex + 1 + 6); 

        nextQuestions.forEach(q => {
            const content = q.content || q;
            const promptText = content.prompt || content.text || '';
            const explanationText = content.explanation || '';
            const choices = content.choices || content.options || [];

            if (promptText) {
                textsToCache.add(promptText.replace(/【.*?】/g, ''));
            }
            if (explanationText) {
                textsToCache.add(explanationText);
            }
            choices.forEach(choice => {
                if (choice.text) {
                    const match = choice.text.match(/[\u4e00-\u9fa5]+/);
                    if (match) textsToCache.add(match[0]);
                }
            });
        });

        // 并行发起所有预缓存请求
        textsToCache.forEach(text => {
            if (text) {
                // 使用不同的速率进行缓存，以备不同场景使用
                audioController.precache(text, 0.9);  // 题目/解析速率
                audioController.precache(text, 0.85); // 选项速率
            }
        });
    }, 500); // 延迟 500ms 执行，不影响当前交互

    return () => clearTimeout(precacheTask);

  }, [currentIndex, allQuestions]);


  // 点击选项 (带震动)
  const handleSelect = (option) => {
    if (isSubmitted) return;
    
    if (navigator.vibrate) {
        try { navigator.vibrate(30); } catch(e){}
    }

    setSelectedId(option.id);
    if (option.text) audioController.play(option.text, 0.85);
  };

  // 提交
  const handleSubmit = (e) => {
    e && e.stopPropagation();
    if (!selectedId || isSubmitted) return;

    setIsSubmitted(true);
    
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

      setTimeout(() => {
        if(isMounted.current) {
            setIsSubmitted(false);
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
                <span className="py-text">{item.pinyin}</span>
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />

        <div className="xzt-options-grid">
          {displayOptions.map(option => {
            let statusClass = '';
            const optId = String(option.id);
            const selId = String(selectedId);
            
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
