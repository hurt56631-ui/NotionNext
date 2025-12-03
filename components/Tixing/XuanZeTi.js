import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaLightbulb, FaSpinner, FaStop } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// =================================================================================
// ===== 1. IndexedDB 工具函数 (来自第一个版本，更健壮) =====
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
// ===== 2. 混合 TTS 核心 Hook (关键：解决无缝播放 + 实现预缓存) =====
// =================================================================================
const useMixedTTS = () => {
    const audioCtxRef = useRef(null);
    const sourceRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loadingId, setLoadingId] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const latestRequestId = useRef(0);

    // 初始化并解锁 AudioContext
    const unlockAudioContext = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, []);

    useEffect(() => {
        return () => {
            stop();
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(()=>{});
            }
        };
    }, []);

    // 准确分割中、缅、其他文本
    const splitMixedText = (text) => {
        if (!text) return [];
        const regex = /([\u1000-\u109F]+)|([\u4e00-\u9fa5]+)|([a-zA-Z0-9\s.,!?-]+)/g;
        const segments = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match[1]) segments.push({ lang: 'mm', text: match[1].trim() });
            else if (match[2]) segments.push({ lang: 'zh', text: match[2].trim() });
            else if (match[3]) segments.push({ lang: 'zh', text: match[3].trim() }); // 英文数字也用中文语音读
        }
        return segments.filter(s => s.text);
    };

    // 获取单个音频片段 (带缓存)
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
    
    // 【核心】使用 Web Audio API 解码并无缝拼接多个音频 Buffer
    const decodeAndConcat = async (blobs) => {
        const ctx = audioCtxRef.current;
        if (!ctx || blobs.length === 0) return null;

        const arrayBuffers = await Promise.all(blobs.map(blob => blob.arrayBuffer()));
        const decodedBuffers = await Promise.all(arrayBuffers.map(ab => ctx.decodeAudioData(ab.slice(0))));
        
        const totalLen = decodedBuffers.reduce((sum, buf) => sum + buf.length, 0);
        if (totalLen === 0) return null;

        const output = ctx.createBuffer(1, totalLen, decodedBuffers[0].sampleRate);
        let offset = 0;
        for (const buf of decodedBuffers) {
            output.getChannelData(0).set(buf.getChannelData(0), offset);
            offset += buf.length;
        }
        return output;
    };
    
    // 停止播放
    const stop = useCallback(() => {
        latestRequestId.current++;
        if (sourceRef.current) {
            try { sourceRef.current.stop(); sourceRef.current.disconnect(); } catch (e) {}
            sourceRef.current = null;
        }
        setIsPlaying(false);
        setPlayingId(null);
        setLoadingId(null);
    }, []);

    // 播放音频
    const play = useCallback(async (text, uniqueId) => {
        unlockAudioContext();
        const currentRequestId = ++latestRequestId.current;
        
        if (playingId === uniqueId) { // 如果正在播放当前项，则停止
            stop();
            return;
        }
        
        stop();
        if (!text || typeof text !== 'string') return;
        
        setLoadingId(uniqueId);
        try {
            const cleanText = text.replace(/【.*?】/g, '').trim();
            const segments = splitMixedText(cleanText);
            if (segments.length === 0) {
                if (currentRequestId === latestRequestId.current) setLoadingId(null);
                return;
            }

            const blobPromises = segments.map(seg => fetchSegmentAudio(seg.text, seg.lang));
            const audioBlobs = await Promise.all(blobPromises);
            
            if (currentRequestId !== latestRequestId.current) return;
            const concatenatedBuffer = await decodeAndConcat(audioBlobs);
            if (currentRequestId !== latestRequestId.current || !concatenatedBuffer) {
                setLoadingId(null);
                return;
            }

            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') await ctx.resume();

            const source = ctx.createBufferSource();
            source.buffer = concatenatedBuffer;
            source.connect(ctx.destination);
            source.onended = () => {
                if (latestRequestId.current === currentRequestId) {
                    setIsPlaying(false);
                    setPlayingId(null);
                }
            };
            sourceRef.current = source;
            source.start(0);

            setPlayingId(uniqueId);
            setIsPlaying(true);
        } catch (e) {
            console.error("TTS Playback Error:", e);
        } finally {
            if (currentRequestId === latestRequestId.current) {
                setLoadingId(null);
            }
        }
    }, [playingId, stop, unlockAudioContext]);
    
    // 【新增】预缓存函数
    const preload = useCallback((text) => {
        if (!text || typeof text !== 'string') return;
        const cleanText = text.replace(/【.*?】/g, '').trim();
        const segments = splitMixedText(cleanText);
        // 静默获取和缓存，忽略错误
        segments.forEach(seg => {
             fetchSegmentAudio(seg.text, seg.lang).catch(() => {});
        });
    }, []);

    return { play, stop, isPlaying, playingId, loadingId, preload, unlockAudioContext };
}

