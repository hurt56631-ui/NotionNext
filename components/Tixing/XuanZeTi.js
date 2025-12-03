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
        if (res && res.size > 0) resolve(res);
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

// --- 2. 音频控制器 (修复了标点符号导致崩溃的问题) ---
const audioController = {
  currentAudio: null,
  playlist: [],
  activeBlobUrls: [], 
  latestRequestId: 0,

  stop() {
    // 停止当前播放
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    // 清理内存
    if (this.activeBlobUrls.length > 0) {
      this.activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
      this.activeBlobUrls = [];
    }

    this.playlist = [];
    this.latestRequestId++;
  },

  detectLanguage(text) {
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh';
  },

  async fetchAudioBlob(text, lang) {
    const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const rateParam = 0; 
    
    // 缓存 Key
    const cacheKey = `tts-${voice}-${text}-${rateParam}`;

    // 1. 查缓存
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    // 2. 联网下载
    console.log(`[Audio] Fetching network: "${text}"`);
    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rateParam}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`TTS Fetch failed: ${res.status}`);
    const blob = await res.blob();
    
    // 3. 检查文件大小 (如果是空文件，返回 null，不要报错)
    if (blob.size === 0) {
      console.warn(`[Audio] Empty blob received for: "${text}"`);
      return null; 
    }
    
    await idb.set(cacheKey, blob);
    return blob;
  },

  async playMixed(text, onStart, onEnd) {
    this.stop(); 
    if (!text) return;
    const reqId = ++this.latestRequestId;

    if (onStart) onStart();

    const segments = [];
    // 正则分割：中文 vs 其他
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5\s]+)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const segmentText = match[0].trim();
      
      // ★★★ 核心修复：过滤掉纯标点符号 ★★★
      // 只要不包含 汉字、字母、数字、缅文 中的任意一个，就视为无效片段
      const isValidContent = /[\u4e00-\u9fa5a-zA-Z0-9\u1000-\u109F]/.test(segmentText);
      
      if (segmentText && isValidContent) {
        const lang = this.detectLanguage(segmentText);
        segments.push({ text: segmentText, lang });
      } else {
        console.log(`[Audio] Skipped punctuation/symbol: "${segmentText}"`);
      }
    }

    if (segments.length === 0) {
      console.warn('[Audio] No playable segments found.');
      if (onEnd) onEnd();
      return;
    }

    try {
      // 并行下载
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang))
      );
      
      if (reqId !== this.latestRequestId) return;

      // 过滤掉下载失败的 (null)
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

      // 创建 Audio 对象
      const audioObjects = validBlobs.map((blob, index) => {
        const url = URL.createObjectURL(blob);
        this.activeBlobUrls.push(url);

        const audio = new Audio(url);
        if (validSegments[index].lang === 'zh') {
          audio.playbackRate = 0.7; 
        } else {
          audio.playbackRate = 1.0;
        }
        return audio;
      });
      
      this.playlist = audioObjects;

      // 递归播放
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
        
        // 如果单个音频出错，自动跳下一个，不卡死
        audio.onerror = (e) => {
            console.error(`[Audio] Segment error, skipping...`, e);
            playNext(index + 1);
        };
        
        audio.onloadedmetadata = () => {
             if (validSegments[index].lang === 'zh') audio.playbackRate = 0.7;
        };
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("[Audio] Play prevented:", error);
                if (onEnd) onEnd();
            });
        }
      };
      
      // 开始播放第一个
      playNext(0);

    } catch (e) {
      console.error("[Audio] Fatal Load Error:", e);
      if (onEnd) onEnd();
    }
  }
};

