// components/Tixing/GaiCuoTi.js

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FaCheck, FaTimes, FaRedo, FaLightbulb } from 'react-icons/fa';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';

// --- 样式定义 ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: 0, padding: '8px' },
  sentenceContainer: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', padding: '16px', backgroundColor: '#e2e8f0', borderRadius: '12px', border: '2px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' },
  wordBox: { padding: '8px 10px', fontSize: '1.5rem', fontWeight: '500', borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.2s ease', userSelect: 'none', color: '#334155' },
  wordBoxSelected: { backgroundColor: '#93c5fd', color: '#1e3a8a', transform: 'scale(1.1)' },
  wordBoxCorrect: { backgroundColor: '#a7f3d0', color: '#065f46', border: '2px solid #34d399' },
  wordBoxIncorrect: { backgroundColor: '#fecaca', color: '#991b1b', border: '2px solid #f87171' },
  wordBoxSolution: { outline: '3px solid #60a5fa' }, // 错误提交后，高亮正确答案
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7' },
};

// --- 音频资源 ---
let sounds = {};
if (typeof window !== 'undefined') {
  sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 });
  sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (name) => { if (sounds[name]) sounds[name].play(); };


const GaiCuoTi = ({ title, sentence, correctAnswer, explanation }) => {
  // 将句子拆分成单个字符的数组
  const words = useMemo(() => sentence.split(''), [sentence]);

  const [selectedWord, setSelectedWord] = useState({ content: null, index: null });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // 点击单词的处理函数
  const handleWordClick = (word, index) => {
    if (isSubmitted) return; // 提交后不允许再选择
    playSound('click');
    setSelectedWord({ content: word, index: index });
  };

  // 提交答案
  const handleSubmit = useCallback(() => {
    if (!selectedWord.content) {
      alert("请先选择一个你认为是错误的字！");
      return;
    }
    const correct = selectedWord.content === correctAnswer;
    setIsCorrect(correct);
    setIsSubmitted(true);
    playSound(correct ? 'correct' : 'incorrect');
    if (correct) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [selectedWord, correctAnswer]);

  // 重置题目
  const handleReset = useCallback(() => {
    setSelectedWord({ content: null, index: null });
    setIsSubmitted(false);
    setIsCorrect(false);
  }, []);
  
  // 确保当题目切换时，状态也被重置
  useEffect(() => {
    handleReset();
  }, [sentence, handleReset]);

  // 动态计算每个字的样式
  const getWordStyle = (word, index) => {
    let style = { ...styles.wordBox };

    if (isSubmitted) {
      // 如果已提交
      if (word === correctAnswer) {
        // 这是正确答案应该在的位置
        style = { ...style, ...styles.wordBoxCorrect };
      }
      if (index === selectedWord.index) {
        // 这是用户的选择
        if (isCorrect) {
          style = { ...style, ...styles.wordBoxCorrect };
        } else {
          style = { ...style, ...styles.wordBoxIncorrect };
        }
      }
    } else {
      // 未提交时，只高亮当前选择
      if (index === selectedWord.index) {
        style = { ...style, ...styles.wordBoxSelected };
      }
    }
    return style;
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{title}</h3>
      
      <div style={styles.sentenceContainer}>
        {words.map((word, index) => (
          <div
            key={index}
            style={getWordStyle(word, index)}
            onClick={() => handleWordClick(word, index)}
          >
            {word}
          </div>
        ))}
      </div>

      <div style={styles.buttonContainer}>
        {!isSubmitted ? (
          <button style={styles.submitButton} onClick={handleSubmit} disabled={!selectedWord.content}>
            检查答案
          </button>
        ) : (
          <>
            <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
              {isCorrect ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再想想看！</>}
            </div>

            <div style={styles.explanationBox}>
                <FaLightbulb style={{ marginRight: '8px', color: '#f59e0b' }} />
                <strong>解析：</strong> {explanation}
            </div>
            
            <button style={{ ...styles.submitButton, backgroundColor: '#64748b' }} onClick={handleReset}>
              <FaRedo /> 再试一次
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GaiCuoTi;
