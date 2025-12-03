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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
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

// --- 2. 增强版音频控制器 (支持混合语种无缝播放) ---
const audioController = {
  currentAudio: null,
  playlist: [], // 存放待播放的 Audio 对象队列
  latestRequestId: 0,

  stop() {
    // 停止当前正在播放的
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    // 清空队列
    this.playlist.forEach(a => { a.pause(); a = null; });
    this.playlist = [];
    this.latestRequestId++;
  },

  // 简单的语种检测
  detectLanguage(text) {
    // 缅文 Unicode 范围
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    return 'zh'; // 默认为中文/其他
  },

  // 获取单个片段的音频 Blob
  async fetchAudioBlob(text, lang, rate) {
    const voice = lang === 'my' ? 'en-US-AvaMultilingualNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    // 针对混合朗读，语速稍微快一点点更自然
    const cacheKey = `tts-${voice}-${text}-${rate}`;
    
    // 1. 查缓存
    const cached = await idb.get(cacheKey);
    if (cached) return cached;

    // 2. 请求 API
    const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate > 1 ? 20 : 0}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('TTS Fetch failed');
    const blob = await res.blob();
    
    // 3. 存缓存
    await idb.set(cacheKey, blob);
    return blob;
  },

  // ✅ 核心：解析混合文本并无缝播放
  async playMixed(text, rate = 1.0) {
    this.stop();
    if (!text) return;
    const reqId = ++this.latestRequestId;

    // 1. 分割文本：按连续的缅文或非缅文分割
    // 正则逻辑：匹配一段连续的缅文，或者一段连续的非缅文
    const segments = [];
    // 简单清洗，保留标点但去除无意义符号，保留引号
    const cleanText = text.replace(/[^\p{L}\p{N}\s\u201c\u201d\u2018\u2019"']/gu, '');
    
    let currentStr = '';
    let currentLang = null;

    for (const char of cleanText) {
      const charLang = this.detectLanguage(char);
      if (charLang !== currentLang && currentStr) {
        segments.push({ text: currentStr.trim(), lang: currentLang });
        currentStr = '';
      }
      currentLang = charLang;
      currentStr += char;
    }
    if (currentStr) segments.push({ text: currentStr.trim(), lang: currentLang });

    if (segments.length === 0) return;

    try {
      // 2. 并行预加载所有片段的 Blob (减少播放时的等待间隙)
      const blobs = await Promise.all(
        segments.map(seg => this.fetchAudioBlob(seg.text, seg.lang, rate))
      );

      if (reqId !== this.latestRequestId) return; // 如果由于新的播放请求，当前请求已过期

      // 3. 构建播放链
      const audioObjects = blobs.map(blob => new Audio(URL.createObjectURL(blob)));
      this.playlist = audioObjects;

      // 递归播放函数
      const playNext = (index) => {
        if (reqId !== this.latestRequestId) return;
        if (index >= audioObjects.length) {
            this.currentAudio = null;
            return;
        }

        const audio = audioObjects[index];
        this.currentAudio = audio;
        
        audio.onended = () => {
          // 释放内存
          // URL.revokeObjectURL(audio.src); // 暂时不释放，以防快速重播
          playNext(index + 1);
        };
        
        audio.play().catch(e => console.error("Play error:", e));
      };

      // 4. 开始播放
      playNext(0);

    } catch (e) {
      console.error("Mixed TTS Error:", e);
    }
  }
};

// --- 3. 样式定义 (CSS) ---
const cssStyles = `
  .xzt-container {
    font-family: "Noto Sans Myanmar", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 20px 16px 120px 16px; /* 底部 padding 留给固定区域 */
    overflow-y: auto;
    overscroll-behavior: none;
    background-color: #fff;
  }

  /* 标题区域 */
  .xzt-question-area {
    text-align: center;
    cursor: pointer;
    width: 100%;
    max-width: 500px;
    margin: 10px auto 20px auto;
    padding: 10px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  
  .question-img { width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; background-color: #f9fafb; margin-bottom: 8px; }
  .icon-pulse { animation: pulse 1.5s infinite; color: #8b5cf6; }

  /* 拼音文字块 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; row-gap: 8px; align-items: flex-end; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; min-height: 1em;}
  /* ✅ 字体调整：调小标题字体，去除过大的感觉 */
  .cn-text { font-size: 1.5rem; font-weight: 600; color: #1e293b; line-height: 1.3; }
  /* 标点符号特殊处理，防止字体回退 */
  .punctuation { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }

  /* 选项列表 */
  .xzt-options-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 500px;
  }

  .xzt-option-card {
    position: relative; background: #ffffff; border-radius: 16px; border: 2px solid #f1f5f9;
    box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.05); cursor: pointer; transition: all 0.2s ease; overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; animation: correctAnswerBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }

  .layout-text-only { padding: 14px 16px; min-height: 60px; display: flex; align-items: center; justify-content: center; text-align: center;}
  .layout-with-image { padding: 12px; display: flex; align-items: center; text-align: left; }

  .opt-img-wrapper { width: 60px; height: 60px; border-radius: 10px; overflow: hidden; background: #f3f4f6; margin-right: 14px; flex-shrink: 0; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  .opt-text-box { display: flex; flex-direction: column; width: 100%; }
  .layout-text-only .opt-text-box { align-items: center; }
  
  .opt-pinyin { font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px; }
  .opt-cn { font-size: 1.15rem; font-weight: 600; color: #334155; line-height: 1.2; }
  .opt-my { font-size: 1.1rem; font-weight: 500; color: #475569; }

  /* 底部固定区域 (按钮 + 解析) */
  .fixed-bottom-area {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 50;
    display: flex;
    flex-direction: column-reverse; /* 解析在按钮上方 */
    align-items: center;
    padding: 10px 20px calc(20px + env(safe-area-inset-bottom));
    background: linear-gradient(to top, rgba(255,255,255,1) 80%, rgba(255,255,255,0));
    pointer-events: none; /* 让渐变层不阻挡点击，子元素开启 pointer-events */
  }

  /* ✅ 解析卡片 */
  .explanation-card {
    pointer-events: auto;
    background-color: #fff1f2; color: #be123c;
    padding: 12px 16px; margin-bottom: 12px;
    border-radius: 12px; font-size: 0.95rem; line-height: 1.4; text-align: left;
    width: 100%; max-width: 500px;
    box-shadow: 0 4px 12px rgba(225, 29, 72, 0.15);
    display: flex; align-items: flex-start; gap: 10px;
    border: 1px solid #fecaca;
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ✅ 提交按钮优化 */
  .submit-btn {
    pointer-events: auto;
    width: 80%; max-width: 280px; /* 限制宽度 */
    padding: 14px 0;
    border-radius: 50px;
    font-size: 1.05rem; font-weight: 700; color: white; border: none;
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    box-shadow: 0 8px 20px -6px rgba(99, 102, 241, 0.5);
    transition: all 0.2s;
  }
  .submit-btn:disabled { 
    background: #e2e8f0; color: #cbd5e1; box-shadow: none; 
    transform: translateY(10px); opacity: 0; /* 禁用时隐藏 */
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.96); }

  /* 动画 */
  @keyframes correctAnswerBounce { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
`;

// --- 4. 工具函数 ---
const isChineseChar = (char) => /\p{Script=Han}/u.test(char);

// 生成拼音数据，特意处理标点符号
const generateTextData = (text) => {
  if (!text) return [];
  // 移除可能导致拼音库异常的字符，但保留引号
  const cleanText = text; 
  try {
    // 使用 pinyin-pro，nonZh: 'consecutive' 会把非中文字符作为整体数组元素返回
    // 但我们需要逐字对齐，所以这里还是逐字处理比较稳妥
    const chars = cleanText.split('');
    const pinyins = pinyin(cleanText, { 
      type: 'array', 
      toneType: 'symbol',
      nonZh: 'removed' // 非中文直接移除，我们自己通过 index 对应
    });
    
    let pyIndex = 0;
    return chars.map((char) => {
        // 判断是否是中文
        if (isChineseChar(char)) {
            return { char, pinyin: pinyins[pyIndex++] || '' };
        }
        // 如果是双引号等标点，不生成拼音
        return { char, pinyin: '' };
    });
  } catch (e) {
    return cleanText.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

// --- 5. 主组件 ---
const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect, onIncorrect, explanation }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [questionData, setQuestionData] = useState([]);
  const [orderedOptions, setOrderedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // 用于防止快速点击多次提交
  const processingRef = useRef(false);

  // 初始化题目
  useEffect(() => {
    audioController.stop();
    setIsPlaying(false);
    processingRef.current = false;
    
    // 生成标题数据 (支持自动拼音)
    setQuestionData(generateTextData(question.text));

    // 处理选项数据
    const processed = options.map(opt => {
      const lang = audioController.detectLanguage(opt.text);
      return {
        ...opt,
        textData: lang === 'zh' ? generateTextData(opt.text) : [],
        lang: lang,
        hasImage: !!opt.imageUrl
      };
    });
    setOrderedOptions(processed);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    // 自动播放题目音频 (混合语种)
    if (question.text) {
      setIsPlaying(true);
      audioController.playMixed(question.text, 0.9).finally(() => {
        // 这里很难准确捕获 playlist 全部播放完的时刻，
        // 简化处理：UI 高亮 2 秒后消失，或者不管它
        setTimeout(() => setIsPlaying(false), 2000);
      });
    }

    return () => audioController.stop();
  }, [question, options]); // 当 question 变化时重置

  // 选中逻辑
  const handleSelect = (option) => {
    if (isSubmitted) return;
    setSelectedId(option.id);
    
    // 简单的选中震动
    if (navigator.vibrate) navigator.vibrate(15);
    
    // 朗读选项
    audioController.playMixed(option.text, 0.9);
  };

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted || processingRef.current) return;
    processingRef.current = true;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      // --- 答对 ---
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 }, colors: ['#a78bfa', '#34d399', '#ffbbf24'] });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      
      // 1.5秒后下一题
      setTimeout(() => {
        if (onCorrect) onCorrect();
      }, 1500);

    } else {
      // --- 答错 ---
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // 答错震动

      // 1. 显示解析
      if (explanation) {
        setShowExplanation(true);
        // 2. 延迟一点点播放解析音频，避免和“错误音效”重叠太厉害
        setTimeout(() => {
           audioController.playMixed(explanation, 0.95);
        }, 600);
      }

      // 3. 自动进入下一题逻辑
      // 这里的逻辑是：给用户时间看解析，播放完解析后，再触发 onIncorrect (用于重随该题)
      // 如果解析很长，最好能检测音频结束。这里用一个预估时间:
      // 假设每秒读 4 个字 + 2秒缓冲，或者固定 4000ms 如果解析短。
      const delayTime = explanation ? Math.max(3000, explanation.length * 300) : 2000;
      
      setTimeout(() => {
        if (onIncorrect) {
            // 传递当前题目，告知父组件“这道题做错了，请把它加回队列并在随机位置再次出现”
            onIncorrect(question);
        }
      }, delayTime + 1000); 
    }
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* 标题区 */}
        <div className="xzt-question-area" onClick={() => audioController.playMixed(question.text)}>
          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}
          
          <div className="absolute top-2 right-2 text-slate-400 p-2">
            <FaVolumeUp size={20} className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {questionData.map((item, idx) => (
              <div key={idx} className="char-block">
                {/* 只有非空且非标点才有拼音 */}
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                {/* 根据是否是标点应用 class，防止引号变成 99 66 */}
                <span className={`cn-text ${isChineseChar(item.char) ? '' : 'punctuation'}`}>
                    {item.char}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 选项区 */}
        <div className="xzt-options-grid">
          {orderedOptions.map(option => {
            let statusClass = '';
            const isSelected = String(option.id) === String(selectedId);
            const isCorrectAnswer = correctAnswer.map(String).includes(String(option.id));

            if (isSubmitted) {
              if (isCorrectAnswer) statusClass = 'correct'; 
              else if (isSelected) statusClass = 'incorrect';
            } else if (isSelected) {
              statusClass = 'selected';
            }

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${option.hasImage ? 'layout-with-image' : 'layout-text-only'} ${statusClass}`}
                onClick={() => handleSelect(option)}
              >
                {option.hasImage && (
                  <div className="opt-img-wrapper">
                    <img src={option.imageUrl} alt="" className="opt-img" />
                  </div>
                )}
                
                <div className="opt-text-box">
                  {option.lang === 'zh' ? (
                    <>
                      <div className="opt-pinyin">{option.textData.map(d => d.pinyin).join(' ')}</div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className={option.lang === 'my' ? 'opt-my' : 'opt-cn'}>{option.text}</div>
                  )}
                </div>

                {isSubmitted && isCorrectAnswer && <FaCheckCircle className="text-green-500 absolute right-4 text-xl"/>}
                {isSubmitted && isSelected && !isCorrectAnswer && <FaTimesCircle className="text-red-500 absolute right-4 text-xl"/>}
              </div>
            );
          })}
        </div>
        
        {/* 底部固定区：解析卡片 + 提交按钮 */}
        <div className="fixed-bottom-area">
           <button className="submit-btn" onClick={handleSubmit} disabled={!selectedId || isSubmitted}>
            提 交
          </button>

          {showExplanation && explanation && (
            <div className="explanation-card">
               <FaLightbulb className="flex-shrink-0 mt-1 text-red-500" size={18} />
               <div>{explanation}</div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
