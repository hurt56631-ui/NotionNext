// components/Tixing/XuanZeTi.js (V1 - 万能选择题)

import React, { useState, useEffect } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaLightbulb, FaRedo } from 'react-icons/fa';
import ReactPlayer from 'react-player';

// --- 样式定义 ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto' },
  questionArea: { padding: '20px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '24px' },
  qImage: { maxWidth: '100%', maxHeight: '250px', borderRadius: '12px', margin: '0 auto 16px', display: 'block' },
  qText: { fontSize: '1.4rem', color: '#1e2b3b', lineHeight: '1.6', margin: 0, textAlign: 'center' },
  optionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  optionCard: {
    padding: '16px', backgroundColor: 'white', borderRadius: '12px',
    cursor: 'pointer', border: '2px solid #e2e8f0', transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  },
  optionImage: { width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' },
  optionText: { fontSize: '1.1rem', fontWeight: '500', color: '#334155', textAlign: 'center' },
  selected: { borderColor: '#3b82f6', boxShadow: '0 0 15px rgba(59,130,246,0.3)' },
  correct: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  incorrect: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  feedbackIcon: { position: 'absolute', top: '10px', right: '10px', fontSize: '1.5rem' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' },
  submitButton: { width: '80%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
  explanationBox: { width: '100%', backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', textAlign: 'left', fontSize: '0.95rem', lineHeight: '1.6' },
};

// --- 音效 ---
let sounds = {
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
  click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
};
const playSound = (name) => sounds[name]?.play();

// --- 主组件 ---
const XuanZeTi = ({ question, options, correctAnswer, aiExplanation }) => {
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  
  const isMultipleChoice = correctAnswer.length > 1;

  const handleSelect = (optionId) => {
    if (isSubmitted) return;
    playSound('click');
    setSelectedAnswers(prev => {
      if (isMultipleChoice) {
        return prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId];
      } else {
        return [optionId];
      }
    });
  };

  const handleSubmit = () => {
    if (selectedAnswers.length === 0) return;
    setIsSubmitted(true);
    const isCorrect = selectedAnswers.length === correctAnswer.length && selectedAnswers.every(id => correctAnswer.includes(id));
    if (isCorrect) {
      playSound('correct');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      playSound('incorrect');
    }
  };
  
  const handleReset = () => {
      setSelectedAnswers([]);
      setIsSubmitted(false);
      setShowExplanation(false);
  };

  const getOptionStyle = (optionId) => {
    let style = { ...styles.optionCard, position: 'relative' };
    if (selectedAnswers.includes(optionId)) {
      style = { ...style, ...styles.selected };
    }
    if (isSubmitted) {
      if (correctAnswer.includes(optionId)) {
        style = { ...style, ...styles.correct };
      } else if (selectedAnswers.includes(optionId)) {
        style = { ...style, ...styles.incorrect };
      }
    }
    return style;
  };

  return (
    <div style={styles.container}>
      <div style={styles.questionArea}>
        {question.audioUrl && <ReactPlayer url={question.audioUrl} controls width="100%" height="50px" style={{ marginBottom: '16px' }} />}
        {question.imageUrl && <img src={question.imageUrl} alt="题目图片" style={styles.qImage} />}
        {question.text && <p style={styles.qText}>{question.text}</p>}
      </div>

      <div style={styles.optionsGrid}>
        {options.map(option => (
          <div key={option.id} style={getOptionStyle(option.id)} onClick={() => handleSelect(option.id)}>
            {option.imageUrl && <img src={option.imageUrl} alt={option.text || ''} style={styles.optionImage}/>}
            {option.text && <div style={styles.optionText}>{option.text}</div>}
            {isSubmitted && correctAnswer.includes(option.id) && <FaCheckCircle style={{...styles.feedbackIcon, color: '#22c55e'}}/>}
            {isSubmitted && selectedAnswers.includes(option.id) && !correctAnswer.includes(option.id) && <FaTimesCircle style={{...styles.feedbackIcon, color: '#ef4444'}}/>}
          </div>
        ))}
      </div>

      <div style={styles.buttonContainer}>
        {!isSubmitted ? (
          <button style={{...styles.submitButton, ...(selectedAnswers.length === 0 ? styles.disabledButton : {})}} onClick={handleSubmit} disabled={selectedAnswers.length === 0}>
            提交答案
          </button>
        ) : (
          <>
            {aiExplanation && (
              <button style={{...styles.submitButton, backgroundColor: '#10b981', marginBottom: '12px'}} onClick={() => setShowExplanation(!showExplanation)}>
                <FaLightbulb /> {showExplanation ? '隐藏解析' : '查看解析'}
              </button>
            )}
            {showExplanation && <div style={styles.explanationBox}>{aiExplanation}</div>}
            <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleReset}>
                <FaRedo /> 再来一题
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default XuanZeTi;
