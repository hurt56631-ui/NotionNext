import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

// --- 全局音频缓存池 (避免重复下载) ---
const audioCache = new Map();

// --- 样式定义 ---
const cssStyles = `
  /* 容器布局：保证内容居中且有呼吸感 */
  .xzt-container { 
    width: 100%; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
    justify-content: center; /* 垂直居中 */
    align-items: center;
    position: relative; 
    padding: 0 10px;
  }

  /* --- 题目卡片 --- */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 28px;
    padding: 24px 20px;
    text-align: center;
    /* 更加柔和且有层次的阴影 */
    box-shadow: 0 10px 40px -10px rgba(147, 197, 253, 0.3), 
                0 0 0 1px rgba(241, 245, 249, 1);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    width: 100%;
    max-width: 480px; /* 限制最大宽度，防止太宽 */
    margin-bottom: 30px; /* 与选项拉开距离 */
    display: flex;
    flex-direction: column; /* 图片在上，文字在下 */
    align-items: center;
    position: relative;
    overflow: hidden;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  /* 题目图片样式 */
  .question-img {
    width: 100%;
    max-height: 200px;
    object-fit: contain; /* 保持比例 */
    border-radius: 16px;
    margin-bottom: 16px;
    background-color: #f8fafc;
  }

  /* 喇叭图标 */
  .icon-pulse { animation: pulse 1.5s infinite; color: #6366f1; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  /* 拼音盒子 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; row-gap: 10px; }
  .char-block {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .py-text { font-size: 0.9rem; color: #94a3b8; font-weight: 500; margin-bottom: -2px; font-family: 'Courier New', monospace; min-height: 1.2em; }
  .cn-text { font-size: 2.0rem; font-weight: 800; color: #1e293b; line-height: 1.2; font-family: sans-serif; }

  /* --- 选项区域 --- */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    width: 100%;
    max-width: 480px;
    padding-bottom: 120px; /* 底部留白给按钮 */
  }

  /* 选项卡片基础样式 (浅色系 + 阴影) */
  .xzt-option-card {
    position: relative;
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 
                0 2px 4px -1px rgba(0, 0, 0, 0.03);
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
  }
  
  /* 选中/正确/错误 状态 */
  .xzt-option-card:active { transform: scale(0.97); background: #f1f5f9; }
  .xzt-option-card.selected { 
    border-color: #818cf8; 
    background: #eef2ff; /* 浅紫色背景 */
    box-shadow: 0 0 0 2px #c7d2fe;
  }
  .xzt-option-card.correct { 
    border-color: #4ade80; 
    background: #f0fdf4; /* 浅绿色背景 */
    box-shadow: 0 0 0 2px #bbf7d0;
  }
  .xzt-option-card.incorrect { 
    border-color: #f87171; 
    background: #fef2f2; /* 浅红色背景 */
    animation: shake 0.4s; 
  }

  /* 布局A：无图片 (文字居中，卡片紧凑) */
  .layout-text-only {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    min-height: 70px;
  }

  /* 布局B：有图片 (左图右文，卡片变大) */
  .layout-with-image {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    padding: 12px;
    min-height: 90px; /* 更高一点 */
  }

  /* 选项内图片 */
  .opt-img-wrapper {
    width: 70px;
    height: 70px;
    flex-shrink: 0;
    margin-right: 16px;
    border-radius: 12px;
    overflow: hidden;
    background-color: #f1f5f9;
    border: 1px solid #e2e8f0;
  }
  .opt-img { width: 100%; height: 100%; object-fit: cover; }

  /* 选项文字容器 */
  .opt-text-box {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
  }
  /* 文字居中模式 */
  .layout-text-only .opt-text-box { align-items: center; }
  /* 文字靠左模式 */
  .layout-with-image .opt-text-box { align-items: flex-start; }

  .opt-pinyin { font-size: 0.85rem; color: #94a3b8; margin-bottom: 2px; font-family: monospace; }
  .opt-cn { font-size: 1.25rem; font-weight: 700; color: #334155; line-height: 1.2; }
  .opt-en { font-size: 1.1rem; font-weight: 600; color: #475569; }

  /* 提交按钮 */
  .submit-btn-wrapper {
    position: fixed;
    bottom: 100px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none; 
    z-index: 60;
  }
  .submit-btn {
    pointer-events: auto;
    min-width: 160px;
    padding: 14px 32px;
    border-radius: 50px;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); /* 渐变紫蓝 */
    box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
    border: none;
    transition: all 0.2s;
  }
  .submit-btn:disabled { 
    background: #cbd5e1; 
    color: #fff;
    box-shadow: none; 
    transform: translateY(20px); 
    opacity: 0;
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

// --- 核心工具函数 ---

// 1. 带缓存的 TTS 播放器 (支持语速)
const playTTS = async (text, rate = 0.8) => {
  if (!text) return;
  
  // 生成缓存键值 (文本+语速)
  const cacheKey = `${text}-${rate}`;

  try {
    let audioUrl;
    
    // 检查缓存
    if (audioCache.has(cacheKey)) {
      audioUrl = audioCache.get(cacheKey);
    } else {
      // 没缓存，去下载
      const apiUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=${rate}`; // r参数控制语速? 假设API支持，或者需要前端控制
      // 注意：微软TTS API 通常是在 ssml 里控制 rate，这里简单的 URL 参数可能不生效，
      // 如果后端不支持 r 参数，我们可以在 audio 标签上控制 playbackRate。
      
      const response = await fetch(apiUrl);
      const blob = await response.blob();
      audioUrl = URL.createObjectURL(blob);
      audioCache.set(cacheKey, audioUrl);
    }

    const audio = new Audio(audioUrl);
    // 前端强制控制语速 (最稳妥的方式)
    audio.playbackRate = rate; 
    await audio.play();
  } catch (e) {
    console.error("TTS Playback failed", e);
  }
};

