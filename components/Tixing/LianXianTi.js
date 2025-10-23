// components/Tixing/LianXianTi.js (V11 - 优化卡片配对样式)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaVolumeUp, FaEye, FaRedo, FaSpinner, FaCheck } from 'react-icons/fa';

// 统一视觉主题
const theme = {
  primary: '#3b82f6',
  primaryDark: '#6366f1',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  gray: '#64748b',
  textPrimary: '#1e2b3b',
  textSecondary: '#64748b',
  bgContainer: '#f7f9fc',
  bgCard: 'rgba(255, 255, 255, 0.9)',
  bgSuccess: 'rgba(34, 197, 94, 0.08)',
  bgError: 'rgba(239, 68, 68, 0.08)',
  borderRadiusContainer: '28px',
  borderRadiusCard: '20px',
  borderRadiusButton: '12px',
  boxShadowContainer: '0 8px 40px rgba(0, 0, 0, 0.08)',
  boxShadowCard: '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
};

const styles = {
  container: { backgroundColor: theme.bgContainer, borderRadius: theme.borderRadiusContainer, padding: '24px', boxShadow: theme.boxShadowContainer, fontFamily: 'sans-serif', maxWidth: '700px', width: '95%', margin: '2rem auto', userSelect: 'none', border: '1px solid rgba(0, 0, 0, 0.05)' },
  titleContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: theme.textPrimary, textAlign: 'center' },
  readAloudButton: { cursor: 'pointer', color: theme.primary, fontSize: '1.5rem', transition: 'transform 0.2s' },
  mainArea: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '47%', zIndex: 2 },
  item: { padding: '8px 10px', borderRadius: theme.borderRadiusCard, background: theme.bgCard, boxShadow: theme.boxShadowCard, cursor: 'pointer', border: '2px solid transparent', borderBottomWidth: '4px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minHeight: '80px', justifyContent: 'center', flex: 1, position: 'relative' },
  itemImage: { height: '75px', width: 'auto', maxWidth: '90%', borderRadius: '12px', objectFit: 'contain' },
  itemContent: { fontSize: '1.1rem', fontWeight: '500', color: theme.textSecondary, textAlign: 'center' },
  pinyin: { fontSize: '0.8rem', color: theme.textSecondary, height: '1.1em' },
  
  // --- 修改/新增样式 ---
  // 当前点击选中的项（尚未配对）
  selected: { borderColor: theme.primaryDark, transform: 'translateY(-4px) scale(1.03)', boxShadow: `0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 8px 10px -6px ${theme.primaryDark}1A` },
  // 已配对但未检查的项
  itemPaired: { borderColor: theme.primary },
  // 检查后正确的项
  itemCorrect: { borderColor: theme.success, background: theme.bgSuccess },
  // 检查后错误的项
  itemIncorrect: { borderColor: theme.error, background: theme.bgError },
  // --- 样式修改结束 ---

  ttsLoader: { position: 'absolute', top: '8px', right: '8px', color: theme.primary, animation: 'spin 1s linear infinite' },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' },
  path: { fill: 'none', stroke: theme.primary, strokeWidth: 3.5, transition: 'stroke 0.3s ease', opacity: 0.8 },
  pathCorrect: { stroke: theme.success, strokeWidth: 3.5, strokeDasharray: 'none' },
  pathIncorrect: { stroke: theme.error, strokeWidth: 3.5, strokeDasharray: 'none' },
  buttonContainer: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '24px' },
  actionButton: { padding: '14px 28px', borderRadius: theme.borderRadiusButton, border: 'none', backgroundColor: theme.primary, color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px' },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed', opacity: 0.7, pointerEvents: 'none' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold', animation: 'fadeIn 0.5s' },
};

const audioManager = { currentSound: null, stopCurrentSound: function() { this.currentSound?.stop(); this.currentSound = null; } };
const sounds = {
  click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
};
const playSound = (name) => { audioManager.stopCurrentSound(); sounds[name]?.play(); };

