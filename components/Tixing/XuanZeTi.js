import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp } from 'react-icons/fa';
// 确保安装了 pinyin-pro: npm install pinyin-pro
import { pinyin } from 'pinyin-pro';

const cssStyles = `
  .xzt-container { width: 100%; max-width: 500px; display: flex; flex-direction: column; height: 100%; position: relative; }
  
  /* 题目卡片 */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 20px;
    padding: 20px 12px;
    margin-bottom: 20px;
    text-align: center;
    box-shadow: 0 8px 25px -8px rgba(59, 130, 246, 0.12);
    border: 1px solid #f1f5f9;
    cursor: pointer;
    transition: transform 0.1s;
    position: relative;
    overflow: hidden;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  .icon-pulse { animation: pulse 1.5s infinite; color: #3b82f6; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  /* 拼音汉字样式 - 字号调小 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; row-gap: 8px; }
  .char-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    margin: 0 2px;
  }
  .char-block:active .cn-text { color: #3b82f6; }
  .py-text { font-size: 0.85rem; color: #64748b; font-weight: 500; margin-bottom: -2px; font-family: 'Courier New', monospace; min-height: 1.2em;}
  /* 汉字字号从 2.4rem -> 1.8rem，防止太占地 */
  .cn-text { font-size: 1.8rem; font-weight: 800; color: #1e2b3b; line-height: 1.2; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }

  /* 选项区域 */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    width: 100%;
    /* 底部留白，确保不被悬浮按钮遮挡 */
    padding-bottom: 100px; 
  }

  .xzt-option-card {
    position: relative;
    display: flex;
    flex-direction: row; /* 图片和文字水平排列 */
    align-items: center;
    justify-content: flex-start;
    padding: 12px 16px;
    background-color: #fff;
    border-radius: 16px;
    border: 2px solid #f1f5f9;
    box-shadow: 0 2px 5px rgba(0,0,0,0.03);
    cursor: pointer;
    transition: all 0.15s;
    min-height: 60px;
  }
  .xzt-option-card:active { transform: scale(0.97); background-color: #f8fafc; }
  .xzt-option-card.selected { border-color: #3b82f6; background-color: #eff6ff; }
  .xzt-option-card.correct { border-color: #22c55e; background-color: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #ef4444; background-color: #fef2f2; animation: shake 0.4s; }

  /* 选项图片 */
  .option-img {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    object-fit: cover;
    margin-right: 12px;
    background: #f1f5f9;
  }

  .xzt-option-text { font-size: 1.1rem; font-weight: 600; color: #334155; flex: 1; text-align: left; }

  /* 提交按钮 - 关键修改 */
  .submit-btn-wrapper {
    position: fixed; /* 改为 fixed，相对于屏幕 */
    bottom: 90px;   /* 🚀 抬高到底部 90px，绝对不会和页码重叠 */
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none; /* 容器不挡点击 */
    z-index: 50;
  }
  .submit-btn {
    pointer-events: auto;
    min-width: 140px;
    max-width: 200px; /* 限制最大宽度 */
    padding: 12px 30px;
    border-radius: 50px; /* 全圆角 */
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    background: #3b82f6;
    box-shadow: 0 6px 20px -5px rgba(59, 130, 246, 0.5);
    transition: all 0.2s;
    border: none;
  }
  .submit-btn:disabled { background: #cbd5e1; box-shadow: none; opacity: 0; transform: translateY(20px); pointer-events: none; }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

// TTS 播放函数
const playTTS = (text) => {
  if (!text) return;
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  const audio = new Audio(url);
  audio.play().catch(e => console.log('TTS playback failed', e));
};

// 判断是否为汉字
const isChineseChar = (char) => {
  return /[\u4e00-\u9fa5]/.test(char);
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [pinyinData, setPinyinData] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化
  useEffect(() => {
    if (question.text) {
      try {
        const text = question.text;
        // 获取拼音数组
        const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
        
        let pinyinIndex = 0;
        const combined = text.split('').map((char) => {
          // 只有汉字才分配拼音，其他符号拼音为空
          if (isChineseChar(char)) {
            const py = pinyins[pinyinIndex] || '';
            pinyinIndex++;
            return { char, pinyin: py };
          } else {
            // 非汉字不消耗拼音索引
            return { char, pinyin: '' };
          }
        });
        setPinyinData(combined);
      } catch (e) {
        console.error("Pinyin error:", e);
        // 降级：直接按字拆分，无拼音
        setPinyinData(question.text.split('').map(char => ({ char, pinyin: '' })));
      }
    } else {
      setPinyinData([]);
    }
    // 重置
    setSelectedId(null);
    setIsSubmitted(false);
  }, [question]);

  const handleSelect = (id) => {
    if (isSubmitted) return;
    setSelectedId(id);
  };

  const handleSubmit = () => {
    // 强制转换为 String 进行比较，防止 '1' !== 1 的问题
    if (!selectedId || isSubmitted) return;
    
    setIsSubmitted(true);
    
    // 兼容 String/Number 类型的 ID 对比
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.8 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1500);
    } else {
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedId(null);
      }, 1500);
    }
  };

  const handleRead = (e, text) => {
    if(e) e.stopPropagation();
    setIsPlaying(true);
    playTTS(text);
    setTimeout(() => setIsPlaying(false), 1500);
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* --- 题目卡片 --- */}
        <div className="xzt-question-card" onClick={(e) => handleRead(e, question.text)}>
          <div className="absolute top-3 right-3 text-slate-300">
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {pinyinData.length > 0 ? pinyinData.map((item, idx) => (
              <div key={idx} className="char-block" onClick={(e) => handleRead(e, item.char)}>
                {/* 只有有拼音时才显示拼音行，否则留空保持对齐或不显示 */}
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                <span className="cn-text">{item.char}</span>
              </div>
            )) : (
              <h2 className="text-xl font-bold">{question.text}</h2>
            )}
          </div>
        </div>

        {/* --- 选项区域 --- */}
        <div className="xzt-options-grid">
          {options.map(option => {
            let statusClass = '';
            // 同样转为 String 对比
            const optId = String(option.id);
            const selId = String(selectedId);
            const corrIds = correctAnswer.map(String);

            if (isSubmitted) {
              if (corrIds.includes(optId)) statusClass = 'correct'; 
              else if (optId === selId) statusClass = 'incorrect';
            } else {
              if (optId === selId) statusClass = 'selected';
            }

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${statusClass}`}
                onClick={() => handleSelect(option.id)}
              >
                {/* ✅ 图片回归 */}
                {option.imageUrl && (
                  <img src={option.imageUrl} alt="option" className="option-img" />
                )}
                
                <div className="xzt-option-text">{option.text}</div>
                
                {isSubmitted && corrIds.includes(optId) && <FaCheckCircle className="text-green-500 absolute right-4 text-xl"/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && <FaTimesCircle className="text-red-500 absolute right-4 text-xl"/>}
              </div>
            );
          })}
        </div>

        {/* --- 提交按钮 (悬浮) --- */}
        <div className="submit-btn-wrapper">
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || isSubmitted}
          >
            {isSubmitted 
              ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "错误") 
              : "提 交"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