// 2. 拼音生成器
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);
const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    let pyIndex = 0;
    return chars.map((char) => {
      if (isChineseChar(char)) {
        const py = pinyins[pyIndex] || '';
        pyIndex++;
        return { char, pinyin: py };
      } else {
        return { char, pinyin: '' };
      }
    });
  } catch (e) {
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [processedOptions, setProcessedOptions] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化数据
  useEffect(() => {
    // 1. 题目拼音
    setQuestionPinyin(generatePinyinData(question.text));

    // 2. 选项预处理 (生成拼音 + 标记是否有中文 + 标记是否有图)
    const newOptions = options.map(opt => {
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text);
      return {
        ...opt,
        pinyinData: hasChinese ? generatePinyinData(opt.text) : [],
        isChinese: hasChinese,
        hasImage: !!opt.imageUrl // 标记是否有图
      };
    });
    setProcessedOptions(newOptions);

    // 缓存题目音频
    if (question.text) playTTS(question.text, 0.8).then(() => {}).catch(() => {}); // 预加载但不播放，或者不await

    // 重置
    setSelectedId(null);
    setIsSubmitted(false);
  }, [question, options]);

  // 选中逻辑
  const handleSelect = (option) => {
    if (isSubmitted) return;
    
    setSelectedId(option.id);
    // 选中时朗读选项文字，语速 0.8
    if (option.text) {
      playTTS(option.text, 0.8);
    }
  };

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      // 答对特效
      confetti({ 
        particleCount: 150, 
        spread: 80, 
        origin: { y: 0.7 },
        colors: ['#a786ff', '#fd8bbc', '#eca184', '#f8deb1'] // 彩带颜色
      });
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

  // 点击题目朗读
  const handleReadQuestion = (e) => {
    e.stopPropagation();
    setIsPlaying(true);
    playTTS(question.text, 0.9); // 题目语速稍快一点点
    setTimeout(() => setIsPlaying(false), 2000);
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* --- 题目卡片 (上图下文) --- */}
        <div className="xzt-question-card" onClick={handleReadQuestion}>
          
          {/* 题目图片 (如果有) */}
          {question.imageUrl && (
            <img src={question.imageUrl} alt="Question" className="question-img" />
          )}

          {/* 喇叭状态 */}
          <div className="absolute top-3 right-3 text-slate-300">
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {questionPinyin.map((item, idx) => (
              <div key={idx} className="char-block">
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        {/* --- 选项区域 --- */}
        <div className="xzt-options-grid">
          {processedOptions.map(option => {
            let statusClass = '';
            const optId = String(option.id);
            const selId = String(selectedId);
            const corrIds = correctAnswer.map(String);

            if (isSubmitted) {
              if (corrIds.includes(optId)) statusClass = 'correct'; 
              else if (optId === selId) statusClass = 'incorrect';
            } else {
              if (optId === selId) statusClass = 'selected';
            }

            // 根据是否有图片决定布局类名
            const layoutClass = option.hasImage ? 'layout-with-image' : 'layout-text-only';

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${layoutClass} ${statusClass}`}
                onClick={() => handleSelect(option)}
              >
                {/* 1. 左侧图片 (如果有) */}
                {option.hasImage && (
                  <div className="opt-img-wrapper">
                    <img src={option.imageUrl} alt="opt" className="opt-img" />
                  </div>
                )}

                {/* 2. 右侧/中间 文字区域 */}
                <div className="opt-text-box">
                  {option.isChinese ? (
                    <>
                      {/* 自动生成拼音 */}
                      <div className="opt-pinyin">
                        {option.pinyinData.map(d => d.pinyin).join(' ')}
                      </div>
                      <div className="opt-cn">{option.text}</div>
                    </>
                  ) : (
                    <div className="opt-en">{option.text}</div>
                  )}
                </div>
                
                {/* 状态图标 (绝对定位在右侧) */}
                {isSubmitted && corrIds.includes(optId) && <FaCheckCircle className="text-green-500 absolute right-3 text-xl"/>}
                {isSubmitted && optId === selId && !corrIds.includes(optId) && <FaTimesCircle className="text-red-500 absolute right-3 text-xl"/>}
              </div>
            );
          })}
        </div>

        {/* --- 提交按钮 --- */}
        <div className="submit-btn-wrapper">
          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={!selectedId || isSubmitted}
          >
            {isSubmitted 
              ? (correctAnswer.map(String).includes(String(selectedId)) ? "正确" : "错误") 
              : "确认"
            }
          </button>
        </div>

      </div>
    </>
  );
};

export default XuanZeTi;
