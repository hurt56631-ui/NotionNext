import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp } from 'react-icons/fa';
// 确保安装了 pinyin-pro: npm install pinyin-pro
import { pinyin } from 'pinyin-pro';

const cssStyles = `
  .xzt-container { width: 100%; max-width: 500px; display: flex; flex-direction: column; height: 100%; }
  
  /* 题目卡片区域 - 增加白底投影，让用户知道这里是主要内容 */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 24px;
    padding: 24px 16px;
    margin-bottom: 24px;
    text-align: center;
    box-shadow: 0 10px 30px -10px rgba(59, 130, 246, 0.15);
    border: 1px solid #f1f5f9;
    cursor: pointer; /* 暗示可点击 */
    transition: transform 0.1s;
    position: relative;
    overflow: hidden;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  /* 喇叭图标动画 */
  .icon-pulse { animation: pulse 1.5s infinite; color: #3b82f6; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  /* 拼音汉字样式 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; row-gap: 8px; }
  .char-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  }
  .char-block:active .cn-text { color: #3b82f6; }
  .py-text { font-size: 1.1rem; color: #64748b; font-weight: 500; margin-bottom: -2px; font-family: 'Courier New', monospace; }
  .cn-text { font-size: 2.4rem; font-weight: 900; color: #1e2b3b; line-height: 1.1; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }

  /* 选项区域 */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    width: 100%;
    margin-bottom: 80px; /* 给底部按钮留位置 */
  }

  .xzt-option-card {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px 20px;
    background-color: #fff;
    border-radius: 16px;
    border: 2px solid #f1f5f9;
    box-shadow: 0 2px 5px rgba(0,0,0,0.03);
    cursor: pointer;
    transition: all 0.15s;
    min-height: 64px;
  }
  .xzt-option-card:active { transform: scale(0.97); background-color: #f8fafc; }
  .xzt-option-card.selected { border-color: #3b82f6; background-color: #eff6ff; }
  .xzt-option-card.correct { border-color: #22c55e; background-color: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #ef4444; background-color: #fef2f2; animation: shake 0.4s; }

  .xzt-option-text { font-size: 1.2rem; font-weight: 600; color: #334155; }

  /* 底部提交按钮 */
  .submit-btn-wrapper {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    padding: 0 20px;
    z-index: 50;
  }
  .submit-btn {
    width: 100%;
    padding: 16px;
    border-radius: 16px;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    background: #3b82f6;
    box-shadow: 0 8px 20px -5px rgba(59, 130, 246, 0.4);
    transition: all 0.2s;
    border: none;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; opacity: 0.7; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

// TTS 播放函数
const playTTS = (text) => {
  if (!text) return;
  // 使用简单的 Audio 对象播放
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.log('TTS playback failed', e));
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pinyinData, setPinyinData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化：生成拼音
  useEffect(() => {
    if (question.text) {
      try {
        const chars = question.text.split('');
        const pinyins = pinyin(question.text, { type: 'array', toneType: 'symbol' }) || [];
        const combined = chars.map((char, index) => ({
          char,
          pinyin: pinyins[index] || ''
        }));
        setPinyinData(combined);
      } catch (e) {
        console.error("Pinyin generation error:", e);
        setPinyinData([{ char: question.text, pinyin: '' }]);
      }
    } else {
      setPinyinData([]);
    }
    // 重置
    setSelectedId(null);
    setIsSubmitted(false);
  }, [question]);

  // 处理选项点击
  const handleSelect = (id) => {
    if (isSubmitted) return; // 提交后不能改
    setSelectedId(id);
    // 这里不直接提交，而是等待用户点按钮
  };

  // 处理提交
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    
    setIsSubmitted(true);
    const isCorrect = correctAnswer.includes(selectedId);

    if (isCorrect) {
      // 答对
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.8 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{}); // 需要本地有文件，没有不报错
      
      // 1.5秒后自动下一题
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      // 答错
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      
      // 答错后，延迟1秒允许重选（为了让用户看清错误）
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedId(null);
      }, 1500);
    }
  };

  // 处理点读
  const handleRead = (e, text) => {
    e.stopPropagation(); // 防止冒泡
    setIsPlaying(true);
    playTTS(text);
    setTimeout(() => setIsPlaying(false), 1500); // 简单模拟播放状态
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* --- 题目卡片 (可点击朗读) --- */}
        <div 
          className="xzt-question-card"
          onClick={(e) => handleRead(e, question.text)}
        >
          {/* 右上角喇叭提示 */}
          <div className="absolute top-3 right-3 text-slate-300">
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {pinyinData.length > 0 ? pinyinData.map((item, idx) => (
              <div 
                key={idx} 
                className="char-block"
                onClick={(e) => handleRead(e, item.char)} // 读单字
              >
                <span className="py-text">{item.pinyin}</span>
                <span className="cn-text">{item.char}</span>
              </div>
            )) : (
              // 如果没有拼音数据，显示普通文本
              <h2 className="text-2xl font-bold">{question.text || "题目加载中..."}</h2>
            )}
          </div>
        </div>

        {/* --- 选项区域 --- */}
        <div className="xzt-options-grid">
          {options.map(option => {
            let statusClass = '';
            // 如果已提交，显示正确/错误状态
            if (isSubmitted) {
              if (correctAnswer.includes(option.id)) statusClass = 'correct'; 
              else if (option.id === selectedId) statusClass = 'incorrect';
            } else {
              // 未提交，只显示选中状态
              if (option.id === selectedId) statusClass = 'selected';
            }

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${statusClass}`}
                onClick={() => handleSelect(option.id)}
              >
                <div className="xzt-option-text">{option.text}</div>
                {isSubmitted && correctAnswer.includes(option.id) && <FaCheckCircle className="text-green-500 absolute right-4 text-xl"/>}
                {isSubmitted && option.id === selectedId && !correctAnswer.includes(option.id) && <FaTimesCircle className="text-red-500 absolute right-4 text-xl"/>}
              </div>
            );
          })}
        </div>

        {/* --- 提交按钮 (悬浮在底部) --- */}
        <div className="submit-btn-wrapper">
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || isSubmitted} // 没选或者已提交时禁用
          >
            {isSubmitted 
              ? (correctAnswer.includes(selectedId) ? "回答正确！" : "回答错误，请重试") 
              : "确认提交"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
