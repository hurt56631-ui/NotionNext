import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 1. IndexedDB 简易封装 (缓存 TTS 音频) ---
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = (e) => { console.error("IndexedDB error:", e); reject(e); };
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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => { console.error("IDB set error:", e); reject(e); };
    });
  }
};

// --- 2. ✅ 修复后的音频控制器 (稳定版) ---
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

  isBurmese(text) {
    return /[\u1000-\u109F]/.test(text);
  },

  // 获取应该使用的语音包
  getVoice(text, isTitle) {
    // 1. 标题强制使用 Ava
    if (isTitle) return 'en-US-AvaMultilingualNeural';
    
    // 2. 检查是否包含缅文
    if (this.isBurmese(text)) {
      // 包含缅文 -> 使用 Ava
      return 'en-US-AvaMultilingualNeural'; 
    }
    
    // 3. 全是中文 -> 使用晓悠
    return 'zh-CN-XiaoyouMultilingualNeural';
  },

  async play(text, isTitle = false, rate = 1.0) {
    if (!text || !text.trim()) return;

    const myRequestId = ++this.latestRequestId;
    this.stop(); 

    // 移除特殊符号防止 TTS 读出来 (仅针对中文模式优化，Ava 模式通常不需要太严格过滤)
    // 但为了保险，还是去掉纯符号
    const textToRead = text.replace(/[^\u4e00-\u9fa5\u1000-\u109Fa-zA-Z0-9\s]/g, ''); 
    if (!textToRead.trim()) return;

    const voice = this.getVoice(text, isTitle);
    const cacheKey = `tts-${voice}-${textToRead}-${rate}`;
    let audioUrl;

    try {
      // 1. 查缓存
      const cachedBlob = await idb.get(cacheKey);
      if (myRequestId !== this.latestRequestId) return;

      if (cachedBlob) {
        audioUrl = URL.createObjectURL(cachedBlob);
      } else {
        // 2. 没缓存，请求接口
        const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${voice}&r=${rate > 1 ? 20 : 0}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
        const blob = await res.blob();
        
        if (myRequestId !== this.latestRequestId) return;
        
        await idb.set(cacheKey, blob);
        audioUrl = URL.createObjectURL(blob);
      }

      // 3. 播放
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      // 手机浏览器必须捕获 play 的错误 (因为自动播放策略)
      await audio.play().catch(e => console.log("Auto-play blocked (normal on mobile):", e));

      audio.onended = () => {
        if (this.currentAudio === audio) this.currentAudio = null;
        URL.revokeObjectURL(audioUrl);
      };

    } catch (e) {
      console.error("Audio playback error:", e);
    }
  },

  // 预加载逻辑保持一致
  async preload(text, isTitle = false) {
    if (!text || !text.trim()) return;
    const textToRead = text.replace(/[^\u4e00-\u9fa5\u1000-\u109Fa-zA-Z0-9\s]/g, '');
    if (!textToRead.trim()) return;

    const voice = this.getVoice(text, isTitle);
    const cacheKey = `tts-${voice}-${textToRead}-1.0`;

    try {
      const cachedBlob = await idb.get(cacheKey);
      if (cachedBlob) return;

      const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToRead)}&v=${voice}&r=0`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const blob = await res.blob();
        await idb.set(cacheKey, blob);
      }
    } catch (e) {
      console.error("Preload error:", e);
    }
  }
};

export const preloadNextLessonAudios = (texts = []) => {
    if (!Array.isArray(texts)) return;
    // 默认按照非标题逻辑预加载，如果需要更精确控制可以扩展参数
    Promise.allSettled(texts.map(text => audioController.preload(text, false)));
};


// --- 样式定义 (CSS) ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&display=swap');

  .xzt-container { 
    width: 100%; height: 100%; display: flex; flex-direction: column; 
    align-items: center; position: relative; padding: 0 16px; overflow-y: auto; 
  }
  
  .spacer { flex: 1; min-height: 5px; max-height: 30px; }

  /* 标题区域 */
  .xzt-question-title {
    padding: 16px;
    text-align: center;
    cursor: pointer;
    width: 100%;
    max-width: 480px;
    margin: 0 auto 10px auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    border-radius: 20px;
    transition: background-color 0.2s;
  }
  .xzt-question-title:active { background-color: #f9fafb; }

  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 16px; margin-bottom: 20px; background-color: #f9fafb; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }

  /* ✅ 修复：强制横向排列，自动换行 */
  .pinyin-box { 
    display: flex; 
    flex-wrap: wrap; 
    justify-content: center; 
    gap: 4px; 
    row-gap: 8px; 
    align-items: flex-end; 
    flex-direction: row !important; /* 强制横向 */
  }

  /* 单个字块：拼音在上，汉字在下，这里要是 column */
  .char-block { display: flex; flex-direction: column; align-items: center; }
  
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; height: 1.2em; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.3; }
  .my-text-title { font-family: 'Padauk', sans-serif; font-size: 1.6rem; font-weight: 700; color: #1e293b; line-height: 1.5; }

  /* 选项区域 */
  .xzt-options-grid { display: grid; grid-template-columns: 1fr; gap: 12px; width: 100%; max-width: 480px; padding-bottom: 140px; }
  
  .xzt-option-card {
    position: relative; background: #ffffff; border-radius: 20px; border: 2px solid #f1f5f9;
    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  .layout-text-only { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 16px; min-height: 64px; }
  .layout-with-image { display: flex; flex-direction: row; align-items: center; padding: 16px; min-height: 90px; }

  .opt-img-wrapper { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-right: 16px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  .opt-text-box { display: flex; flex-direction: column; justify-content: center; width: 100%; }
  .layout-text-only .opt-text-box { align-items: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }

  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-my { font-family: 'Padauk', sans-serif; font-size: 1.3rem; font-weight: 600; color: #334155; }

  /* 底部固定区域 */
  .fixed-bottom-area { position: fixed; bottom: 90px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: 60; padding: 0 20px; }
  
  .explanation-card { 
    background: #fff; border: 1px solid #fecaca; background-color: #fef2f2; 
    color: #b91c1c; padding: 12px 16px; border-radius: 16px; margin-bottom: 12px; 
    font-size: 0.95rem; line-height: 1.4; text-align: left; width: 100%; 
    max-width: 480px; pointer-events: auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); 
    display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out; 
  }

  .submit-btn { 
    pointer-events: auto; min-width: 150px; padding: 14px 30px; border-radius: 100px; 
    font-size: 1.1rem; font-weight: 800; color: white; 
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); 
    box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4); border: none; transition: all 0.2s; 
  }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; transform: translateY(20px); opacity: 0; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
        return { char, pinyin: pinyins[pyIndex++] || '' };
      }
      return { char, pinyin: '' };
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionData, setQuestionData] = useState({ displayParts: [] });
  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 分割混合文本
  const generateDisplayParts = (text) => {
    if(!text) return [];
    // 匹配: 缅文块 OR 中文块 OR 其他(空格/英文/标点)
    const regex = /([\u1000-\u109F]+|[\u4e00-\u9fa5]+|[^ \u4e00-\u9fa5\u1000-\u109F]+)/g;
    const parts = text.match(regex) || [];
    return parts.map(part => {
        if (/[\u1000-\u109F]/.test(part)) return { type: 'my', text: part };
        if (/[\u4e00-\u9fa5]/.test(part)) return { type: 'zh', text: part, pinyinData: generatePinyinData(part) };
        return { type: 'other', text: part };
    });
  }

  useEffect(() => {
    // 切换题目时停止上一段音频
    audioController.stop();

    setQuestionData({ displayParts: generateDisplayParts(question.text) });
    
    const processed = options.map(opt => ({
      ...opt,
      displayParts: generateDisplayParts(opt.text),
      hasImage: !!opt.imageUrl
    }));

    setShuffledOptions([...processed].sort(() => Math.random() - 0.5));

    // 自动播放题目 (参数: text, isTitle=true)
    if (question.text) {
      setIsPlaying(true);
      audioController.play(question.text, true, 0.9).finally(() => setIsPlaying(false));
    }

    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    return () => audioController.stop();
  }, [question, options]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    if (showExplanation) setShowExplanation(false);
    // 点击选项朗读 (参数: text, isTitle=false)
    if (option.text) audioController.play(option.text, false, 0.95);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      
      // ✅ 答错显示解析并朗读
      if (explanation) {
        setShowExplanation(true);
        // 延迟 500ms 等 UI 渲染后再读
        setTimeout(() => {
           // 解析通常也是混合文本，按 isTitle=false 处理，会自动判断是否含缅语
           audioController.play(explanation, false, 0.9);
        }, 500);
      }
      
      // 2秒后允许重选
      setTimeout(() => setIsSubmitted(false), 2000);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    // 点击标题朗读 (isTitle=true -> 强制使用 Ava)
    audioController.play(question.text, true, 0.9).finally(() => setIsPlaying(false));
  };

  // ✅ 修复：渲染文本块的逻辑
  const renderTextParts = (parts, isTitle = false) => (
    // 外层容器：Flex Row (横向)，Wrap (换行)
    // 之前的 bug 是这里用了 column 导致文字竖着排
    <div 
        className={isTitle ? "pinyin-box" : "opt-text-box"}
        style={{ 
            display: 'flex', 
            flexDirection: 'row', // 确保从左到右排列
            flexWrap: 'wrap',     // 确保超出换行
            alignItems: isTitle ? 'flex-end' : 'center',
            justifyContent: isTitle ? 'center' : 'flex-start' 
        }}
    >
        {parts.map((part, index) => {
            // 渲染中文块 (含拼音)
            if (part.type === 'zh') {
                return (
                    <span key={index} style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center' }}>
                        {part.pinyinData.map((item, idx) => (
                             // char-block 内部是 column (拼音在上，汉字在下)
                             <div key={idx} className="char-block">
                                <span className={isTitle ? "py-text" : "opt-pinyin"}>{item.pinyin || ' '}</span>
                                <span className={isTitle ? "cn-text" : "opt-cn"}>{item.char}</span>
                            </div>
                        ))}
                    </span>
                );
            }
            // 渲染缅文块
            if (part.type === 'my') {
                return (
                    <span key={index} className={isTitle ? "my-text-title" : "opt-my"} style={{ margin: '0 4px' }}>
                        {part.text}
                    </span>
                );
            }
            // 渲染其他 (英文/数字/标点)
            return (
                <span key={index} className={isTitle ? "cn-text" : "opt-cn"} style={{ margin: '0 2px' }}>
                    {part.text}
                </span>
            );
        })}
    </div>
  );

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        <div className="spacer" />
        
        {/* 标题 */}
        <div className="xzt-question-title" onClick={handleReadQuestion}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          <div className="absolute top-4 right-4 text-slate-400">
            <FaVolumeUp size={20} className={isPlaying ? 'icon-pulse' : ''} />
          </div>
          {renderTextParts(questionData.displayParts, true)}
        </div>

        <div className="spacer" />

        {/* 选项 */}
        <div className="xzt-options-grid">
          {shuffledOptions.map(option => {
            const optIdStr = String(option.id);
            const selIdStr = String(selectedId);
            const correctIds = correctAnswer.map(String);
            let statusClass = '';
            
            if (isSubmitted) {
              if (correctIds.includes(optIdStr)) statusClass = 'correct';
              else if (optIdStr === selIdStr) statusClass = 'incorrect';
            } else if (optIdStr === selIdStr) {
              statusClass = 'selected';
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
                        <img src={option.imageUrl} alt="option" className="opt-img" />
                    </div>
                )}
                
                {/* 这里的 renderTextParts 已经修复了布局方向 */}
                {renderTextParts(option.displayParts, false)}

                {isSubmitted && correctIds.includes(optIdStr) && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && optIdStr === selIdStr && !correctIds.includes(optIdStr) && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
              </div>
            );
          })}
        </div>

        {/* 底部固定区域 */}
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
            disabled={!selectedId || (isSubmitted && !showExplanation)}
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