// --- 3. 样式定义 ---
const cssStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Padauk:wght@400;700&family=Noto+Sans+SC:wght@400;600;700&family=Ma+Shan+Zheng&display=swap');

  /* 
     修复点：absolute + inset-0 
     强制容器占满整个浏览器视口，解决“点击下方空白处无效”的问题 
  */
  .xzt-container {
    font-family: "Padauk", "Noto Sans SC", sans-serif;
    position: absolute; 
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 24px 180px 24px; 
    overflow-y: auto;
    background-color: #fcfcfc;
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
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0; /* 防止被挤压 */
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
  }
  .question-img { 
    width: 100%; max-height: 220px; object-fit: contain; 
    border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }

  .rich-text-container {
    width: 100%; display: flex; flex-wrap: wrap;
    justify-content: center; align-items: flex-end;
    gap: 6px; line-height: 1.8; padding: 0 10px;
  }
  .cn-block { display: inline-flex; flex-direction: column; align-items: center; margin: 0 2px; position: relative; }
  .pinyin-top { font-size: 1rem; color: #64748b; font-family: monospace; font-weight: 500; height: 1.4em; margin-bottom: -2px; }
  .cn-char { font-size: 1.85rem; font-weight: 600; color: #1e293b; font-family: "Noto Sans SC", serif; line-height: 1.2; text-shadow: 1px 1px 0 rgba(0,0,0,0.02); }
  .other-text-block { font-size: 1.6rem; font-weight: 500; color: #334155; padding: 0 4px; display: inline-block; align-self: flex-end; margin-bottom: 4px; }
  .title-divider { width: 60px; height: 4px; background-color: #f1f5f9; border-radius: 2px; margin-top: 24px; }

  .xzt-options-grid { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 500px; padding-bottom: 20px; }
  
  .xzt-option-card {
    position: relative; background: #fff; border-radius: 20px; 
    border: 2px solid #e2e8f0;
    box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 6px 0 #cbd5e1; 
    cursor: pointer; transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex; align-items: center; justify-content: center;
    padding: 16px 20px; min-height: 72px;
    transform: translateY(0);
    user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
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
    pointer-events: none; z-index: 100; gap: 20px;
  }

  .submit-btn {
    pointer-events: auto; width: auto; min-width: 180px; padding: 14px 40px;
    border-radius: 99px; font-size: 1.1rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    transition: all 0.2s; user-select: none;
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
    /* 确保整个卡片可点击 */
    cursor: pointer;
    position: relative;
    z-index: 101; 
  }
  
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
  const [isPlaying, setIsPlaying] = useState(false);
  
  const activeExplanation = explanation || question.explanation || "";

  useEffect(() => {
    // 强制停止音频并清理内存
    audioController.stop();
    
    setIsPlaying(false);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTitleSegments(parseTitleText(question.text));
    setOrderedOptions(options.map(opt => ({
      ...opt,
      parsed: parseOptionText(opt.text),
      hasImage: !!opt.imageUrl
    })));

    // 自动朗读一次
    if (question.text) {
      handleTitlePlay(null, true); 
    }
  }, [question, options]);

  // 点击书本朗读
  const handleTitlePlay = (e, isAuto = false) => {
    if(e) e.stopPropagation(); 
    
    if (!isAuto && navigator.vibrate) navigator.vibrate(40);

    audioController.playMixed(
      question.text, 
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  };

  // 全局容器点击逻辑
  const handleGlobalClick = () => {
    console.log('[UI] Global Click Detected');
    if (isSubmitted) {
      const isCorrect = correctAnswer.map(String).includes(String(selectedId));
      if (!isCorrect && onIncorrect) {
        console.log('[UI] Triggering Next Question');
        onIncorrect(question);
      }
    }
  };

  // 选项点击
  const handleCardClick = (option) => {
    if (isSubmitted) return; 
    
    setSelectedId(option.id);
    if (navigator.vibrate) navigator.vibrate(20);
    audioController.playMixed(option.text);
  };

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;

    setIsSubmitted(true);
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      setTimeout(() => onCorrect && onCorrect(), 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      
      if (activeExplanation && activeExplanation.trim() !== '') {
        setShowExplanation(true);
        setTimeout(() => audioController.playMixed(activeExplanation), 500);
      } else {
        setShowExplanation(false);
      }
    }
  };

  return (
    <>
      <style>{cssStyles}</style>
      
      {/* 最外层容器点击事件 */}
      <div className="xzt-container" onClick={handleGlobalClick}>
        
        <div 
          className={`book-read-btn ${isPlaying ? 'playing' : ''}`} 
          onClick={handleTitlePlay}
        >
          <FaBookOpen />
        </div>

        <div className="xzt-question-area">
          {question.imageUrl && <img src={question.imageUrl} alt="" className="question-img" />}
          
          <div className="rich-text-container">
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
          
          <div className="title-divider"></div>
        </div>

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
                onClick={(e) => {
                  if (isSubmitted) {
                     // 不阻止冒泡，允许传递给容器触发下一题
                  } else {
                     e.stopPropagation(); 
                     handleCardClick(opt);
                  }
                }}
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
            onClick={(e) => {
              e.stopPropagation(); 
              handleSubmit();
            }}
            disabled={!selectedId}
          >
            提 交
          </button>

          {showExplanation && activeExplanation && (
            <div 
              className="explanation-card"
              onClick={handleGlobalClick} // 解析卡片也加上点击事件
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
