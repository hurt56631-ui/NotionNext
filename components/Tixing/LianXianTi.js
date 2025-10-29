// components/Tixing/LianXianTi.js (V16 - 单文件版本，样式内联)
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaVolumeUp, FaEye, FaRedo, FaSpinner, FaCheck } from 'react-icons/fa';

// --- 样式定义 ---
// 将所有CSS样式作为字符串放在这里。
// 为了防止样式污染全局，所有规则都包含在 .lian-xian-ti-wrapper 作用域内。
const ComponentStyles = `
  /* 关键帧动画是全局的，所以保持在顶层 */
  @keyframes lxt-spin { 100% { transform: rotate(360deg); } }
  @keyframes lxt-fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .lian-xian-ti-wrapper {
    /* 定义CSS变量，作用域限定在此组件内 */
    --primary: #3b82f6;
    --primary-dark: #6366f1;
    --success: #22c55e;
    --error: #ef4444;
    --warning: #f59e0b;
    --gray: #64748b;
    --text-primary: #1e2b3b;
    --text-secondary: #64748b;
    --bg-container: #f7f9fc;
    --bg-card: rgba(255, 255, 255, 0.9);
    --bg-success: rgba(34, 197, 94, 0.08);
    --bg-error: rgba(239, 68, 68, 0.08);
    --radius-container: 28px;
    --radius-card: 20px;
    --radius-button: 12px;
    --shadow-container: 0 8px 40px rgba(0, 0, 0, 0.08);
    --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04);
    
    /* --- 主容器 --- */
    background-color: var(--bg-container);
    border-radius: var(--radius-container);
    padding: 24px;
    box-shadow: var(--shadow-container);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    max-width: 700px;
    width: 95%;
    margin: 2rem auto;
    user-select: none;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  /* --- 标题 --- */
  .lian-xian-ti-wrapper .titleContainer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .lian-xian-ti-wrapper .title {
    font-size: 1.6rem;
    font-weight: bold;
    color: var(--text-primary);
    text-align: center;
  }
  .lian-xian-ti-wrapper .readAloudButton {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--primary);
    font-size: 1.5rem;
    transition: transform 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .lian-xian-ti-wrapper .readAloudButton:hover {
    transform: scale(1.1);
  }

  /* --- 核心交互区 --- */
  .lian-xian-ti-wrapper .mainArea {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: stretch;
  }
  .lian-xian-ti-wrapper .column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 47%;
    z-index: 2;
  }

  /* --- 可选项 (Item) --- */
  .lian-xian-ti-wrapper .item {
    background: var(--bg-card);
    border: 2px solid transparent;
    font-family: inherit;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    border-bottom-width: 4px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 90px;
    justify-content: center;
    flex: 1;
    position: relative;
    border-left-color: var(--item-color, transparent);
    border-left-width: 6px;
  }
  .lian-xian-ti-wrapper .itemImage {
    height: 75px;
    width: auto;
    max-width: 90%;
    border-radius: 12px;
    object-fit: contain;
  }
  .lian-xian-ti-wrapper .itemContent {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-align: center;
  }
  .lian-xian-ti-wrapper .pinyin {
    font-size: 0.8rem;
    color: var(--text-secondary);
    height: 1.1em;
  }

  /* --- Item 状态 --- */
  .lian-xian-ti-wrapper .item.selected {
    border-color: var(--primary-dark);
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 8px 10px -6px rgba(99, 102, 241, 0.1);
  }
  .lian-xian-ti-wrapper .item.paired {
    border-color: var(--item-color, var(--primary));
  }
  .lian-xian-ti-wrapper .item.correct {
    border-color: var(--success) !important;
    background: var(--bg-success);
  }
  .lian-xian-ti-wrapper .item.incorrect {
    border-color: var(--error) !important;
    background: var(--bg-error);
  }

  .lian-xian-ti-wrapper .ttsLoader {
    position: absolute;
    top: 8px;
    right: 8px;
    color: var(--primary);
    animation: lxt-spin 1s linear infinite;
  }

  /* --- SVG 连线 --- */
  .lian-xian-ti-wrapper .svgContainer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }
  .lian-xian-ti-wrapper .path {
    fill: none;
    stroke: var(--primary);
    stroke-width: 3.5;
    transition: stroke 0.3s ease, opacity 0.3s ease;
    opacity: 0.8;
  }
  .lian-xian-ti-wrapper .pathCorrect {
    stroke: var(--success) !important;
    stroke-width: 4;
  }
  .lian-xian-ti-wrapper .pathIncorrect {
    stroke: var(--error) !important;
    stroke-width: 4;
    stroke-dasharray: 4 4;
  }

  /* --- 底部按钮 --- */
  .lian-xian-ti-wrapper .buttonContainer {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 24px;
  }
  .lian-xian-ti-wrapper .actionButton {
    padding: 14px 28px;
    border-radius: var(--radius-button);
    border: none;
    background-color: var(--primary);
    color: white;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lian-xian-ti-wrapper .actionButton:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .lian-xian-ti-wrapper .actionButton:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.7;
    pointer-events: none;
  }
  .lian-xian-ti-wrapper .warningButton { background-color: var(--warning); }
  .lian-xian-ti-wrapper .grayButton { background-color: var(--gray); }

  /* --- 结束信息 --- */
  .lian-xian-ti-wrapper .finishMessage {
    text-align: center;
    margin-top: 24px;
    font-size: 1.5rem;
    font-weight: bold;
    animation: lxt-fadeIn 0.5s ease-out forwards;
  }
  .lian-xian-ti-wrapper .finishMessageCorrect { color: var(--success); }
  .lian-xian-ti-wrapper .finishMessageError { color: var(--error); }
`;

