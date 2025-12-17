import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp, FaArrowRight, FaTachometerAlt } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// ============================================================================
// 1. 基础工具与缓存 (保持不变)
// ============================================================================
const DB_NAME = 'LessonCacheDB';
const STORE_NAME = 'tts_audio';
const DB_VERSION = 1;

const idb = {
  db: null,
  async init() {
    if (typeof window === 'undefined') return Promise.resolve();
    if (this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(); return; }
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
    if (typeof window === 'undefined') return null;
    await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result?.size > 0 ? req.result : null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, blob) {
    if (typeof window === 'undefined') return;
    await this.init();
    if (!this.db) return;
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
  }
};

const audioController = {
  currentAudio: null,
  activeBlobUrls: [],
  
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
    this.activeBlobUrls = [];
  },

  async play(text, rate = 1.0) {
    this.stop();
    if (!text) return;

    // 简单判断中英文/其他语言
    const isBurmese = /[\u1000-\u109F]/.test(text);
    const voice = isBurmese ? 'my-MM-NilarNeural' : 'zh-CN-XiaoyouMultilingualNeural';
    const cacheKey = `tts-${voice}-${text}`;

    let blob = await idb.get(cacheKey);
    if (!blob) {
      try {
        const res = await fetch(`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`);
        blob = await res.blob();
        if (blob.size > 0) await idb.set(cacheKey, blob);
      } catch (e) { console.error(e); return; }
    }

    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    this.activeBlobUrls.push(url);
    const audio = new Audio(url);
    audio.playbackRate = rate;
    this.currentAudio = audio;
    audio.play().catch(e => console.warn(e));
  }
};