const LianXianTi = ({ title, columnA, columnB, pairs, onCorrect }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [ttsPlayingId, setTtsPlayingId] = useState(null);
  const itemRefs = useRef({});

  const isAllPaired = userPairs.length === (columnA?.length || 0);
  const isAllCorrect = isSubmitted && userPairs.every(p => pairs[p.a] === p.b);

  const playTTS = useCallback(async (item, lang = 'zh') => {
    if (!item.content) return;
    audioManager.stopCurrentSound();
    setTtsPlayingId(item.id);
    const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural';
    try {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.content)}&v=${voice}&r=-15`;
      const ttsAudio = new Howl({ src: [url], html5: true });
      audioManager.currentSound = ttsAudio;
      ttsAudio.on('end', () => setTtsPlayingId(null));
      ttsAudio.on('loaderror', () => setTtsPlayingId(null));
      ttsAudio.play();
    } catch (e) { console.error('TTS 失败:', e); setTtsPlayingId(null); }
  }, []);
  
  useEffect(() => {
    if (isAllCorrect) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      if (onCorrect) onCorrect();
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
    let newSelection = { ...selection, [column]: item.id };
    if (newSelection.a !== null && newSelection.b !== null) {
      let updatedPairs = userPairs.filter(p => p.a !== newSelection.a && p.b !== newSelection.b);
      updatedPairs.push(newSelection);
      setUserPairs(updatedPairs);
      setSelection({ a: null, b: null });
    } else { setSelection(newSelection); }
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
    
  const getCurvePath = (pair) => {
    const elA = itemRefs.current[pair.a];
    const elB = itemRefs.current[pair.b];
    if (!elA || !elB) return null;
    const containerRect = elA.closest('[data-id="main-area"]')?.getBoundingClientRect();
    if (!containerRect) return null;
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();
    const x1 = rectA.right - containerRect.left;
    const y1 = rectA.top + rectA.height / 2 - containerRect.top;
    const x2 = rectB.left - containerRect.left;
    const y2 = rectB.top + rectB.height / 2 - containerRect.top;
    const offset = Math.abs(x2 - x1) * 0.4;
    return `M ${x1},${y1} C ${x1 + offset},${y1} ${x2 - offset},${y2} ${x2},${y2}`;
  };

  const getPathStyle = (pair) => {
      if (showAnswers || (isSubmitted && pairs[pair.a] === pair.b)) return styles.pathCorrect;
      if (isSubmitted && pairs[pair.a] !== pair.b) return styles.pathIncorrect;
      return styles.path;
  };

  // --- 新增函数：根据状态获取卡片样式 ---
  const getItemStyle = (item) => {
    const baseStyle = styles.item;
    const pairedInfo = userPairs.find(p => p.a === item.id || p.b === item.id);

    // 状态1: 已提交或查看答案
    if (isSubmitted || showAnswers) {
      if (pairedInfo) {
        const isCorrect = pairs[pairedInfo.a] === pairedInfo.b;
        if (showAnswers || isCorrect) {
          return { ...baseStyle, ...styles.itemCorrect };
        }
        return { ...baseStyle, ...styles.itemIncorrect };
      }
    }

    // 状态2: 已配对但未提交
    if (pairedInfo) {
      return { ...baseStyle, ...styles.itemPaired };
    }

    // 状态3: 当前正被点击选中
    if (selection.a === item.id || selection.b === item.id) {
      return { ...baseStyle, ...styles.selected };
    }

    // 状态4: 默认
    return baseStyle;
  };

  const renderItemContent = (item, hasPinyin = false) => (
    <>
      {ttsPlayingId === item.id && <FaSpinner style={styles.ttsLoader} />}
      {item.imageUrl && <img src={item.imageUrl} alt={item.content || 'image'} style={styles.itemImage} />}
      {item.content && (
        <div style={{opacity: ttsPlayingId === item.id ? 0.5 : 1}}>
          {hasPinyin && item.content && <div style={styles.pinyin}>{pinyin(item.content, { toneType: 'mark' })}</div>}
          <div style={styles.itemContent}>{item.content}</div>
        </div>
      )}
    </>
  );

  if (!columnA || !columnB) return <div>加载题目数据中...</div>;

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div style={styles.titleContainer}>
        <h2 style={styles.title}>{title}</h2>
        <FaVolumeUp style={styles.readAloudButton} onClick={() => playTTS({content: title}, 'zh')} />
      </div>

      <div style={styles.mainArea} data-id="main-area">
        <div style={styles.column}>
          {columnA.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el} 
                 // --- 应用新的样式逻辑 ---
                 style={getItemStyle(item)} 
                 onClick={() => handleSelect('a', item)}>
                 {renderItemContent(item, true)}
            </div>
          ))}
        </div>
        <div style={styles.column}>
           {columnB.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el}
                 // --- 应用新的样式逻辑 ---
                 style={getItemStyle(item)} 
                 onClick={() => handleSelect('b', item)}>
                 {renderItemContent(item)}
            </div>
          ))}
        </div>
        <svg style={styles.svgContainer}>
          {userPairs.map((pair, index) => {
              const pathData = getCurvePath(pair);
              if (!pathData) return null;
              return <path key={index} d={pathData} style={getPathStyle(pair)} />
          })}
        </svg>
      </div>
      
      <div style={styles.buttonContainer}>
        {!isSubmitted && !showAnswers && (
            <button style={{...styles.actionButton, ...(!isAllPaired || isSubmitted ? styles.disabledButton : {})}} 
                    onClick={handleCheckAnswers} disabled={!isAllPaired || isSubmitted}>
                <FaCheck /> 检查答案
            </button>
        )}
        {isSubmitted && !isAllCorrect && !showAnswers && (
             <button style={{...styles.actionButton, backgroundColor: theme.warning}} onClick={handleShowAnswers}>
                <FaEye /> 查看答案
            </button>
        )}
        {(isSubmitted || showAnswers) && (
            <button style={{...styles.actionButton, backgroundColor: theme.gray}} onClick={handleReset}>
                <FaRedo /> 再来一次
            </button>
        )}
      </div>

      {isSubmitted && (
        <div style={{ ...styles.finishMessage, color: isAllCorrect ? theme.success : theme.error }}>
          {isAllCorrect ? '🎉 太棒了，全部正确！' : '部分答案有误，请再看看哦！'}
        </div>
      )}
    </div>
  );
};

export default LianXianTi;
