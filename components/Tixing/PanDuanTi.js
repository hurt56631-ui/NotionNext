// components/Tixing/PanDuanTi.js (V2 - 已修复编译错误)

import React, { useState, useEffect } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { FaCheck, FaTimes, FaVolumeUp, FaLightbulb, FaRedo } from 'react-icons/fa';
import ReactPlayer from 'react-player';

// --- 样式定义 ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto' },
  questionArea: { padding: '20px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' },
  image: { maxWidth: '100%', maxHeight: '250px', borderRadius: '12px', margin: '0 auto 16px' },
  text: { fontSize: '1.4rem', color: '#1e2b3b', lineHeight: '1.6', margin: 0 },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '20px' },
  choiceButton: {
    width: '120px', height: '120px', borderRadius: '50%', border: '5px solid white',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
  },
  correctButton: { backgroundColor: '#22c55e', color: 'white' },
  incorrectButton: { backgroundColor: '#ef4444', color: 'white' },
  disabledButton: { cursor: 'default', opacity: 0.7 },
  selectedCorrect: { transform: 'scale(1.1)', boxShadow: '0 0 20px #22c55e' },
  selectedIncorrect: { transform: 'scale(1.1)', boxShadow: '0 0 20px #ef4444' },
  feedbackContainer: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' },
  feedbackBox: { width: '100%', padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { width: '100%', backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', textAlign: 'left', fontSize: '0.95rem', lineHeight: '1.6' },
  submitButton: { width: '80%', padding: '14px', borderRadius: '12px', border: 'none', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
};

// --- 音效 ---
let sounds = {
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
};
const playSound = (name) => sounds[name]?.play();

// --- 主组件 ---
const PanDuanTi = ({ question, isCorrect, aiExplanation }) => {
  const [userAnswer, setUserAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const hasAnswered = userAnswer !== null;
  const isAnswerCorrect = hasAnswered && userAnswer === isCorrect;

  const handleAnswer = (answer) => {
    if (hasAnswered) return;
    setUserAnswer(answer);
    if (answer === isCorrect) {
      playSound('correct');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      playSound('incorrect');
    }
  };

  const handleReset = () => {
      setUserAnswer(null);
      setShowExplanation(false);
  };
  
  return (
    <div style={styles.container}>
      <div style={styles.questionArea}>
        {question.audioUrl && (
            <div style={{ marginBottom: '16px' }}>
                <ReactPlayer url={question.audioUrl} controls width="100%" height="50px" />
            </div>
        )}
        {question.imageUrl && <img src={question.imageUrl} alt="题目图片" style={styles.image} />}
        {question.text && <p style={styles.text}>{question.text}</p>}
      </div>

      <div style={styles.buttonGroup}>
        <button 
          style={{
            ...styles.choiceButton, ...styles.correctButton,
            ...(hasAnswered && styles.disabledButton),
            ...(hasAnswered && userAnswer === true && (isAnswerCorrect ? styles.selectedCorrect : styles.selectedIncorrect))
          }}
          onClick={() => handleAnswer(true)}
          disabled={hasAnswered}
        >
          <FaCheck size={40} />
        </button>
        <button 
          style={{
            ...styles.choiceButton, ...styles.incorrectButton,
            ...(hasAnswered && styles.disabledButton),
            ...(hasAnswered && userAnswer === false && (isAnswerCorrect ? styles.selectedCorrect : styles.selectedIncorrect))
          }}
          onClick={() => handleAnswer(false)}
          disabled={hasAnswered}
        >
          <FaTimes size={40} />
        </button>
      </div>

      {hasAnswered && (
        <div style={styles.feedbackContainer}>
            {/* 【核心修复】合并了两个 style 属性 */}
            <div style={{
              ...styles.feedbackBox, 
              ...(isAnswerCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect)
            }}>
                {isAnswerCorrect ? '回答正确！' : '回答错误！'}
            </div>

            {aiExplanation && !isAnswerCorrect && (
                <div style={styles.explanationBox}>{aiExplanation}</div>
            )}
            
            {aiExplanation && isAnswerCorrect && (
                 <button style={{...styles.submitButton, backgroundColor: '#10b981'}} onClick={() => setShowExplanation(!showExplanation)}>
                    <FaLightbulb /> {showExplanation ? '隐藏解析' : '查看解析'}
                </button>
            )}
            {showExplanation && aiExplanation && isAnswerCorrect && (
                 <div style={styles.explanationBox}>{aiExplanation}</div>
            )}
            
            <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleReset}>
                <FaRedo /> 再来一题
            </button>
        </div>
      )}
    </div>
  );
};

export default PanDuanTi;