// ==========================================
// 3. 样式定义 (来自第二个版本，更美观)
// ==========================================
const cssStyles = `
  .xzt-container { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; position: relative; padding: 0 16px; overflow-y: auto; }
  .spacer { flex: 1; min-height: 5px; max-height: 30px; }
  .xzt-question-card { background: #ffffff; border-radius: 28px; padding: 24px; text-align: center; box-shadow: 0 10px 40px -10px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(243, 244, 246, 1); cursor: pointer; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); width: 100%; max-width: 480px; margin: 0 auto 10px auto; display: flex; flex-direction: column; align-items: center; position: relative; }
  .xzt-question-card:active { transform: scale(0.98); }
  .question-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 16px; margin-bottom: 20px; background-color: #f9fafb; }
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; row-gap: 8px; align-items: flex-end; }
  .char-block { display: flex; flex-direction: column; align-items: center; }
  .py-text { font-size: 0.8rem; color: #94a3b8; font-family: monospace; margin-bottom: -2px; min-height: 1.1em; }
  .cn-text { font-size: 1.5rem; font-weight: 700; color: #1e293b; line-height: 1.3; }
  .mm-text { font-size: 1.4rem; font-weight: 600; color: #334155; line-height: 1.4; margin-bottom: 2px; }
  .xzt-options-grid { display: grid; grid-template-columns: 1fr; gap: 12px; width: 100%; max-width: 480px; padding-bottom: 140px; }
  .xzt-option-card { position: relative; background: #ffffff; border-radius: 20px; border: 2px solid #f1f5f9; box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.04); cursor: pointer; transition: all 0.2s ease; overflow: hidden; display: flex; align-items: center; padding: 12px 16px; min-height: 64px; }
  .xzt-option-card:active { transform: scale(0.98); background: #f8fafc; }
  .xzt-option-card.selected { border-color: #a78bfa; background: #f5f3ff; }
  .xzt-option-card.correct { border-color: #4ade80; background: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #f87171; background: #fef2f2; animation: shake 0.4s; }
  .opt-img-wrapper { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; background: #f3f4f6; margin-right: 16px; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }
  .opt-text-box { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .layout-with-image .opt-text-box { text-align: left; }
  .opt-mixed-text { font-size: 1.1rem; font-weight: 600; color: #475569; }
  .fixed-bottom-area { position: fixed; bottom: 90px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: 60; padding: 0 20px; }
  .explanation-card { background: #fff; border: 1px solid #fecaca; background-color: #fef2f2; color: #b91c1c; padding: 12px 16px; border-radius: 16px; margin-bottom: 12px; font-size: 0.95rem; line-height: 1.4; text-align: left; width: 100%; max-width: 480px; pointer-events: auto; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15); display: flex; align-items: flex-start; gap: 8px; animation: slideUp 0.3s ease-out; }
  .submit-btn { pointer-events: auto; min-width: 150px; padding: 14px 30px; border-radius: 100px; font-size: 1.1rem; font-weight: 800; color: white; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); box-shadow: 0 10px 25px -5px rgba(124, 58, 237, 0.4); border: none; transition: all 0.2s; }
  .submit-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

// ==========================================
// 4. 标题和选项的文本渲染组件
// ==========================================
const MixedTextRenderer = ({ text, pinyinOptions, textClassName, pinyinClassName }) => {
    if (!text) return null;
    const regex = /([\u1000-\u109F]+)|([\u4e00-\u9fa5]+)|([a-zA-Z0-9\s.,!?-]+)/g;
    const parts = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) parts.push({ type: 'myanmar', text: match[1] });
        else if (match[2]) parts.push({ type: 'chinese', text: match[2] });
        else if (match[3]) parts.push({ type: 'other', text: match[3] });
    }

    return (
        <>
            {parts.map((part, i) => {
                if (part.type === 'chinese') {
                    const tokens = pinyin(part.text, pinyinOptions);
                    return part.text.split('').map((char, cI) => (
                        <div key={`${i}-${cI}`} className="char-block">
                            <span className={pinyinClassName}>{tokens[cI]}</span>
                            <span className={textClassName}>{char}</span>
                        </div>
                    ));
                }
                return <span key={i} className={`mm-text ${textClassName}`}>{part.text}</span>;
            })}
        </>
    );
};

// ==========================================
// 5. 主组件
// ==========================================
const XuanZeTi = ({ question = {}, allQuestions = [], currentIndex = 0, onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [displayOptions, setDisplayOptions] = useState([]);

  const { play, stop, isPlaying, playingId, loadingId, preload, unlockAudioContext } = useMixedTTS();

  // 初始化和题目切换时的逻辑
  useEffect(() => {
    if (!question.id) return;
    
    stop();
    setSelectedId(null);
    setIsSubmitted(false);
    setShowExplanation(false);

    // 随机排列选项
    const shuffled = [...(question.options || [])].sort(() => Math.random() - 0.5);
    setDisplayOptions(shuffled);

    // 自动播放题目音频
    const autoPlayTimeout = setTimeout(() => {
        if (question.text) {
            play(question.text, `question_${question.id}`);
        }
    }, 400); // 稍作延迟以获得更好的用户体验

    return () => clearTimeout(autoPlayTimeout);
  }, [question.id]); // 仅在 question.id 变化时触发

  // 【核心】预缓存下一题的音频
  useEffect(() => {
    if (!allQuestions || allQuestions.length === 0) return;

    const preloadNextQuestions = () => {
        // 定义要预加载的题目范围，例如接下来5道题
        const preloadCount = 5;
        const start = currentIndex + 1;
        const end = Math.min(start + preloadCount, allQuestions.length);

        for (let i = start; i < end; i++) {
            const nextQ = allQuestions[i];
            if (nextQ) {
                if (nextQ.text) preload(nextQ.text);
                if (nextQ.explanation) preload(nextQ.explanation);
                (nextQ.options || []).forEach(opt => {
                    if (opt.text) preload(opt.text);
                });
            }
        }
    };
    
    // 延迟执行，避免阻塞当前渲染
    const preloadTimeout = setTimeout(preloadNextQuestions, 1000);
    return () => clearTimeout(preloadTimeout);

  }, [currentIndex, allQuestions, preload]);

  const handleSelect = (option) => {
    if (isSubmitted) return;
    unlockAudioContext(); // 确保用户交互后音频上下文已激活
    setSelectedId(option.id);
    if (option.text) play(option.text, `option_${option.id}`);
  };

  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const correctIds = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String);
    const isCorrect = correctIds.includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] });
      try { new Audio('/sounds/correct.mp3').play().catch(()=>{}); } catch(e){}
      if (onCorrect) setTimeout(() => onCorrect({ correct: true, questionId: question.id }), 1500);
    } else {
      try { new Audio('/sounds/incorrect.mp3').play().catch(()=>{}); } catch(e){}
      if (navigator.vibrate) navigator.vibrate(200);
      
      if (question.explanation) {
        setShowExplanation(true);
        setTimeout(() => play(question.explanation, `explanation_${question.id}`), 600);
      }
      // 允许2.5秒后重试
      setTimeout(() => setIsSubmitted(false), 2500);
    }
  };

  const handleReadQuestion = (e) => {
    e.stopPropagation();
    play(question.text, `question_${question.id}`);
  };

  const questionAudioId = `question_${question.id}`;
  const isQuestionLoading = loadingId === questionAudioId;
  const isQuestionPlaying = playingId === questionAudioId;

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container" onClick={unlockAudioContext}>
        <div className="spacer" />

        <div className="xzt-question-card" onClick={handleReadQuestion}>
          <div className="absolute top-4 right-4 text-slate-400">
            {isQuestionLoading ? <FaSpinner className="spin text-violet-500" size={22}/> : 
             isQuestionPlaying ? <FaStop className="text-violet-500" size={22}/> : 
             <FaVolumeUp size={22}/>}
          </div>

          {question.imageUrl && <img src={question.imageUrl} alt="Question" className="question-img" />}

          <div className="pinyin-box">
             <MixedTextRenderer 
                text={question.text}
                pinyinOptions={{ type: 'array', toneType: 'symbol' }}
                pinyinClassName="py-text"
                textClassName="cn-text"
             />
          </div>
        </div>

        <div className="spacer" />

        <div className="xzt-options-grid">
          {displayOptions.map(option => {
            let statusClass = '';
            const correctIds = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String);
            if (isSubmitted) {
              if (correctIds.includes(String(option.id))) statusClass = 'correct'; 
              else if (String(option.id) === String(selectedId)) statusClass = 'incorrect';
            } else {
              if (String(option.id) === String(selectedId)) statusClass = 'selected';
            }

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${option.imageUrl ? 'layout-with-image' : ''} ${statusClass}`}
                onClick={() => handleSelect(option)}
              >
                {option.imageUrl && (
                  <div className="opt-img-wrapper">
                    <img src={option.imageUrl} alt="option" className="opt-img" />
                  </div>
                )}
                <div className="opt-text-box">
                  <span className="opt-mixed-text">{option.text}</span>
                </div>
                
                {isSubmitted && correctIds.includes(String(option.id)) && <FaCheckCircle className="text-green-500 absolute right-4 text-xl"/>}
                {isSubmitted && String(option.id) === String(selectedId) && !correctIds.includes(String(option.id)) && <FaTimesCircle className="text-red-500 absolute right-4 text-xl"/>}
              </div>
            );
          })}
        </div>

        <div className="fixed-bottom-area">
          {showExplanation && question.explanation && (
            <div className="explanation-card">
               <FaLightbulb className="flex-shrink-0 mt-1" />
               <div>{question.explanation}</div>
            </div>
          )}

          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || (isSubmitted && !showExplanation)}
          >
            {isSubmitted 
              ? ((Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String).includes(String(selectedId)) ? "正确" : "再试一次") 
              : "确认"
            }
          </button>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
