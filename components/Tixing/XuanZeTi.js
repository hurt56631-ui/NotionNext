// components/Tixing/XuanZeTi.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  FaVolumeUp, FaCheckCircle, FaTimesCircle, FaLightbulb, 
  FaArrowRight, FaRedo, FaPlay, FaSpinner, FaEye 
} from 'react-icons/fa';
import ReactPlayer from 'react-player/lazy';

const theme = {
  primary: '#3b82f6',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  text: '#1e293b',
  bg: '#f8fafc'
};

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: '-apple-system, system-ui, sans-serif',
    padding: '16px',
    boxSizing: 'border-box',
    overflowY: 'auto'
  },
  questionBox: {
    flexShrink: 0,
    padding: '16px',
    backgroundColor: theme.bg,
    borderRadius: '20px',
    textAlign: 'center',
    marginBottom: '16px'
  },
  mediaWrapper: {
    width: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '12px',
    backgroundColor: '#e2e8f0'
  },
  qText: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: theme.text,
    lineHeight: '1.5',
    margin: '10px 0'
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '20px'
  },
  optionCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '2px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  },
  optionImg: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  optionText: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center'
  },
  btnArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '20px'
  },
  actionBtn: {
    width: '100%',
    maxWidth: '280px',
    padding: '16px',
    borderRadius: '18px',
    border: 'none',
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  feedbackBox: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '1rem'
  },
  explanation: {
    width: '100%',
    backgroundColor: '#fffbeb',
    color: '#92400e',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '0.9rem',
    lineHeight: '1.6',
    border: '1px solid #fef3c7'
  }
};

// --- TTS Helper ---
const playTTS = (text) => {
  if (!text) return;
  const cleanText = text.replace(/<[^>]+>/g, '').trim();
  const audio = new Audio(`/api/tts?t=${encodeURIComponent(cleanText)}&v=zh-CN-XiaoyouNeural`);
  audio.play().catch(e => console.warn("TTS Playback failed", e));
};

const XuanZeTi = (props) => {
  // 统一数据层级
  const data = props.data?.content || props.data || {};
  const { onCorrect, onIncorrect, onNext } = props;

  // 1. 核心判定修复：规范化正确答案为字符串数组
  const correctIds = useMemo(() => {
    const raw = data.correctAnswer || [];
    return (Array.isArray(raw) ? raw : [raw]).filter(v => v != null).map(String);
  }, [data.correctAnswer]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isRight, setIsRight] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // 切换题目时重置
  useEffect(() => {
    setSelectedIds([]);
    setIsSubmitted(false);
    setIsRight(false);
    setShowFullText(false);
    setShowExplanation(false);
    // 自动朗读题目
    if (data.question?.text) playTTS(data.question.text);
  }, [data]);

  const handleCardClick = (id, text) => {
    if (isSubmitted) return;
    const sid = String(id);
    
    // 触感反馈
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    
    // 朗读选项
    if (text) playTTS(text);

    if (correctIds.length > 1) {
      setSelectedIds(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
    } else {
      setSelectedIds([sid]);
    }
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0 || isSubmitted) return;

    // 2. 严格比对：长度一致且选中的都在正确集合中
    const correct = selectedIds.length === correctIds.length && 
                    selectedIds.every(id => correctIds.includes(id));

    setIsRight(correct);
    setIsSubmitted(true);

    if (correct) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (onCorrect) onCorrect();
    } else {
      if (onIncorrect) onIncorrect();
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        .opt-card-active { border-color: ${theme.primary} !important; background-color: #eff6ff !important; transform: scale(0.98); }
        .opt-card-correct { border-color: ${theme.success} !important; background-color: #ecfdf5 !important; }
        .opt-card-wrong { border-color: ${theme.error} !important; background-color: #fef2f2 !important; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {/* 题目区域 */}
      <div style={styles.questionBox}>
        {data.isListeningMode ? (
          <div onClick={() => playTTS(data.question?.text)} style={{ cursor: 'pointer', padding: '10px' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: theme.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <FaVolumeUp size={24} />
            </div>
            {!showFullText && <button onClick={(e) => { e.stopPropagation(); setShowFullText(true); }} style={{ fontSize: '0.8rem', color: theme.primary, border: 'none', background: 'none' }}>显示原文</button>}
          </div>
        ) : null}

        {data.question?.imageUrl && <img src={data.question.imageUrl} style={styles.optionImg} alt="question" />}
        {data.question?.videoUrl && (
          <div style={styles.mediaWrapper}>
             <ReactPlayer url={data.question.videoUrl} width="100%" height="180px" controls />
          </div>
        )}

        {(showFullText || !data.isListeningMode) && data.question?.text && (
          <h2 style={styles.qText}>{data.question.text}</h2>
        )}
      </div>

      {/* 选项区域 */}
      <div style={styles.optionsGrid}>
        {(data.options || []).map(opt => {
          const sid = String(opt.id);
          const isSelected = selectedIds.includes(sid);
          const isCorrectId = correctIds.includes(sid);
          
          let cardStyle = { ...styles.optionCard };
          let cardClass = "";

          if (isSubmitted) {
            if (isCorrectId) cardClass = "opt-card-correct";
            else if (isSelected) cardClass = "opt-card-wrong";
          } else if (isSelected) {
            cardClass = "opt-card-active";
          }

          return (
            <div 
              key={opt.id} 
              className={cardClass}
              style={cardStyle} 
              onClick={() => handleCardClick(opt.id, opt.text)}
            >
              {opt.imageUrl && <img src={opt.imageUrl} style={styles.optionImg} alt="opt" />}
              {opt.text && <span style={styles.optionText}>{opt.text}</span>}
              
              {isSubmitted && isCorrectId && <FaCheckCircle style={{ position: 'absolute', top: 5, right: 5, color: theme.success }} />}
              {isSubmitted && isSelected && !isCorrectId && <FaTimesCircle style={{ position: 'absolute', top: 5, right: 5, color: theme.error }} />}
            </div>
          );
        })}
      </div>

      {/* 交互按钮区 */}
      <div style={styles.btnArea}>
        {!isSubmitted ? (
          <button 
            style={{ ...styles.actionBtn, backgroundColor: theme.primary, opacity: selectedIds.length ? 1 : 0.5 }} 
            onClick={handleSubmit}
            disabled={selectedIds.length === 0}
          >
            检查答案
          </button>
        ) : (
          <>
            <div style={{ ...styles.feedbackBox, backgroundColor: isRight ? '#dcfce7' : '#fee2e2', color: isRight ? theme.success : theme.error }}>
              {isRight ? '🎉 回答正确！' : '❌ 还要努力哦'}
            </div>
            
            {data.explanation && (
              <button 
                style={{ ...styles.actionBtn, backgroundColor: theme.warning }} 
                onClick={() => setShowExplanation(!showExplanation)}
              >
                <FaLightbulb /> {showExplanation ? '隐藏解析' : '查看解析'}
              </button>
            )}

            {showExplanation && <div style={styles.explanation}>{data.explanation}</div>}

            <button 
              style={{ ...styles.actionBtn, backgroundColor: '#64748b' }} 
              onClick={onNext}
            >
              <FaArrowRight /> 下一题
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default XuanZeTi;
