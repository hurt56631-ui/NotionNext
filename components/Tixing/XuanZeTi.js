import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaCheckCircle, FaTimesCircle, FaVolumeUp } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';

const cssStyles = `
  /* 容器：占满高度，用于垂直布局 */
  .xzt-container { 
    width: 100%; 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
    position: relative; 
  }
  
  /* 
     布局核心：
     1. 上部空间 (flex-1)
     2. 题目卡片 (无 flex，自然高度)
     3. 中间空间 (flex-1)
     这样可以把题目“夹”在中间
  */
  .spacer { flex: 1; min-height: 20px; }

  /* --- 题目卡片 --- */
  .xzt-question-card {
    background: #ffffff;
    border-radius: 24px;
    padding: 30px 20px;
    text-align: center;
    box-shadow: 0 12px 40px -12px rgba(59, 130, 246, 0.15);
    border: 1px solid #f1f5f9;
    cursor: pointer;
    transition: transform 0.1s;
    position: relative;
    width: 100%;
    margin: 0 auto;
  }
  .xzt-question-card:active { transform: scale(0.98); }

  /* 喇叭图标 */
  .icon-pulse { animation: pulse 1.5s infinite; color: #3b82f6; }
  @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }

  /* 题目文字样式 */
  .pinyin-box { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; row-gap: 12px; }
  .char-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* 取消单个字的点击手势，改为整体点击 */
    cursor: inherit; 
  }
  .py-text { font-size: 0.9rem; color: #94a3b8; font-weight: 500; margin-bottom: -2px; font-family: 'Courier New', monospace; min-height: 1.2em; }
  .cn-text { font-size: 2.2rem; font-weight: 800; color: #1e2b3b; line-height: 1.1; font-family: sans-serif; }

  /* --- 选项区域 --- */
  .xzt-options-grid {
    display: grid;
    grid-template-columns: 1fr; /* 单列 */
    gap: 12px;
    width: 100%;
    /* 底部留白，给提交按钮腾位置 */
    padding-bottom: 110px; 
    margin-top: auto; /* 把选项推到底部 */
  }

  /* 选项卡片优化 */
  .xzt-option-card {
    position: relative;
    display: flex;
    flex-direction: column; /* 上下排列：拼音在上，汉字在下 */
    align-items: center;    /* 水平居中 */
    justify-content: center;
    padding: 10px 16px;     /* 减小内边距，让卡片变矮 */
    background-color: #fff;
    border-radius: 16px;
    border: 2px solid #f8fafc;
    box-shadow: 0 4px 6px -2px rgba(0, 0, 0, 0.03);
    cursor: pointer;
    transition: all 0.1s;
    min-height: 68px;       /* 限制最小高度，不要太高 */
    width: 100%;            /* 确保占满宽度，修复点击盲区 */
  }
  
  .xzt-option-card:active { transform: scale(0.98); background-color: #f1f5f9; }
  .xzt-option-card.selected { border-color: #3b82f6; background-color: #eff6ff; }
  .xzt-option-card.correct { border-color: #22c55e; background-color: #f0fdf4; }
  .xzt-option-card.incorrect { border-color: #ef4444; background-color: #fef2f2; animation: shake 0.4s; }

  /* 选项中的文字样式 */
  .opt-pinyin { 
    font-size: 0.8rem; 
    color: #94a3b8; 
    margin-bottom: 2px; 
    font-family: monospace;
  }
  .opt-cn { 
    font-size: 1.3rem; 
    font-weight: 700; 
    color: #334155; 
    line-height: 1.2;
  }
  /* 纯英文选项的样式 */
  .opt-en { font-size: 1.1rem; font-weight: 600; color: #334155; }

  /* 提交按钮悬浮条 */
  .submit-btn-wrapper {
    position: fixed;
    bottom: 100px; /* 再次抬高，避开页码 */
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none; 
    z-index: 60;
  }
  .submit-btn {
    pointer-events: auto;
    width: 180px;
    height: 54px;
    border-radius: 54px;
    font-size: 1.1rem;
    font-weight: 800;
    color: white;
    background: #3b82f6;
    box-shadow: 0 8px 25px -6px rgba(59, 130, 246, 0.5);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .submit-btn:disabled { 
    background: #e2e8f0; 
    color: #94a3b8;
    box-shadow: none; 
    transform: translateY(10px); 
    opacity: 0;
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.95); }

  @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
`;

