// components/Tixing/XuanZeTi.js (V6 - 多邻国模式适配版)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Howl } from 'howler';
import { 
  FaCheckCircle, FaTimesCircle, FaVolumeUp, FaEye, FaEyeSlash 
} from 'react-icons/fa';
import ReactPlayer from 'react-player/lazy';

// --- 样式定义 ---
const cssStyles = `
  :root {
    --primary: #3b82f6;
    --success: #58cc02; /* 多邻国绿 */
    --error: #ff4b4b;   /* 多邻国红 */
    --bg-card: #ffffff;
    --text-main: #1e2b3b;
    --text-sub: #475569;
    --shadow-sm: 0 2px 0 0 rgba(0,0,0,0.05);
    --shadow-btn: 0 4px 0 0 rgba(0,0,0,0.1); /* 立体阴影 */
  }

  .xzt-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  /* 选项网格布局 */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr; /* 默认单列 */
    gap: 12px;
    width: 100%;
  }

  @media (min-width: 640px) {
    .xzt-options-grid {
      grid-template-columns: repeat(2, 1fr); /* 平板/桌面双列 */
    }
  }

  /* 选项卡片样式 */
  .xzt-option-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background-color: var(--bg-card);
    border-radius: 16px;
    border: 2px solid #e5e7eb; /* 默认灰边框 */
    border-bottom-width: 4px; /* 立体感 */
    cursor: pointer;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    min-height: 80px;
  }

  .xzt-option-card:active {
    transform: translateY(2px);
    border-bottom-width: 2px;
  }

  /* 1. 选中状态 (未提交) - 变蓝 */
  .xzt-option-card.selected {
    border-color: var(--primary);
    background-color: #eff6ff;
  }

  /* 2. 正确状态 (已提交) - 变绿 */
  .xzt-option-card.correct {
    border-color: var(--success);
    background-color: #d7ffb8;
  }

  /* 3. 错误状态 (已提交) - 变红 */
  .xzt-option-card.incorrect {
    border-color: var(--error);
    background-color: #ffdfe0;
  }

  /* 选项内元素 */
  .xzt-option-image {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    margin-bottom: 12px;
  }

  .xzt-option-text {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-sub);
    text-align: center;
    line-height: 1.4;
  }
  
  /* 听力播放按钮 */
  .xzt-listen-btn {
    background-color: var(--primary);
    color: white;
    border-radius: 20px;
    padding: 10px 24px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-bottom: 4px solid #2563eb;
    cursor: pointer;
    margin-bottom: 24px;
    transition: all 0.1s;
  }
  
  .xzt-listen-btn:active {
    transform: translateY(2px);
    border-bottom: 0px;
    margin-bottom: 26px; /* 补位 */
  }

  /* 淡入动画 */
  .fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// --- 音效管理 ---
const sounds = {
  click: typeof window !== 'undefined' ? new Howl({ src: ['/sounds/click.mp3'], volume: 0.4 }) : null,
};
const playSound = (name) => sounds[name]?.play();

const XuanZeTi = ({ 
  question = {}, 
  options = [], 
  correctAnswer = [], // ID 数组，例如 ['A'] 或 [1]
  isSubmitted = false, // 核心 Prop：由父组件控制是否显示答案
  onSelect,            // 核心 Prop：(isCorrect) => void
  settings = {}        // 包含 playTTS 等
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const ttsRef = useRef(null);

  // 判断是否多选
  const isMultipleChoice = correctAnswer.length > 1;

  // 重置逻辑：当题目变了，清空本地选中状态
  useEffect(() => {
    setSelectedAnswers([]);
    setShowTranscript(false);
  }, [question]);

  // TTS 播放
  const handlePlayTTS = () => {
    if (question.text && settings.playTTS) {
       settings.playTTS(question.text, 'zh');
    }
  };

  // 点击选项逻辑
  const handleOptionClick = useCallback((optionId) => {
    // 1. 如果已提交，禁止操作
    if (isSubmitted) return;

    playSound('click');

    // 2. 更新选中状态
    let newSelection = [];
    if (isMultipleChoice) {
      newSelection = selectedAnswers.includes(optionId) 
        ? selectedAnswers.filter(id => id !== optionId) 
        : [...selectedAnswers, optionId];
    } else {
      newSelection = [optionId];
    }
    
    setSelectedAnswers(newSelection);

    // 3. 立即计算正确性，并通知父组件
    // 逻辑：选中的ID数组 和 正确答案ID数组 必须完全一致
    // (简单的排序比较)
    const sortedSelected = [...newSelection].sort();
    const sortedCorrect = [...correctAnswer].sort();
    const isCorrectNow = JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
    
    // 调用父组件回调
    if (onSelect) {
        onSelect(isCorrectNow);
    }

  }, [isSubmitted, isMultipleChoice, selectedAnswers, correctAnswer, onSelect]);

  return (
    <>
      <style>{cssStyles}</style>
      
      <div className="xzt-container">
          
          {/* --- 题目展示区 (Media & Text) --- */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            
            {/* 视频 */}
            {question.videoUrl && (
              <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <ReactPlayer url={question.videoUrl} controls width="100%" height="auto" />
              </div>
            )}

            {/* 音频/TTS */}
            {(question.audioUrl || question.text) && (
              <button className="xzt-listen-btn" onClick={handlePlayTTS}>
                <FaVolumeUp size={20} />
                <span style={{ fontWeight: 'bold' }}>播放题目</span>
              </button>
            )}

            {/* 图片 */}
            {question.imageUrl && !question.videoUrl && (
              <img 
                src={question.imageUrl} 
                alt="题目" 
                style={{ width: '100%', maxHeight:'250px', objectFit:'contain', borderRadius: '16px', marginBottom: '20px' }} 
              />
            )}
            
            {/* 文字题干 */}
            {question.text && (
               <h3 className="fade-in" style={{ 
                 fontSize: '1.25rem', 
                 fontWeight: '700', 
                 color: 'var(--text-main)', 
                 lineHeight: 1.5 
               }}>
                 {question.text}
               </h3>
            )}
          </div>

          {/* --- 选项交互区 (核心) --- */}
          <div className="xzt-options-grid">
            {options.map(option => {
              // 动态计算 Class
              let cardClass = 'xzt-option-card';
              
              // 状态判断
              const isSelected = selectedAnswers.includes(option.id);
              const isOptionCorrect = correctAnswer.includes(option.id);

              if (isSubmitted) {
                // --- 提交后的样式逻辑 ---
                if (isOptionCorrect) {
                  // 无论选没选，正确答案永远显绿
                  cardClass += ' correct';
                } else if (isSelected && !isOptionCorrect) {
                  // 选了且是错的，显红
                  cardClass += ' incorrect';
                }
                // 没选且是错的，保持默认白色
              } else {
                // --- 未提交的样式逻辑 ---
                if (isSelected) {
                  cardClass += ' selected';
                }
              }

              return (
                <div 
                  key={option.id} 
                  className={cardClass} 
                  onClick={() => handleOptionClick(option.id)}
                >
                  {option.imageUrl && (
                    <img src={option.imageUrl} alt="option" className="xzt-option-image"/>
                  )}
                  
                  {option.text && (
                    <div className="xzt-option-text">{option.text}</div>
                  )}
                  
                  {/* 右上角结果图标 (仅提交后显示) */}
                  {isSubmitted && isOptionCorrect && (
                    <FaCheckCircle style={{ 
                        position: 'absolute', top: 10, right: 10, 
                        color: 'var(--success)', fontSize: '1.4rem',
                        background: 'white', borderRadius: '50%'
                    }}/>
                  )}
                  {isSubmitted && isSelected && !isOptionCorrect && (
                    <FaTimesCircle style={{ 
                        position: 'absolute', top: 10, right: 10, 
                        color: 'var(--error)', fontSize: '1.4rem',
                        background: 'white', borderRadius: '50%'
                    }}/>
                  )}
                </div>
              );
            })}
          </div>

      </div>
    </>
  );
};

export default XuanZeTi;