// --- Helper & Config ---

// 一个简单的工具函数，用于动态合并CSS类名
const cx = (...args) => args.filter(Boolean).join(' ');

// 为左侧卡片定义的颜色池
const COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'
];

// 音频管理器和音效创建
const audioManager = { currentSound: null, stopCurrentSound: function() { this.currentSound?.stop(); this.currentSound = null; } };
const createSound = (src) => {
  const sound = new Howl({ src: [src], volume: 0.7 });
  sound.on('loaderror', (id, err) => console.error(`[Audio Error] Failed to load sound: ${src}`, err));
  return sound;
};
const sounds = {
  click: createSound('/sounds/click.mp3'),
  correct: createSound('/sounds/correct.mp3'),
  incorrect: createSound('/sounds/incorrect.mp3'),
};
const playSound = (name) => { 
  audioManager.stopCurrentSound(); 
  const soundToPlay = sounds[name];
  if (soundToPlay?.state() === 'loaded') {
    soundToPlay.play();
  } else if (!soundToPlay) {
    console.error(`[Audio Error] Sound not found: ${name}`);
  }
};


// --- Component ---

const LianXianTi = ({ title, columnA, columnB, pairs, onCorrect }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [ttsPlayingId, setTtsPlayingId] = useState(null);
  const itemRefs = useRef({});
  const containerRef = useRef(null);

  const columnAWithColor = useMemo(() => 
    columnA?.map((item, index) => ({
      ...item,
      color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    })) || [],
  [columnA]);
  
  const isAllPaired = userPairs.length === (columnA?.length || 0);
  const isAllCorrect = isSubmitted && userPairs.every(p => pairs[p.a] === p.b);

  const playTTS = useCallback(async (item, lang = 'zh') => {
    if (!item.content) return;
    audioManager.stopCurrentSound();
    setTtsPlayingId(item.id || 'title');
    const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural';
    try {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.content)}&v=${voice}&r=-15`;
      const ttsAudio = new Howl({ 
        src: [url], 
        html5: true,
        onend: () => setTtsPlayingId(null),
        onloaderror: (id, err) => { console.error(`[TTS Error] Load failed: ${url}`, err); setTtsPlayingId(null); },
        onplayerror: (id, err) => { console.error(`[TTS Error] Play failed: ${url}`, err); setTtsPlayingId(null); }
      });
      audioManager.currentSound = ttsAudio;
      ttsAudio.play();
    } catch (e) { console.error('[TTS Error] Critical failure in playTTS:', e); setTtsPlayingId(null); }
  }, []);
  
  useEffect(() => {
    if (title) playTTS({ content: title }, 'zh');
  }, [title, playTTS]);
  
  useEffect(() => {
    if (isAllCorrect) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      onCorrect?.();
    }
  }, [isAllCorrect, onCorrect]);
  
  useEffect(() => {
      setUserPairs([]);
      setIsSubmitted(false);
      setShowAnswers(false);
      setSelection({ a: null, b: null });
  }, [title, columnA, columnB]);

  const handleSelect = (column, item) => {
    if (isSubmitted || showAnswers) return;
    if (selection[column] === item.id) {
        playSound('click');
        setSelection({ ...selection, [column]: null });
        return;
    }
    playTTS(item, column === 'a' ? 'zh' : 'my');
    const newSelection = { ...selection, [column]: item.id };

    if (newSelection.a && newSelection.b) {
      setUserPairs(prevPairs => [
        ...prevPairs.filter(p => p.a !== newSelection.a && p.b !== newSelection.b),
        newSelection
      ]);
      setSelection({ a: null, b: null });
    } else {
      setSelection(newSelection);
    }
  };
    
  const handleCheckAnswers = () => {
      setIsSubmitted(true);
      const correctCount = userPairs.filter(p => pairs[p.a] === p.b).length;
      playSound(correctCount === columnA.length ? 'correct' : 'incorrect');
  };

  const handleShowAnswers = () => {
      setShowAnswers(true);
      const correctPairsArray = Object.entries(pairs).map(([keyA, valueB]) => ({ a: keyA, b: valueB }));
      setUserPairs(correctPairsArray);
  };
  
  const handleReset = () => {
    setUserPairs([]);
    setIsSubmitted(false);
    setShowAnswers(false);
    setSelection({ a: null, b: null });
  };
    
  const getCurvePath = (startEl, endEl) => {
    if (!startEl || !endEl || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rectA = startEl.getBoundingClientRect();
    const rectB = endEl.getBoundingClientRect();
    const x1 = rectA.right - containerRect.left;
    const y1 = rectA.top + rectA.height / 2 - containerRect.top;
    const x2 = rectB.left - containerRect.left;
    const y2 = rectB.top + rectB.height / 2 - containerRect.top;
    const offset = Math.abs(x2 - x1) * 0.4;
    return `M ${x1},${y1} C ${x1 + offset},${y1} ${x2 - offset},${y2} ${x2},${y2}`;
  };

  const renderItemContent = (item, hasPinyin = false) => (
    <>
      {ttsPlayingId === item.id && <FaSpinner className="ttsLoader" />}
      {item.imageUrl && <img src={item.imageUrl} alt={item.content || 'image'} className="itemImage" />}
      {item.content && (
        <div style={{opacity: ttsPlayingId === item.id ? 0.5 : 1}}>
          {hasPinyin && item.content && <div className="pinyin">{pinyin(item.content, { toneType: 'mark' })}</div>}
          <div className="itemContent">{item.content}</div>
        </div>
      )}
    </>
  );

  if (!columnAWithColor || !columnB) return <div>加载题目数据中...</div>;

  return (
    <div className="lian-xian-ti-wrapper">
      {/* 将样式注入到DOM中 */}
      <style>{ComponentStyles}</style>

      <div className="titleContainer">
        <h2 className="title">{title}</h2>
        <button className="readAloudButton" onClick={() => playTTS({content: title}, 'zh')} aria-label={`朗读标题: ${title}`}>
          <FaVolumeUp style={{ color: ttsPlayingId === 'title' ? 'var(--primary-dark)' : 'var(--primary)' }} />
        </button>
      </div>

      <div className="mainArea" ref={containerRef}>
        <div className="column">
          {columnAWithColor.map(item => (
            <button key={item.id}
              ref={el => itemRefs.current[item.id] = el}
              className={cx(
                'item',
                selection.a === item.id && 'selected',
                userPairs.some(p => p.a === item.id) && 'paired',
                isSubmitted && userPairs.some(p => p.a === item.id && pairs[p.a] === p.b) && 'correct',
                isSubmitted && userPairs.some(p => p.a === item.id && pairs[p.a] !== p.b) && 'incorrect',
              )}
              style={{ '--item-color': item.color }}
              onClick={() => handleSelect('a', item)}>
              {renderItemContent(item, true)}
            </button>
          ))}
        </div>

        <div className="column">
           {columnB.map(item => {
             const pairedInfo = userPairs.find(p => p.b === item.id);
             const pairedItemA = pairedInfo ? columnAWithColor.find(a => a.id === pairedInfo.a) : null;
             const isCorrect = pairedInfo && pairs[pairedInfo.a] === pairedInfo.b;
             
             return (
              <button key={item.id}
                ref={el => itemRefs.current[item.id] = el}
                className={cx(
                  'item',
                  selection.b === item.id && 'selected',
                  pairedInfo && 'paired',
                  (showAnswers || (isSubmitted && isCorrect)) && 'correct',
                  isSubmitted && pairedInfo && !isCorrect && 'incorrect',
                )}
                style={{ '--item-color': pairedItemA?.color || 'transparent' }}
                onClick={() => handleSelect('b', item)}>
                {renderItemContent(item)}
              </button>
             );
           })}
        </div>
        
        <svg className="svgContainer">
          {userPairs.map((pair, index) => {
            const pathData = getCurvePath(itemRefs.current[pair.a], itemRefs.current[pair.b]);
            if (!pathData) return null;
            const itemA = columnAWithColor.find(a => a.id === pair.a);
            const isCorrect = pairs[pair.a] === pair.b;
            const pathClass = cx(
              'path',
              (showAnswers || (isSubmitted && isCorrect)) && 'pathCorrect',
              isSubmitted && !isCorrect && 'pathIncorrect',
            );
            return <path key={index} d={pathData} className={pathClass} style={{ stroke: itemA?.color }} />;
          })}
        </svg>
      </div>

      <div className="buttonContainer">
        {!isSubmitted && !showAnswers && (
          <button className="actionButton" onClick={handleCheckAnswers} disabled={!isAllPaired}>
            <FaCheck /> 检查答案
          </button>
        )}
        {isSubmitted && !isAllCorrect && !showAnswers && (
          <button className={cx('actionButton', 'warningButton')} onClick={handleShowAnswers}>
            <FaEye /> 查看答案
          </button>
        )}
        {(isSubmitted || showAnswers) && (
          <button className={cx('actionButton', 'grayButton')} onClick={handleReset}>
            <FaRedo /> 再来一次
          </button>
        )}
      </div>
      
      {isSubmitted && (
        <div className={cx('finishMessage', isAllCorrect ? 'finishMessageCorrect' : 'finishMessageError')}>
          {isAllCorrect ? '🎉 太棒了，全部正确！' : '部分答案有误，请再看看哦！'}
        </div>
      )}
    </div>
  );
};

export default LianXianTi;
