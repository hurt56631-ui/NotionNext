// components/Tixing/GaiCuoTi.js

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FaCheck, FaTimes, FaRedo, FaLightbulb, FaWandMagicSparkles } from 'react-icons/fa6';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';

// --- 样式定义 (已优化，与FanYiTi风格统一) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: 0, padding: '8px' },
  sentenceContainer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', padding: '16px', backgroundColor: '#e2e8f0', borderRadius: '12px', border: '2px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' },
  wordBox: { padding: '8px 10px', fontSize: '1.5rem', fontWeight: '500', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', userSelect: 'none', color: '#334155', border: '2px solid transparent' },
  wordBoxSelected: { backgroundColor: '#93c5fd', color: '#1e3a8a', transform: 'scale(1.05)', borderColor: '#60a5fa' },
  wordBoxCorrect: { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#34d399' },
  wordBoxIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#f87171' },
  wordBoxSolution: { backgroundColor: 'transparent', outline: '3px solid #60a5fa', borderRadius: '8px', animation: 'pulse 1.5s infinite' }, // 漏掉的正确答案
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.1s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'fadeIn 0.5s' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7', animation: 'fadeIn 0.5s' },
  correctionBox: { backgroundColor: '#e0f2fe', color: '#0c4a6e', padding: '16px', borderRadius: '10px', border: '1px solid #7dd3fc', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7', animation: 'fadeIn 0.5s' },
};


/**
 * 万能改错题组件 (GaiCuoTi)
 * @param {string} title - 题目名称
 * @param {string} sentence - 待检查的句子
 * @param {'char' | 'word'} [segmentationType='char'] - 分割类型：'char'按字分割, 'word'按空格分割
 * @param {number[]} correctAnswers - 正确的错误项索引数组
 * @param {Array<{index: number, correct: string}>} [corrections=[]] - 订正提示数组
 * @param {string} explanation - 题目解析
 * @param {function} onCorrect - 答对时的回调函数
 */
const GaiCuoTi = ({ title, sentence, segmentationType = 'char', correctAnswers = [], corrections = [], explanation, onCorrect }) => {
  // 💡 [关键修复] 将 aounds 的初始化移入组件内部，并使用 state 和 effect
  const [sounds, setSounds] = useState(null);

  useEffect(() => {
    // 这个 effect 只在客户端运行一次，安全地初始化 Howl
    setSounds({
      click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
      correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }),
      incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
    });

    // 在组件卸载时，清理 Howler 实例，防止内存泄漏
    return () => {
      if (sounds) {
        sounds.click.unload();
        sounds.correct.unload();
        sounds.incorrect.unload();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组确保只运行一次

  // 💡 [关键修复] 创建一个安全的播放函数
  const playSound = useCallback((name) => {
    if (sounds && sounds[name]) {
      sounds[name].play();
    }
  }, [sounds]);

  const segments = useMemo(() => {
    if (segmentationType === 'word') {
      return sentence.split(' ');
    }
    return sentence.split(''); // 默认按字符分割
  }, [sentence, segmentationType]);

  const [selectedIndices, setSelectedIndices] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleWordClick = useCallback((index) => {
    if (isSubmitted) return;
    playSound('click');
    setSelectedIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index) // 取消选择
        : [...prev, index] // 添加选择
    );
  }, [isSubmitted, playSound]);

  const handleSubmit = useCallback(() => {
    if (selectedIndices.length === 0) {
      alert("请选择你认为是错误的部分！");
      return;
    }

    const selectedSet = new Set(selectedIndices.sort());
    const correctSet = new Set(correctAnswers.sort());
    const isAnswerCorrect = selectedSet.size === correctSet.size &&
                           [...selectedSet].every(index => correctSet.has(index));

    setIsCorrect(isAnswerCorrect);
    setIsSubmitted(true);
    playSound(isAnswerCorrect ? 'correct' : 'incorrect');
    
    if (isAnswerCorrect) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      if (onCorrect) onCorrect();
    }
  }, [selectedIndices, correctAnswers, onCorrect, playSound]);

  const handleReset = useCallback(() => {
    setSelectedIndices([]);
    setIsSubmitted(false);
    setIsCorrect(false);
  }, []);
  
  useEffect(() => {
    handleReset();
  }, [sentence, handleReset]);

  const getWordStyle = (index) => {
    let style = { ...styles.wordBox };
    const isSelected = selectedIndices.includes(index);
    const isCorrectAnswer = correctAnswers.includes(index);

    if (isSubmitted) {
      if (isSelected && isCorrectAnswer) { // 正确找出错误 (True Positive)
        style = { ...style, ...styles.wordBoxCorrect };
      } else if (isSelected && !isCorrectAnswer) { // 把对的当成错的 (False Positive)
        style = { ...style, ...styles.wordBoxIncorrect };
      } else if (!isSelected && isCorrectAnswer) { // 漏掉的错误 (False Negative)
        style = { ...style, ...styles.wordBoxSolution };
      }
    } else {
      if (isSelected) {
        style = { ...style, ...styles.wordBoxSelected };
      }
    }
    return style;
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { outline-offset: 0; } 50% { outline-offset: 4px; } }
        .submit-btn:hover { background-color: #2563eb !important; }
        .submit-btn:active { transform: scale(0.98); }
        /* 响应式调整 */
        @media (max-width: 480px) {
          .gct-container { padding: 16px !important; }
          .gct-word-box { font-size: 1.2rem !important; padding: 6px 8px !important; }
        }
      `}</style>

      <div style={styles.container} className="gct-container">
        <h3 style={styles.title}>{title}</h3>
        
        <div style={styles.sentenceContainer}>
          {segments.map((segment, index) => (
            <div
              key={index}
              style={getWordStyle(index)}
              className="gct-word-box"
              onClick={() => handleWordClick(index)}
            >
              {segment}
            </div>
          ))}
        </div>

        <div style={styles.buttonContainer}>
          {!isSubmitted ? (
            <button style={styles.submitButton} className="submit-btn" onClick={handleSubmit} disabled={selectedIndices.length === 0}>
              检查答案
            </button>
          ) : (
            <>
              <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                {isCorrect ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再想想看！</>}
              </div>
              
              {isSubmitted && !isCorrect && corrections.length > 0 && (
                <div style={styles.correctionBox}>
                  <FaWandMagicSparkles style={{ marginRight: '8px', color: '#0ea5e9', flexShrink: 0, verticalAlign: 'middle' }} />
                  <span style={{ verticalAlign: 'middle' }}>
                    <strong>修改建议：</strong>
                    {corrections.map((c, i) => (
                      <span key={c.index}>
                        {i > 0 && '；'} 第 {c.index + 1} 个部分应为「<strong>{c.correct}</strong>」
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {isSubmitted && explanation && (
                <div style={styles.explanationBox}>
                    <FaLightbulb style={{ marginRight: '8px', color: '#f59e0b', flexShrink: 0, verticalAlign: 'middle' }} />
                    <span style={{ verticalAlign: 'middle' }}><strong>解析：</strong> {explanation}</span>
                </div>
              )}
              
              <button style={{ ...styles.submitButton, backgroundColor: '#64748b' }} className="submit-btn" onClick={handleReset}>
                <FaRedo /> 再试一次
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GaiCuoTi;