// 工具：播放TTS
const playTTS = (text) => {
  if (!text) return;
  const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural`;
  new Audio(url).play().catch(e => {});
};

// 工具：判断汉字
const isChineseChar = (char) => /[\u4e00-\u9fa5]/.test(char);

// 工具：给文本加拼音 (用于题目和选项)
const generatePinyinData = (text) => {
  if (!text) return [];
  try {
    // 1. 获取纯拼音数组
    const pinyins = pinyin(text, { type: 'array', toneType: 'symbol' }) || [];
    const chars = text.split('');
    
    let pyIndex = 0;
    return chars.map((char) => {
      // 只有汉字才消耗一个拼音
      if (isChineseChar(char)) {
        const py = pinyins[pyIndex] || '';
        pyIndex++;
        return { char, pinyin: py };
      } else {
        return { char, pinyin: '' }; // 标点或英文无拼音
      }
    });
  } catch (e) {
    // 降级：直接返回字符，无拼音
    return text.split('').map(c => ({ char: c, pinyin: '' }));
  }
};

const XuanZeTi = ({ question = {}, options = [], correctAnswer = [], onCorrect }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questionPinyin, setQuestionPinyin] = useState([]);
  const [processedOptions, setProcessedOptions] = useState([]); // 存带拼音的选项
  const [isPlaying, setIsPlaying] = useState(false);

  // 初始化：处理题目和选项的拼音
  useEffect(() => {
    // 1. 处理题目拼音
    setQuestionPinyin(generatePinyinData(question.text));

    // 2. 处理选项拼音 (给每个选项对象增加 pinyinHtml 结构数据)
    const newOptions = options.map(opt => {
      // 如果选项包含中文，就生成拼音数据；否则(比如图片题或纯英文)保持原样
      const hasChinese = /[\u4e00-\u9fa5]/.test(opt.text);
      if (hasChinese) {
        return {
          ...opt,
          pinyinData: generatePinyinData(opt.text),
          isChinese: true
        };
      }
      return { ...opt, isChinese: false };
    });
    setProcessedOptions(newOptions);

    // 重置状态
    setSelectedId(null);
    setIsSubmitted(false);
  }, [question, options]);

  // 选择逻辑
  const handleSelect = (id) => {
    if (isSubmitted) return;
    setSelectedId(id);
    // 这里不需要 playSound('click')，因为通常用户希望安静选择，提交时再反馈
  };

  // 提交逻辑
  const handleSubmit = () => {
    if (!selectedId || isSubmitted) return;
    setIsSubmitted(true);
    
    // 转 String 防止类型不一致
    const isCorrect = correctAnswer.map(String).includes(String(selectedId));

    if (isCorrect) {
      // 答对
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
      new Audio('/sounds/correct.mp3').play().catch(()=>{});
      if (onCorrect) setTimeout(onCorrect, 1200);
    } else {
      // 答错
      new Audio('/sounds/incorrect.mp3').play().catch(()=>{});
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedId(null);
      }, 1500);
    }
  };

  // 朗读逻辑 (整句)
  const handleRead = (e, text) => {
    if(e) e.stopPropagation();
    setIsPlaying(true);
    playTTS(text);
    setTimeout(() => setIsPlaying(false), 2000);
  };

  return (
    <>
      <style>{cssStyles}</style>
      <div className="xzt-container">
        
        {/* 上部垫片：把题目往下顶一点 */}
        <div className="spacer" />

        {/* --- 题目卡片 (居中) --- */}
        <div className="xzt-question-card" onClick={(e) => handleRead(e, question.text)}>
          <div className="absolute top-3 right-3 text-slate-300">
            <FaVolumeUp className={isPlaying ? 'icon-pulse' : ''} />
          </div>

          <div className="pinyin-box">
            {questionPinyin.map((item, idx) => (
              <div key={idx} className="char-block">
                {/* 汉字上方显示拼音 */}
                {item.pinyin && <span className="py-text">{item.pinyin}</span>}
                <span className="cn-text">{item.char}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 下部垫片：把题目和选项分开 */}
        <div className="spacer" />

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

            return (
              <div 
                key={option.id} 
                className={`xzt-option-card ${statusClass}`}
                onClick={() => handleSelect(option.id)}
              >
                {/* 如果是中文，显示拼音+汉字结构 */}
                {option.isChinese ? (
                  <>
                    <div className="opt-pinyin">
                      {option.pinyinData.map(d => d.pinyin).join(' ')}
                    </div>
                    <div className="opt-cn">{option.text}</div>
                  </>
                ) : (
                  // 纯英文或数字，直接显示
                  <div className="opt-en">{option.text}</div>
                )}
                
                {/* 对错图标 */}
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