// ============================================================================
// 2. 样式定义 (CSS-in-JS)
// ============================================================================
const styles = {
  container: {
    fontFamily: '"Nunito", "Noto Sans SC", sans-serif',
    display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
    padding: '20px', backgroundColor: '#fff', overflowY: 'auto'
  },
  
  // 顶部解析栏
  feedbackBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px',
    animation: 'slideDown 0.3s ease-out', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
  },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534', borderBottom: '2px solid #86efac' },
  feedbackWrong: { backgroundColor: '#fee2e2', color: '#991b1b', borderBottom: '2px solid #fca5a5' },
  
  // 角色区域
  characterArea: {
    display: 'flex', gap: '16px', marginBottom: '32px', marginTop: '10px',
    alignItems: 'flex-start'
  },
  avatar: {
    width: '80px', height: '80px', flexShrink: 0,
    backgroundImage: 'url("https://api.dicebear.com/7.x/fun-emoji/svg?seed=Felix")', 
    backgroundSize: 'cover', borderRadius: '12px'
  },
  bubble: {
    position: 'relative', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '16px',
    padding: '16px', flex: 1, boxShadow: '0 4px 0 #e5e7eb',
    fontSize: '1.2rem', color: '#374151', fontWeight: 'bold', lineHeight: 1.5
  },
  bubbleArrow: {
    position: 'absolute', left: '-10px', top: '24px', width: '16px', height: '16px',
    background: '#fff', borderLeft: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb',
    transform: 'rotate(45deg)'
  },
  
  // 控制按钮
  controls: { display: 'flex', gap: '10px', marginTop: '12px' },
  controlBtn: {
    background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 12px',
    color: '#3b82f6', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '6px',
    boxShadow: '0 2px 0 #e5e7eb'
  },

  // 选项区域
  optionsGrid: { display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' },
  optionCard: {
    display: 'flex', alignItems: 'center', padding: '16px', borderRadius: '16px',
    border: '2px solid #e5e7eb', background: '#fff', cursor: 'pointer',
    fontSize: '1.1rem', fontWeight: '600', color: '#374151',
    boxShadow: '0 4px 0 #e5e7eb', transition: 'all 0.1s', position: 'relative'
  },
  optionSelected: { background: '#ddf4ff', borderColor: '#84d8ff', boxShadow: '0 4px 0 #84d8ff', color: '#1cb0f6' },
  optionCorrect: { background: '#d7ffb8', borderColor: '#58cc02', boxShadow: '0 4px 0 #58cc02', color: '#58cc02' },
  optionWrong: { background: '#ffdfe0', borderColor: '#ff4b4b', boxShadow: '0 4px 0 #ff4b4b', color: '#ff4b4b' },
  
  // 底部按钮栏
  bottomBar: {
    marginTop: 'auto', paddingTop: '20px', borderTop: '2px solid #f3f4f6',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  submitBtn: {
    width: '100%', padding: '14px', borderRadius: '16px', border: 'none',
    fontSize: '1.1rem', fontWeight: '800', color: '#fff', cursor: 'pointer',
    background: '#58cc02', boxShadow: '0 4px 0 #46a302', textTransform: 'uppercase', letterSpacing: '1px'
  },
  submitDisabled: { background: '#e5e7eb', color: '#afb6c1', boxShadow: 'none', cursor: 'not-allowed' },
  nextBtn: {
    width: '100%', padding: '14px', borderRadius: '16px', border: 'none',
    fontSize: '1.1rem', fontWeight: '800', color: '#fff', cursor: 'pointer',
    background: '#ffc800', boxShadow: '0 4px 0 #e5a500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
  },
  nextWrong: { background: '#ff4b4b', boxShadow: '0 4px 0 #ea2b2b' }
};

// ============================================================================
// 3. 辅助函数
// ============================================================================
const renderPinyin = (text) => {
  const tokens = pinyin(text, { type: 'all', toneType: 'symbol' });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'flex-end' }}>
      {tokens.map((t, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '-2px' }}>{t.pinyin}</span>
          <span>{text[i]}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 4. 主组件
// ============================================================================
const XuanZeTi = (props) => {
  // --- 数据标准化 ---
  const rawData = props.data || props;
  const rawQuestion = props.question || rawData.question || {};
  const rawOptions = props.options || rawData.options || [];
  const rawCorrectAnswer = props.correctAnswer || rawData.correctAnswer || [];
  const { onCorrect, onIncorrect, onNext } = props;

  const questionText = typeof rawQuestion === 'string' ? rawQuestion : (rawQuestion.text || '');
  const questionImage = typeof rawQuestion === 'object' ? rawQuestion.imageUrl : null;
  const explanation = rawData.explanation || "Correct Answer: " + rawOptions.find(o => rawCorrectAnswer.includes(o.id))?.text;

  // --- 状态 ---
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, submitted
  const [isCorrect, setIsCorrect] = useState(false);
  const [playRate, setPlayRate] = useState(1.0);
  
  const hasAutoPlayed = useRef(false);

  // 自动朗读
  useEffect(() => {
    if (questionText && !hasAutoPlayed.current) {
      setTimeout(() => {
        audioController.play(questionText, 1.0);
        hasAutoPlayed.current = true;
      }, 500);
    }
    return () => audioController.stop();
  }, [questionText]);

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId) return;
    
    const correct = rawCorrectAnswer.map(String).includes(String(selectedId));
    setIsCorrect(correct);
    setStatus('submitted');

    // 播放音效
    const sound = correct ? '/sounds/correct.mp3' : '/sounds/incorrect.mp3';
    new Audio(sound).play().catch(() => {});

    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  // 下一题逻辑
  const handleNextClick = () => {
    audioController.stop();
    if (isCorrect) {
      if (onCorrect) onCorrect();
      else if (onNext) onNext();
    } else {
      if (onIncorrect) onIncorrect();
      if (onNext) onNext();
    }
  };

  // 切换语速
  const toggleSpeed = () => {
    const newRate = playRate === 1.0 ? 0.7 : 1.0;
    setPlayRate(newRate);
    audioController.play(questionText, newRate);
  };

  // 获取选项样式
  const getOptionStyle = (optId) => {
    const idStr = String(optId);
    if (status === 'submitted') {
      if (rawCorrectAnswer.includes(idStr)) return styles.optionCorrect;
      if (idStr === String(selectedId)) return styles.optionWrong;
    } else {
      if (idStr === String(selectedId)) return styles.optionSelected;
    }
    return styles.optionCard;
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      `}</style>

      {/* 1. 顶部解析栏 (提交后显示) */}
      {status === 'submitted' && (
        <div style={{ ...styles.feedbackBar, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackWrong) }}>
          <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>
            {isCorrect ? '太棒了！(Great job!)' : '正确答案 (Correct Solution):'}
          </div>
          {!isCorrect && <div style={{ fontSize: '0.95rem' }}>{explanation}</div>}
        </div>
      )}

      {/* 2. 题目区域 (多邻国风格气泡) */}
      <div style={styles.characterArea}>
        <div style={styles.avatar}></div>
        <div style={styles.bubble}>
          <div style={styles.bubbleArrow}></div>
          
          {questionImage && (
            <img src={questionImage} alt="Q" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} />
          )}
          
          {/* 中文支持拼音显示 */}
          {/[\u4e00-\u9fa5]/.test(questionText) ? renderPinyin(questionText) : <div>{questionText}</div>}

          {/* 朗读控制 */}
          <div style={styles.controls}>
            <button style={styles.controlBtn} onClick={() => audioController.play(questionText, playRate)}>
              <FaVolumeUp /> 
            </button>
            <button style={styles.controlBtn} onClick={toggleSpeed}>
              <FaTachometerAlt /> {playRate === 1.0 ? 'Normal' : 'Slow'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. 选项列表 */}
      <div style={styles.optionsGrid}>
        {rawOptions.map(opt => (
          <div 
            key={opt.id} 
            style={getOptionStyle(opt.id)}
            onClick={() => status === 'idle' && setSelectedId(opt.id)}
          >
            {opt.imageUrl && (
              <img src={opt.imageUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', marginRight: '12px', objectFit: 'cover' }} />
            )}
            <div style={{ flex: 1 }}>
              {opt.text}
            </div>
            
            {/* 状态图标 */}
            {status === 'submitted' && rawCorrectAnswer.includes(String(opt.id)) && <FaCheckCircle style={{ color: '#58cc02', fontSize: '1.4rem' }} />}
            {status === 'submitted' && String(opt.id) === String(selectedId) && !isCorrect && <FaTimesCircle style={{ color: '#ff4b4b', fontSize: '1.4rem' }} />}
          </div>
        ))}
      </div>

      {/* 4. 底部按钮 */}
      <div style={styles.bottomBar}>
        {status === 'idle' ? (
          <button 
            style={{ ...styles.submitBtn, ...(selectedId ? {} : styles.submitDisabled) }}
            onClick={handleSubmit}
            disabled={!selectedId}
          >
            CHECK
          </button>
        ) : (
          <button 
            style={{ ...styles.nextBtn, ...(isCorrect ? {} : styles.nextWrong) }}
            onClick={handleNextClick}
          >
            CONTINUE <FaArrowRight />
          </button>
        )}
      </div>
    </div>
  );
};

export default XuanZeTi;
