// components/Tixing/XuanZeTi.js (V5 - 移动端适配美化版)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { 
  FaCheckCircle, FaTimesCircle, FaLightbulb, FaRedo, 
  FaArrowRight, FaHourglassHalf, FaVolumeUp, FaEye, FaEyeSlash 
} from 'react-icons/fa';
import ReactPlayer from 'react-player/lazy';

// --- 样式定义 (CSS-in-JS + Global Styles) ---
// 使用 CSS 变量以便于动态调整主题，并支持暗黑模式扩展
const cssStyles = `
  :root {
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --success: #22c55e;
    --error: #ef4444;
    --warning: #f59e0b;
    --gray: #64748b;
    --light-gray: #f1f5f9;
    --bg-card: #ffffff;
    --text-main: #1e2b3b;
    --text-sub: #475569;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --radius-box: 20px;
    --radius-btn: 12px;
  }

  .xzt-container {
    background-color: #f8fafc;
    border-radius: var(--radius-box);
    box-shadow: var(--shadow-lg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 650px;
    margin: 1.5rem auto;
    overflow: hidden;
    touch-action: manipulation;
    transition: all 0.3s ease;
  }

  .xzt-content-padding {
    padding: 24px;
  }

  /* 移动端适配 */
  @media (max-width: 600px) {
    .xzt-container {
      margin: 0;
      border-radius: 0;
      box-shadow: none;
      min-height: 100vh;
      background-color: #fff;
    }
    .xzt-content-padding {
      padding: 16px;
    }
    .xzt-question-text {
      font-size: 1.25rem !important;
    }
  }

  /* 选项网格布局 */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  
  @media (max-width: 400px) {
    .xzt-options-grid {
      grid-template-columns: 1fr; /* 极小屏幕单列显示 */
    }
    .xzt-option-image {
      height: 140px !important;
    }
  }

  /* 选项卡片样式 */
  .xzt-option-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    background-color: var(--bg-card);
    border-radius: 16px;
    border: 2px solid var(--light-gray);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .xzt-option-card:active {
    transform: scale(0.96);
  }

  .xzt-option-card.selected {
    border-color: var(--primary);
    background-color: #eff6ff;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .xzt-option-card.correct {
    border-color: var(--success);
    background-color: #f0fdf4;
  }

  .xzt-option-card.incorrect {
    border-color: var(--error);
    background-color: #fef2f2;
    animation: shake 0.5s;
  }

  .xzt-option-image {
    width: 100%;
    height: 110px;
    object-fit: cover;
    border-radius: 12px;
    margin-bottom: 12px;
  }

  .xzt-option-text {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-sub);
    text-align: center;
    line-height: 1.4;
  }

  /* 按钮通用样式 */
  .xzt-btn {
    width: 100%;
    padding: 16px;
    border-radius: var(--radius-btn);
    border: none;
    color: white;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.1s, filter 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: var(--shadow-md);
  }
  
  .xzt-btn:active {
    transform: scale(0.98);
  }

  .xzt-btn-primary { background-color: var(--primary); }
  .xzt-btn-warning { background-color: var(--warning); color: #fff; }
  .xzt-btn-gray { background-color: var(--light-gray); color: var(--text-sub); }
  .xzt-btn-disabled { background-color: #cbd5e1; cursor: not-allowed; box-shadow: none; }

  /* 听力播放按钮动画 */
  @keyframes pulse-blue {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  
  .xzt-listen-btn {
    background-color: var(--primary);
    color: white;
    border-radius: 50%;
    width: 70px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(59,130,246,0.4);
    transition: all 0.3s;
    margin: 0 auto 20px auto;
  }
  
  .xzt-listen-btn.playing {
    animation: pulse-blue 1.5s infinite;
    transform: scale(1.1);
  }

  /* 震动动画 */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }

  /* 淡入动画 */
  .fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* 媒体容器 */
  .media-wrapper {
    position: relative;
    padding-top: 56.25%; /* 16:9 Aspect Ratio */
    background-color: #000;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  
  .react-player-absolute {
    position: absolute;
    top: 0;
    left: 0;
  }
`;

