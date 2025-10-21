// components/Tixing/XuanZeTi.js (V4 - 内置听力模式完整版)

import React, { useState, useEffect, useCallback } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaLightbulb, FaRedo, FaArrowRight, FaHourglassHalf, FaVolumeUp, FaEye } from 'react-icons/fa';
import ReactPlayer from 'react-player/lazy';

const theme = {
  primary: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  gray: '#64748b',
  lightGray: '#e2e8f0',
  textPrimary: '#1e2b3b',
  textSecondary: '#334155',
  bgSuccess: '#dcfce7',
  bgWarning: '#fef9c3',
  bgError: '#fee2e2',
};

const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '650px', margin: '2rem auto', touchAction: 'manipulation' },
  questionArea: { padding: '20px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' },
  mediaContainer: { position: 'relative', paddingTop: '56.25%', marginBottom: '16px', backgroundColor: theme.lightGray, borderRadius: '12px', overflow: 'hidden' },
  reactPlayer: { position: 'absolute', top: '0', left: '0' },
  qImage: { width: '100%', height: 'auto', display: 'block', borderRadius: '12px', margin: '0 auto 16px' },
  qText: { fontSize: '1.4rem', color: theme.textPrimary, lineHeight: '1.6', margin: 0, textAlign: 'center', whiteSpace: 'pre-wrap' },
  optionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', marginBottom: '24px' },
  optionCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '12px', cursor: 'pointer', border: `2px solid ${theme.lightGray}`, transition: 'all 0.2s ease-in-out', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative' },
  optionImage: { width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' },
  optionText: { fontSize: '1.1rem', fontWeight: '500', color: theme.textSecondary, textAlign: 'center' },
  feedbackIcon: { position: 'absolute', top: '10px', right: '10px', fontSize: '1.5rem' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' },
  actionButton: { width: '80%', maxWidth: '300px', padding: '14px', borderRadius: '12px', border: 'none', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
  feedbackBox: { width: '100%', padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', animation: 'fadeIn 0.5s' },
  explanationBox: { width: '100%', backgroundColor: '#fffbeb', color: theme.warning, padding: '16px', borderRadius: '10px', border: `1px solid ${theme.warning}`, textAlign: 'left', fontSize: '1rem', lineHeight: '1.7', animation: 'fadeIn 0.5s' },
  qListenButton: { cursor: 'pointer', backgroundColor: theme.primary, color: 'white', borderRadius: '9999px', padding: '16px', display: 'inline-flex', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'all 0.2s', marginBottom: '16px' },
  showTranscriptButton: { background: 'none', border: `1px solid ${theme.gray}`, color: theme.gray, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', marginTop: '16px', fontSize: '0.9rem' }
};

const sounds = {
  correct: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/correct.mp3'] }) : null,
  incorrect: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/incorrect.mp3'] }) : null,
  click: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }) : null,
};
const playSound = (name) => sounds[name]?.play();

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], explanation, onCorrect, onIncorrect, onNext, isListeningMode = false }) => {
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isTTsPlaying, setIsTTsPlaying] = useState(false);

  const isMultipleChoice = correctAnswer.length > 1;
  const correctCount = selectedAnswers.filter(id => correctAnswer.includes(id)).length;
  const isCorrect = isSubmitted && correctCount === correctAnswer.length && selectedAnswers.length === correctAnswer.length;
  const isPartiallyCorrect = isSubmitted && correctCount > 0 && !isCorrect;

  const handlePlayTTS = () => {
      if (isTTsPlaying || !question.text) return;
      setIsTTsPlaying(true);
      const sound = new Howl({
          src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(question.text)}&v=zh-CN-XiaoyouNeural`],
          html5: true,
          onend: () => setIsTTsPlaying(false),
          onloaderror: () => { console.error('TTS Load Error'); setIsTTsPlaying(false); },
      });
      sound.play();
  };

  useEffect(() => {
    let sound;
    if (question.autoPlayAudio && question.audioUrl) {
      sound = new Howl({ src: [question.audioUrl], html5: true, autoplay: true });
    }
    return () => sound?.unload();
  }, [question.audioUrl, question.autoPlayAudio]);
  
  useEffect(() => {
    setSelectedAnswers([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    setShowTranscript(false);
  }, [question]);

  const handleSelect = useCallback((optionId) => {
    if (isSubmitted) return;
    playSound('click');
    setSelectedAnswers(prev => {
      if (isMultipleChoice) {
        return prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId];
      }
      return [optionId];
    });
  }, [isSubmitted, isMultipleChoice]);

  const handleSubmit = useCallback(() => {
    if (selectedAnswers.length === 0) return;
    setIsSubmitted(true);
    const isAnswerCorrect = selectedAnswers.length === correctAnswer.length && selectedAnswers.every(id => correctAnswer.includes(id));
    if (isAnswerCorrect) {
      playSound('correct');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      if (onCorrect) onCorrect({ answered: selectedAnswers });
    } else {
      playSound('incorrect');
      if (onIncorrect) onIncorrect({ answered: selectedAnswers, correct: correctAnswer });
    }
  }, [selectedAnswers, correctAnswer, onCorrect, onIncorrect]);

  const handleNextOrReset = useCallback(() => {
    if (onNext) {
      onNext();
    } else {
      setSelectedAnswers([]);
      setIsSubmitted(false);
      setShowExplanation(false);
      setShowTranscript(false);
    }
  }, [onNext]);

  const getOptionStyleClass = (optionId) => {
    let classes = 'option-card';
    if (selectedAnswers.includes(optionId)) classes += ' selected';
    if (isSubmitted) {
      if (correctAnswer.includes(optionId)) classes += ' correct';
      else if (selectedAnswers.includes(optionId)) classes += ' incorrect';
    }
    return classes;
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .option-card:hover { transform: translateY(-4px); border-color: ${theme.primary}; box-shadow: 0 8px 20px rgba(59,130,246,0.15); }
        .option-card:active { transform: translateY(-4px) scale(0.97); }
        .option-card.selected { border-color: ${theme.primary}; box-shadow: 0 0 15px rgba(59,130,246,0.3); }
        .option-card.correct { border-color: ${theme.success}; background-color: #f0fdf4; }
        .option-card.incorrect { border-color: ${theme.error}; background-color: #fef2f2; }
        .action-btn:hover { filter: brightness(1.1); }
        .action-btn:active { transform: scale(0.98); }
        @media (max-width: 600px) { .xzt-container { padding: 16px; } }
      `}</style>
      
      <div style={styles.container} className="xzt-container">
        <div style={styles.questionArea}>
          {isListeningMode && (
              <button style={{...styles.qListenButton, ...(isTTsPlaying ? {transform: 'scale(1.1)', filter: 'brightness(1.2)'} : {})}} onClick={handlePlayTTS}>
                  <FaVolumeUp size={30} />
              </button>
          )}

          {question.videoUrl && (
            <div style={styles.mediaContainer}>
              <ReactPlayer url={question.videoUrl} controls width="100%" height="100%" style={styles.reactPlayer} />
            </div>
          )}
          {question.audioUrl && !isListeningMode && (
            <ReactPlayer url={question.audioUrl} controls width="100%" height="50px" style={{ marginBottom: '16px' }} playing={false} />
          )}
          {question.imageUrl && !question.videoUrl && <img src={question.imageUrl} alt="题目图片" style={styles.qImage} />}
          
          {question.text && (!isListeningMode || showTranscript) && (
            <p style={{...styles.qText, animation: 'fadeIn 0.5s'}}>{question.text}</p>
          )}
          {isListeningMode && !showTranscript && question.text && (
            <button 
              onClick={() => setShowTranscript(true)} 
              style={styles.showTranscriptButton}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FaEye /> 查看原文
            </button>
          )}
        </div>

        <div style={styles.optionsGrid}>
          {options.map(option => (
            <div key={option.id} className={getOptionStyleClass(option.id)} onClick={() => handleSelect(option.id)}>
              {option.imageUrl && <img src={option.imageUrl} alt={option.text || ''} style={styles.optionImage}/>}
              {option.text && <div style={styles.optionText}>{option.text}</div>}
              {isSubmitted && correctAnswer.includes(option.id) && <FaCheckCircle style={{...styles.feedbackIcon, color: theme.success}}/>}
              {isSubmitted && selectedAnswers.includes(option.id) && !correctAnswer.includes(option.id) && <FaTimesCircle style={{...styles.feedbackIcon, color: theme.error}}/>}
            </div>
          ))}
        </div>

        <div style={styles.buttonContainer}>
          {!isSubmitted ? (
            <button style={{...styles.actionButton, backgroundColor: theme.primary, ...(selectedAnswers.length === 0 ? styles.disabledButton : {})}} className="action-btn" onClick={handleSubmit} disabled={selectedAnswers.length === 0}>
              提交答案
            </button>
          ) : (
            <>
              <div style={{...styles.feedbackBox,
                backgroundColor: isCorrect ? theme.bgSuccess : isPartiallyCorrect ? theme.bgWarning : theme.bgError,
                color: isCorrect ? theme.success : isPartiallyCorrect ? theme.warning : theme.error,
              }}>
                {isCorrect ? '🎉 全部答对！' : isPartiallyCorrect ? `😄 答对了 ${correctCount} 个，加油！` : '❌ 回答错误！'}
              </div>
              {explanation && (
                <button style={{...styles.actionButton, backgroundColor: theme.warning, marginTop: '12px'}} className="action-btn" onClick={() => setShowExplanation(s => !s)}>
                  <FaLightbulb /> {showExplanation ? '隐藏解析' : '查看解析'}
                </button>
              )}
              {showExplanation && explanation && <div style={{...styles.explanationBox, width: '100%', marginTop: '12px'}}>{explanation}</div>}
              {isSubmitted && !explanation && (
                <div style={{...styles.explanationBox, color: theme.gray, borderColor: theme.lightGray, marginTop: '12px'}}>
                  <FaHourglassHalf style={{ marginRight: '8px' }}/> AI 正在生成讲解，请稍等...
                </div>
              )}
              <button style={{...styles.actionButton, backgroundColor: theme.gray, marginTop: '12px'}} className="action-btn" onClick={handleNextOrReset}>
                {onNext ? <><FaArrowRight /> 下一题</> : <><FaRedo /> 再试一次</>}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
