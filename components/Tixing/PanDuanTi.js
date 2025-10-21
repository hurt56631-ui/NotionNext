// components/Tixing/PanDuanTi.js

import React, { useState, useEffect, useCallback } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { FaCheck, FaTimes, FaLightbulb, FaRedo, FaArrowRight } from 'react-icons/fa';
import ReactPlayer from 'react-player/lazy'; // 使用 lazy load 优化性能

// --- 样式定义 (已采纳优化建议) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto' },
  questionArea: { padding: '20px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '24px', textAlign: 'center' },
  mediaContainer: { position: 'relative', paddingTop: '56.25%', marginBottom: '16px', backgroundColor: '#e2e8f0', borderRadius: '12px', overflow: 'hidden' }, // 16:9 aspect ratio for video
  reactPlayer: { position: 'absolute', top: '0', left: '0' },
  image: { width: '100%', height: 'auto', display: 'block', borderRadius: '12px', margin: '0 auto 16px' },
  text: { fontSize: '1.4rem', color: '#1e2b3b', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' },
  buttonGroup: { display: 'flex', justifyContent: 'center', gap: '20px' },
  // 🎨 [优化] 响应式圆形按钮
  choiceButton: {
    width: '30vw', height: '30vw', maxWidth: '120px', maxHeight: '120px',
    borderRadius: '50%', border: '5px solid white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  correctButton: { backgroundColor: '#22c55e', color: 'white' },
  incorrectButton: { backgroundColor: '#ef4444', color: 'white' },
  disabledButton: { cursor: 'default', opacity: 0.6, filter: 'grayscale(50%)' },
  selectedCorrect: { transform: 'scale(1.1)', boxShadow: '0 0 25px #22c55e' },
  selectedIncorrect: { transform: 'scale(1.1)', boxShadow: '0 0 25px #ef4444' },
  feedbackContainer: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' },
  feedbackBox: { width: '100%', padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'fadeIn 0.5s' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { width: '100%', backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7' },
  actionButton: { width: '80%', maxWidth: '300px', padding: '14px', borderRadius: '12px', border: 'none', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
};

// --- 音效 (统一管理) ---
const sounds = {
  correct: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/correct.mp3'] }) : null,
  incorrect: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/incorrect.mp3'] }) : null,
};
const playSound = (name) => sounds[name]?.play();

/**
 * 万能判断题组件 (PanDuanTi)
 * @param {object} question - 题目内容 { text, imageUrl, audioUrl, videoUrl }
 * @param {boolean} correctAnswer - 正确答案 (true or false)
 * @param {string} explanation - 题目解析
 * @param {function} onCorrect - 答对时的回调
 * @param {function} onIncorrect - 答错时的回调
 * @param {function} onNext - 点击下一题按钮的回调
 */
const PanDuanTi = ({ question = {}, correctAnswer, explanation, onCorrect, onIncorrect, onNext }) => {
  const { text, imageUrl, audioUrl, videoUrl } = question;
  
  // ⚙️ [优化] 合并相关状态
  const [userAnswer, setUserAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // 派生状态，使渲染逻辑更清晰
  const hasAnswered = userAnswer !== null;
  const isAnswerCorrect = hasAnswered && userAnswer === correctAnswer;

  // 🧠 [新增] 自动播放音频
  useEffect(() => {
    let sound;
    if (audioUrl && !hasAnswered) {
      sound = new Howl({ src: [audioUrl], html5: true, autoplay: true });
    }
    return () => sound?.unload(); // 组件卸载或题目更新时清理
  }, [audioUrl, hasAnswered]);
  
  // 答题处理函数
  const handleAnswer = useCallback((answer, e) => {
    if (hasAnswered) return;
    
    setUserAnswer(answer);
    const isCorrect = answer === correctAnswer;

    if (isCorrect) {
      playSound('correct');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      if (onCorrect) onCorrect();
    } else {
      playSound('incorrect');
      // 🎨 [新增] 答错时震动动画
      const buttonElement = e.currentTarget;
      buttonElement.classList.add('shake');
      setTimeout(() => buttonElement.classList.remove('shake'), 500);
      if (onIncorrect) onIncorrect();
    }
  }, [hasAnswered, correctAnswer, onCorrect, onIncorrect]);

  // 重置或进入下一题
  const handleNextOrReset = useCallback(() => {
    if (onNext) {
      onNext();
    } else {
      // 如果没有onNext回调，则只重置当前题目
      setUserAnswer(null);
      setShowExplanation(false);
    }
  }, [onNext]);
  
  // 题目切换时自动重置内部状态
  useEffect(() => {
      setUserAnswer(null);
      setShowExplanation(false);
  }, [question]);

  return (
    <>
      {/* 🎨 [新增] 动画与响应式样式 */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px) scale(1.1); }
          20%, 80% { transform: translateX(4px) scale(1.1); }
          30%, 50%, 70% { transform: translateX(-6px) scale(1.1); }
          40%, 60% { transform: translateX(6px) scale(1.1); }
        }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .explanation-box {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s ease-out, padding 0.4s ease, margin 0.4s ease;
          padding-top: 0; padding-bottom: 0; margin-top: 0;
        }
        .explanation-box.show {
          max-height: 500px; /* 设一个足够大的值 */
          padding-top: 16px; padding-bottom: 16px; margin-top: 12px;
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.questionArea}>
          {/* 🧩 [新增] 支持视频 */}
          {videoUrl && (
            <div style={styles.mediaContainer}>
              <ReactPlayer url={videoUrl} controls width="100%" height="100%" style={styles.reactPlayer} />
            </div>
          )}
          {/* 🧩 [新增] 支持音频 (非自动播放时显示播放器) */}
          {audioUrl && (
              <div style={{ marginBottom: '16px' }}>
                  <ReactPlayer url={audioUrl} controls width="100%" height="50px" playing={false} />
              </div>
          )}
          {imageUrl && !videoUrl && <img src={imageUrl} alt="题目图片" style={styles.image} />}
          {text && <p style={styles.text}>{text}</p>}
        </div>

        <div style={styles.buttonGroup}>
          {[true, false].map(answer => (
            <button
              key={String(answer)}
              style={{
                ...styles.choiceButton,
                ...(answer ? styles.correctButton : styles.incorrectButton),
                ...(hasAnswered && styles.disabledButton),
                ...(hasAnswered && userAnswer === answer && (isAnswerCorrect ? styles.selectedCorrect : styles.selectedIncorrect))
              }}
              onClick={(e) => handleAnswer(answer, e)}
              disabled={hasAnswered}
            >
              {answer ? <FaCheck size="40%" /> : <FaTimes size="40%" />}
            </button>
          ))}
        </div>

        {hasAnswered && (
          <div style={styles.feedbackContainer}>
            <div style={{...styles.feedbackBox, ...(isAnswerCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect)}}>
              {isAnswerCorrect ? '回答正确！' : '回答错误！'}
            </div>

            {explanation && (
              <>
                <button 
                  style={{...styles.actionButton, backgroundColor: isAnswerCorrect ? '#10b981' : '#f59e0b', marginTop: '12px'}}
                  onClick={() => setShowExplanation(s => !s)}
                >
                  <FaLightbulb /> {showExplanation ? '隐藏解析' : '查看解析'}
                </button>
                <div className={`explanation-box ${showExplanation ? 'show' : ''}`} style={styles.explanationBox}>
                  {explanation}
                </div>
              </>
            )}

            <button 
              style={{...styles.actionButton, backgroundColor: '#64748b', marginTop: explanation ? '0' : '12px' }}
              onClick={handleNextOrReset}
            >
              {onNext ? <><FaArrowRight /> 下一题</> : <><FaRedo /> 再试一次</>}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PanDuanTi;