// --- 音效管理 ---
const sounds = {
  correct: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/correct.mp3'], volume: 0.8 }) : null,
  incorrect: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.6 }) : null,
  click: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/click.mp3'], volume: 0.4 }) : null,
};
const playSound = (name) => sounds[name]?.play();

const XuanZeTi = ({ 
  question = {}, 
  options = [], 
  correctAnswer = [], 
  explanation, 
  onCorrect, 
  onIncorrect, 
  onNext, 
  isListeningMode = false 
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isTTsPlaying, setIsTTsPlaying] = useState(false);
  
  // 使用 Ref 追踪 TTS 实例，防止组件卸载时内存泄漏
  const ttsRef = useRef(null);

  const isMultipleChoice = correctAnswer.length > 1;
  const correctCount = selectedAnswers.filter(id => correctAnswer.includes(id)).length;
  const isCorrect = isSubmitted && correctCount === correctAnswer.length && selectedAnswers.length === correctAnswer.length;
  const isPartiallyCorrect = isSubmitted && correctCount > 0 && !isCorrect;

  // TTS 播放逻辑
  const handlePlayTTS = () => {
    if (isTTsPlaying || !question.text) return;
    setIsTTsPlaying(true);
    
    if (ttsRef.current) ttsRef.current.unload();

    ttsRef.current = new Howl({
      src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(question.text)}&v=zh-CN-XiaoyouNeural`],
      html5: true,
      onend: () => setIsTTsPlaying(false),
      onloaderror: () => { 
        console.error('TTS Load Error'); 
        setIsTTsPlaying(false); 
      },
    });
    ttsRef.current.play();
  };

  // 自动播放逻辑
  useEffect(() => {
    let autoSound;
    if (question.autoPlayAudio && question.audioUrl) {
      autoSound = new Howl({ src: [question.audioUrl], html5: true, autoplay: true });
    }
    return () => {
      autoSound?.unload();
      ttsRef.current?.unload();
    };
  }, [question.audioUrl, question.autoPlayAudio]);
  
  // 重置状态
  useEffect(() => {
    setSelectedAnswers([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    setShowTranscript(false);
    setIsTTsPlaying(false);
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
    
    // 检查答案
    const isAnswerCorrect = selectedAnswers.length === correctAnswer.length && selectedAnswers.every(id => correctAnswer.includes(id));
    
    if (isAnswerCorrect) {
      playSound('correct');
      confetti({ 
        particleCount: 150, 
        spread: 70, 
        origin: { y: 0.7 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b']
      });
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
      // 仅重置当前题目
      setSelectedAnswers([]);
      setIsSubmitted(false);
      setShowExplanation(false);
      setShowTranscript(false);
    }
  }, [onNext]);

  return (
    <>
      <style>{cssStyles}</style>
      
      <div className="xzt-container">
        <div className="xzt-content-padding">
          
          {/* --- 题目区域 --- */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            
            {/* 听力模式大按钮 */}
            {isListeningMode && (
              <button 
                className={`xzt-listen-btn ${isTTsPlaying ? 'playing' : ''}`} 
                onClick={handlePlayTTS}
                aria-label="播放题目音频"
              >
                <FaVolumeUp size={30} />
              </button>
            )}

            {/* 视频播放器 */}
            {question.videoUrl && (
              <div className="media-wrapper">
                <ReactPlayer 
                  url={question.videoUrl} 
                  controls 
                  width="100%" 
                  height="100%" 
                  className="react-player-absolute"
                />
              </div>
            )}

            {/* 普通音频播放器 */}
            {question.audioUrl && !isListeningMode && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                <ReactPlayer 
                  url={question.audioUrl} 
                  controls 
                  width="100%" 
                  height="50px" 
                  playing={false} 
                />
              </div>
            )}

            {/* 题目图片 */}
            {question.imageUrl && !question.videoUrl && (
              <img 
                src={question.imageUrl} 
                alt="题目配图" 
                style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', display: 'block' }} 
              />
            )}
            
            {/* 题干文本 */}
            {question.text && (!isListeningMode || showTranscript) && (
              <h3 className="xzt-question-text fade-in" style={{ 
                margin: 0, 
                color: 'var(--text-main)', 
                lineHeight: 1.6, 
                whiteSpace: 'pre-wrap'
              }}>
                {question.text}
              </h3>
            )}

            {/* 查看原文开关 */}
            {isListeningMode && question.text && (
              <button 
                onClick={() => setShowTranscript(!showTranscript)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--gray)',
                  color: 'var(--gray)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  marginTop: '16px',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                {showTranscript ? <><FaEyeSlash /> 隐藏原文</> : <><FaEye /> 查看原文</>}
              </button>
            )}
          </div>

          {/* --- 选项区域 --- */}
          <div className="xzt-options-grid">
            {options.map(option => {
              // 计算卡片样式类名
              let cardClass = 'xzt-option-card';
              if (selectedAnswers.includes(option.id)) cardClass += ' selected';
              
              if (isSubmitted) {
                if (correctAnswer.includes(option.id)) {
                  cardClass += ' correct';
                } else if (selectedAnswers.includes(option.id)) {
                  cardClass += ' incorrect';
                }
              }

              return (
                <div 
                  key={option.id} 
                  className={cardClass} 
                  onClick={() => handleSelect(option.id)}
                >
                  {option.imageUrl && (
                    <img src={option.imageUrl} alt={option.text || '选项'} className="xzt-option-image"/>
                  )}
                  {option.text && <div className="xzt-option-text">{option.text}</div>}
                  
                  {/* 状态图标 */}
                  {isSubmitted && correctAnswer.includes(option.id) && (
                    <FaCheckCircle style={{ position: 'absolute', top: 8, right: 8, color: 'var(--success)', fontSize: '1.4rem' }}/>
                  )}
                  {isSubmitted && selectedAnswers.includes(option.id) && !correctAnswer.includes(option.id) && (
                    <FaTimesCircle style={{ position: 'absolute', top: 8, right: 8, color: 'var(--error)', fontSize: '1.4rem' }}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* --- 按钮与反馈区域 --- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!isSubmitted ? (
              <button 
                className={`xzt-btn ${selectedAnswers.length === 0 ? 'xzt-btn-disabled' : 'xzt-btn-primary'}`} 
                onClick={handleSubmit} 
                disabled={selectedAnswers.length === 0}
              >
                提交答案
              </button>
            ) : (
              <div className="fade-in" style={{ width: '100%' }}>
                {/* 结果反馈条 */}
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '12px', 
                  backgroundColor: isCorrect ? 'var(--bg-success)' : (isPartiallyCorrect ? 'var(--bg-warning)' : '#fee2e2'),
                  color: isCorrect ? 'var(--success)' : (isPartiallyCorrect ? 'var(--warning)' : 'var(--error)'),
                  textAlign: 'center', 
                  fontWeight: 'bold',
                  marginBottom: '16px',
                  border: `1px solid ${isCorrect ? 'var(--success)' : 'currentColor'}`
                }}>
                  {isCorrect ? '🎉 太棒了，全部答对！' : isPartiallyCorrect ? `😄 答对 ${correctCount} 个，继续加油！` : '❌ 回答错误，请看解析'}
                </div>

                {/* 解析部分 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {explanation ? (
                    <button className="xzt-btn xzt-btn-warning" onClick={() => setShowExplanation(s => !s)}>
                      <FaLightbulb /> {showExplanation ? '收起解析' : '查看解析'}
                    </button>
                  ) : (
                    <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', color: 'var(--text-sub)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaHourglassHalf style={{ marginRight: '8px' }}/> 智能解析生成中...
                    </div>
                  )}

                  {showExplanation && explanation && (
                    <div className="fade-in" style={{ 
                      backgroundColor: '#fffbeb', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      color: '#92400e',
                      lineHeight: '1.6',
                      fontSize: '0.95rem',
                      borderLeft: '4px solid var(--warning)'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>💡 题目解析：</div>
                      {explanation}
                    </div>
                  )}

                  {/* 底部导航按钮 */}
                  <button className="xzt-btn xzt-btn-gray" onClick={handleNextOrReset}>
                    {onNext ? <><FaArrowRight /> 下一题</> : <><FaRedo /> 再试一次</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default XuanZeTi;
