import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb, FaSpinner, FaStop } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (用于缓存单个音频片段) =====
// =================================================================================
const DB_NAME = 'MixedAudioSegmentCache'; 
const STORE_NAME = 'audio_segments';
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

// =================================================================================
// ===== 2. 混合 TTS 核心 Hook (音频控制) =====
// =================================================================================
const useMixedTTS = () => {
    const audioCtxRef = useRef(null);
    const sourceRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const [playingId, setPlayingId] = useState(null);

    // 初始化 AudioContext
    useEffect(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContext();
        }
        return () => {
            stop();
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(()=>{});
            }
        };
    }, []);

    // 文本拆分：中文 / 缅文 / 其他
    const splitMixedText = (text) => {
        const regex = /([\u1000-\u109F\s]+)|([\u4e00-\u9fa5a-zA-Z0-9\s]+)|([^\u1000-\u109F\u4e00-\u9fa5a-zA-Z0-9\s]+)/g;
        const segments = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            const myanmarText = match[1];
            const chineseText = match[2];
            const otherText = match[3];

            if (myanmarText) {
                segments.push({ lang: 'mm', text: myanmarText.trim() });
            } else if (chineseText) {
                segments.push({ lang: 'zh', text: chineseText.trim() });
            } else if (otherText && segments.length > 0) {
                segments[segments.length - 1].text += otherText;
            }
        }
        return segments.filter(s => s.text);
    };

    const fetchSegmentAudio = async (text, lang) => {
        const voice = lang === 'mm' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
        const cacheKey = `tts-segment-${lang}-${text}`;
        
        const cachedBlob = await idb.get(cacheKey);
        if (cachedBlob) return cachedBlob;

        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TTS Fetch Failed`);
        const blob = await res.blob();
        await idb.set(cacheKey, blob);
        return blob;
    };
    
    const decodeAndConcat = async (blobs) => {
        const ctx = audioCtxRef.current;
        if (!ctx) return null;
        const arrayBuffers = await Promise.all(blobs.map(blob => blob.arrayBuffer()));
        const decodedBuffers = await Promise.all(arrayBuffers.map(ab => ctx.decodeAudioData(ab.slice(0))));
        
        let totalLen = 0;
        decodedBuffers.forEach(b => totalLen += b.length);
        if (totalLen === 0) return null;

        const output = ctx.createBuffer(1, totalLen, decodedBuffers[0].sampleRate);
        let offset = 0;
        for (const buf of decodedBuffers) {
            output.getChannelData(0).set(buf.getChannelData(0), offset);
            offset += buf.length;
        }
        return output;
    };

    const playAudioBuffer = (buffer, id) => {
        if (!buffer) {
            setLoadingId(null);
            return;
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        // 彻底停止前一个音频
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch(e){}
            try { sourceRef.current.disconnect(); } catch(e){}
            sourceRef.current = null;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => {
            if (playingId === id) { 
                setIsPlaying(false);
                setPlayingId(null);
            }
        };
        
        sourceRef.current = source;
        source.start(0);
        setPlayingId(id);
        setIsPlaying(true);
        setLoadingId(null);
    };

    const stop = useCallback(() => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
                sourceRef.current.disconnect();
            } catch (e) {}
            sourceRef.current = null;
        }
        setIsPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
    }, []);

    const play = useCallback(async (text, uniqueId) => {
        // 如果点击的是当前正在播放的，则停止
        if (playingId === uniqueId) {
            stop();
            return;
        }

        // 无论如何，先强制停止之前的播放
        stop(); 

        if (!text || typeof text !== 'string') return;
        setLoadingId(uniqueId);

        try {
            const cleanText = text.replace(/【.*?】/g, '').trim();
            const segments = splitMixedText(cleanText);
            if (segments.length === 0) {
                setLoadingId(null);
                return;
            }

            const blobPromises = segments.map(seg => fetchSegmentAudio(seg.text, seg.lang));
            const audioBlobs = await Promise.all(blobPromises);
            const concatenatedBuffer = await decodeAndConcat(audioBlobs);
            
            // 再次检查ID，防止请求过程中用户切题
            playAudioBuffer(concatenatedBuffer, uniqueId);

        } catch (e) {
            console.error("TTS Play Error:", e);
            setLoadingId(null);
        }
    }, [playingId, stop]);
    
    const preload = useCallback((text) => {
        if (!text || typeof text !== 'string') return;
        const cleanText = text.replace(/【.*?】/g, '').trim();
        const segments = splitMixedText(cleanText);
        segments.forEach(seg => {
             fetchSegmentAudio(seg.text, seg.lang).catch(() => {});
        });
    }, []);

    return { play, stop, isPlaying, playingId, loadingId, preload };
}

// ==========================================
// 3. 样式定义 (修复标题、按钮、点击区域)
// ==========================================
const cssStyles = `
  html, body { overscroll-behavior: none; touch-action: pan-x pan-y; height: 100%; overflow: hidden; }
  
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
    padding: 24px 20px; 
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
  .icon-pulse { animation: pulse 1.2s infinite; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  /* 标题混合排版 */
  .title-mixed-box {
    display: flex; 
    flex-wrap: wrap; 
    justify-content: center; 
    gap: 4px; 
    row-gap: 8px;
    align-items: flex-end;
    margin-top: 4px;
    line-height: 1.4;
  }
  .char-block { display: flex; flex-direction: column; align-items: center; min-width: 1.2em; }
  .py-text { font-size: 0.85rem; color: #64748b; font-family: monospace; margin-bottom: -2px; min-height: 1rem; line-height: 1; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.25; }
  .mm-text { font-size: 1.3rem; font-weight: 600; color: #334155; line-height: 1.4; margin-bottom: 2px; }

  /* 选项列表 */
  .xzt-options-grid { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 460px; padding-bottom: 180px; }
  
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
  .xzt-option-card.correct { border-color: #22c55e; background: #f0fdf4; animation: success-pop 0.5s ease-out forwards; }
  .xzt-option-card.incorrect { border-color: #ef4444; background: #fef2f2; animation: shake 0.4s; }
  @keyframes success-pop { 0% { transform: scale(1); } 40% { transform: scale(1.05); box-shadow: 0 0 20px rgba(34, 197, 94, 0.3); } 100% { transform: scale(1); } }
  
  .layout-text-only { padding: 14px 20px; } 
  .layout-with-image { padding: 12px; }
  
  .opt-img-wrapper { width: 48px; height: 48px; border-radius: 10px; overflow: hidden; background: #f1f5f9; margin-right: 14px; flex-shrink: 0; pointer-events: none; }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  
  .opt-text-box { flex: 1; display: flex; flex-direction: column; justify-content: center; min-width: 0; word-break: break-word; pointer-events: none; }
  .layout-text-only .opt-text-box { align-items: center; text-align: center; } 
  .layout-with-image .opt-text-box { align-items: flex-start; text-align: left; }
  
  .opt-pinyin { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: 2px; line-height: 1.1; }
  .opt-cn { font-size: 1.1rem; font-weight: 700; color: #334155; line-height: 1.3; }
  .opt-en, .opt-mm { font-size: 1.05rem; font-weight: 600; color: #475569; }

  /* 底部固定区域 (优化按钮) */
  .fixed-bottom-area { 
    position: fixed; 
    bottom: 80px; 
    left: 0; 
    right: 0; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    z-index: 100; 
    pointer-events: none; /* 让点击穿透空白区域 */
    padding: 0 20px;
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
    pointer-events: auto; /* 恢复按钮点击 */
    width: auto; /* 改为自适应宽度 */
    min-width: 200px; /* 最小宽度 */
    max-width: 80%; /* 最大宽度 */
    padding: 12px 40px; /* 舒适的内边距 */
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
  .submit-btn:disabled { background: #e2e8f0; color: #cbd5e1; box-shadow: none; cursor: not-allowed; }
  .submit-btn:active:not(:disabled) { transform: scale(0.97); }

  .status-icon { position: absolute; right: 12px; font-size: 20px; }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// ==========================================
// 4. 辅助函数 (保持不变)
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
// 5. 标题渲染组件 (支持拼音+缅文)
// ==========================================
const QuestionTitle = ({ text }) => {
    if (!text) return null;
    
    // 正则分割：中文 vs 非中文
    const regex = /([\u4e00-\u9fa5]+)|([^\u4e00-\u9fa5]+)/g;
    const parts = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        parts.push({ text: match[0], isChinese: !!match[1] });
    }

    return (
        <div className="title-mixed-box">
            {parts.map((part, i) => {
                if (part.isChinese) {
                    const tokens = pinyin(part.text, { type: 'array', toneType: 'symbol' });
                    return part.text.split('').map((char, cI) => (
                        <div key={`${i}-${cI}`} className="char-block">
                            <span className="py-text">{tokens[cI]}</span>
                            <span className="cn-text">{char}</span>
                        </div>
                    ));
                } else {
                    return <span key={i} className="mm-text">{part.text}</span>;
                }
            })}
        </div>
    );
};

// ==========================================
// 6. 主组件
// ==========================================
const XuanZeTi = ({ 
  question, options, correctAnswer, onNext, explanation, allQuestions = [], currentIndex = 0,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [displayOptions, setDisplayOptions] = useState([]);
  const isMounted = useRef(true);
  
  const { play, stop, playingId, loadingId, preload } = useMixedTTS();

  useEffect(() => {
    isMounted.current = true;
    const preventPullToRefresh = (e) => {
      if (window.scrollY === 0 && e.touches[0].clientY > e.touches[0].target.offsetTop) {
        if(e.cancelable) e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => { isMounted.current = false; document.removeEventListener('touchmove', preventPullToRefresh); };
  }, []);

  useEffect(() => {
    if (!question) return;

    stop(); // 切换题目时强制停止音频

    const sourceOptions = question.choices || options || [];
    const processed = sourceOptions.map(opt => ({ ...opt, hasImage: !!opt.imageUrl }));

    setDisplayOptions(processed);
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    setTimeout(() => {
      if (isMounted.current && question.prompt) {
        play(question.prompt, `question_${question.id || currentIndex}`);
      }
    }, 500);

  }, [question, currentIndex, play, stop]); 

  // 预加载逻辑
  useEffect(() => {
    if (!allQuestions || allQuestions.length === 0 || currentIndex >= allQuestions.length - 1) return;

    const precacheTask = setTimeout(() => {
        const nextQuestions = allQuestions.slice(currentIndex + 1, currentIndex + 1 + 6); 
        nextQuestions.forEach(q => {
            const content = q.content || q;
            if (content.prompt) preload(content.prompt);
            if (content.explanation) preload(content.explanation);
            (content.choices || []).forEach(choice => {
                if (choice.text) preload(choice.text);
            });
        });
    }, 800);

    return () => clearTimeout(precacheTask);
  }, [currentIndex, allQuestions, preload]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    if (navigator.vibrate) try { navigator.vibrate(30); } catch(e){}
    setSelectedId(option.id);
    if (option.text) play(option.text, `option_${option.id}`);
  };

  const handleSubmit = (e) => {
    e && e.stopPropagation();
    if (!selectedId || isSubmitted) return;

    setIsSubmitted(true);
    const correctIds = getCorrectIds(question, correctAnswer || question.correctId);
    const isCorrect = correctIds.includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.65 }, colors: ['#a78bfa', '#34d399', '#fcd34d'] });
      try { new Audio('/sounds/correct.mp3').play().catch(()=>{}); } catch (e) {}
      if (onNext) setTimeout(() => { if(isMounted.current) onNext({ correct: true, question }); }, 1200);
    } else {
      try { new Audio('/sounds/incorrect.mp3').play().catch(()=>{}); } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(200);
      const explainText = explanation || question.explanation;
      if (explainText) {
        setShowExplanation(true);
        setTimeout(() => {
          if(isMounted.current) play(explainText, `explanation_${question.id || currentIndex}`);
        }, 600);
      }
      setTimeout(() => { if(isMounted.current) setIsSubmitted(false); }, 2500);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    play(question.prompt, `question_${question.id || currentIndex}`);
  };

  // 选项文本渲染 (混合排版)
  const MixedLanguageText = ({ text }) => {
    if (!text) return null;
    const parts = text.split(/([()])/).filter(Boolean); 
    return (
      <>
        {parts.map((part, index) => {
          if (part === '(' || part === ')') return <span key={index} style={{ margin: '0 2px' }}>{part}</span>;
          const isMyanmar = /[\u1000-\u109F]/.test(part);
          return <span key={index} className={isMyanmar ? 'opt-mm' : 'opt-en'}>{part}</span>;
        })}
      </>
    );
  };

  if (!question) return null;
  
  const questionId = `question_${question.id || currentIndex}`;
  const isCurrentLoading = loadingId === questionId;
  const isCurrentPlaying = playingId === questionId;

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        <div className="spacer" />

        {/* 题目卡片 */}
        <div className="xzt-question-card" onClick={handleReadQuestion}>
          <div style={{position:'absolute', top:16, right:16, color: isCurrentPlaying ? '#8b5cf6' : '#cbd5e1', transition:'color 0.3s'}}>
            {isCurrentLoading ? <FaSpinner className="spin" size={20} /> : (isCurrentPlaying ? <FaStop size={20}/> : <FaVolumeUp size={20} />) }
          </div>
          {question.imageUrl && <img src={question.imageUrl} alt="Q" className="question-img" />}
          
          {/* 新的标题渲染组件，支持拼音+缅文 */}
          <QuestionTitle text={question.prompt} />
        </div>

        <div className="spacer" />

        {/* 选项区域 */}
        <div className="xzt-options-grid">
          {displayOptions.map(option => {
            let statusClass = '';
            const optId = String(option.id);
            const selId = String(selectedId);
            const corrIds = getCorrectIds(question, correctAnswer || question.correctId);

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
                    // 必须停止冒泡，否则可能会触发到其他层级的点击
                    e.stopPropagation();
                    handleSelect(option);
                }}
              >
                {option.hasImage && (
                  <div className="opt-img-wrapper">
                    <img src={option.imageUrl} alt="opt" className="opt-img" />
                  </div>
                )}
                <div className="opt-text-box">
                  <MixedLanguageText text={option.text} />
                </div>
                {isSubmitted && corrIds.includes(optId) && <FaCheckCircle className="status-icon" style={{color:'#22c55e'}}/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && <FaTimesCircle className="status-icon" style={{color:'#ef4444'}}/>}
              </div>
            );
          })}
        </div>

        {/* 底部按钮区域 */}
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
                ? (getCorrectIds(question, correctAnswer || question.correctId).includes(String(selectedId)) ? "正确" : "请重试") 
                : "确认"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
