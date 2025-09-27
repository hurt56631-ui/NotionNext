// components/Tixing/LianXianTi.js (V2 - 体验升级版)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';

// --- 样式定义 (全新机械键盘风格) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', userSelect: 'none' },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', textAlign: 'center', marginBottom: '24px' },
  mainArea: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '45%', zIndex: 2 },
  item: {
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    textAlign: 'center',
    border: '2px solid transparent',
    borderBottomWidth: '5px',
    transition: 'all 0.15s ease-out',
  },
  itemContent: {
    fontSize: '1.2rem',
    fontWeight: '500',
    color: '#334155',
  },
  pinyin: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '4px',
    height: '1.1em',
  },
  selected: {
    borderColor: '#3b82f6',
    transform: 'translateY(-2px) scale(1.03)',
    boxShadow: '0 10px 15px -3px rgba(59,130,246,0.2), 0 4px 6px -2px rgba(59,130,246,0.1)',
  },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' },
  line: { stroke: '#94a3b8', strokeWidth: 3, strokeDasharray: '5, 5', transition: 'stroke 0.3s ease' },
  lineCorrect: { stroke: '#22c55e', strokeDasharray: 'none' },
  lineIncorrect: { stroke: '#ef4444', strokeDasharray: 'none' },
  buttonContainer: { display: 'flex', justifyContent: 'center', marginTop: '24px' },
  submitButton: { padding: '14px 28px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold' },
};

// --- 音效 & TTS ---
let sounds = {
  click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
};
const playSound = (name) => sounds[name]?.play();

const playTTS = async (text, lang = 'zh') => {
  const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural';
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-25`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    new Audio(URL.createObjectURL(blob)).play();
  } catch (e) { console.error('TTS 失败:', e); }
};

// --- 主组件 ---
const LianXianTi = ({ title, columnA, columnB, pairs }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [checkMode, setCheckMode] = useState(false);
  const itemRefs = useRef({});

  const isAllPaired = userPairs.length === columnA.length;
  const isFinished = isAllPaired && checkMode;
  
  const handleSelect = (column, itemId, text, lang) => {
    if (checkMode) return;
    playSound('click');
    playTTS(text, lang);

    let newSelection = { ...selection };
    newSelection[column] = itemId;

    // 如果之前已经选择了同一列的，则取消选择
    if (selection[column] === itemId) {
        newSelection[column] = null;
    }

    // 如果两边都已选择
    if (newSelection.a !== null && newSelection.b !== null) {
      // 检查这个配对是否已存在
      const existingPairIndex = userPairs.findIndex(p => p.a === newSelection.a || p.b === newSelection.b);
      if (existingPairIndex > -1) {
          // 如果存在，则更新
          const updatedPairs = [...userPairs];
          updatedPairs[existingPairIndex] = newSelection;
          setUserPairs(updatedPairs);
      } else {
          // 如果不存在，则新增
          setUserPairs(prev => [...prev, newSelection]);
      }
      setSelection({ a: null, b: null });
    } else {
      setSelection(newSelection);
    }
  };

  const handleCheckAnswers = () => {
    setCheckMode(true);
    const correctCount = userPairs.filter(p => pairs[p.a] === p.b).length;
    if (correctCount === columnA.length) {
      playSound('correct');
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    } else {
      playSound('incorrect');
    }
  };

  const getItemState = (column, itemId) => {
    if (selection[column] === itemId) return 'selected';
    return 'idle';
  };
  
  const getLinePoints = (pair) => {
    const elA = itemRefs.current[pair.a];
    const elB = itemRefs.current[pair.b];
    if (!elA || !elB) return null;
    
    const containerRect = elA.closest('[data-id="main-area"]').getBoundingClientRect();
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();

    return {
      x1: rectA.right - containerRect.left,
      y1: rectA.top + rectA.height / 2 - containerRect.top,
      x2: rectB.left - containerRect.left,
      y2: rectB.top + rectB.height / 2 - containerRect.top
    };
  };

  const getLineStyle = (pair) => {
    if (!checkMode) return styles.line;
    return pairs[pair.a] === pair.b ? styles.lineCorrect : styles.lineIncorrect;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.mainArea} data-id="main-area">
        <div style={styles.column}>
          {columnA.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el} 
                 style={{...styles.item, ...(getItemState('a', item.id) === 'selected' ? styles.selected : {})}} 
                 onClick={() => handleSelect('a', item.id, item.content, 'zh')}>
                <div style={styles.pinyin}>{pinyin(item.content, { toneType: 'mark' })}</div>
                <div style={styles.itemContent}>{item.content}</div>
            </div>
          ))}
        </div>
        <div style={styles.column}>
           {columnB.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el}
                 style={{...styles.item, ...(getItemState('b', item.id) === 'selected' ? styles.selected : {})}} 
                 onClick={() => handleSelect('b', item.id, item.content, 'my')}>
                 <div style={styles.itemContent}>{item.content}</div>
            </div>
          ))}
        </div>
        <svg style={styles.svgContainer}>
          {userPairs.map((pair, index) => {
              const points = getLinePoints(pair);
              if (!points) return null;
              return <line key={index} {...points} style={getLineStyle(pair)} />
          })}
        </svg>
      </div>
      <div style={styles.buttonContainer}>
        {!isFinished && (
            <button style={{...styles.submitButton, ...(!isAllPaired || checkMode ? styles.disabledButton : {})}} 
                    onClick={handleCheckAnswers} 
                    disabled={!isAllPaired || checkMode}>
                检查答案
            </button>
        )}
      </div>
      {isFinished && (
        <div style={{ ...styles.finishMessage, color: userPairs.every(p => pairs[p.a] === p.b) ? '#16a34a' : '#dc2626' }}>
          {userPairs.every(p => pairs[p.a] === p.b) ? '🎉 太棒了，全部正确！ 🎉' : '部分答案有误，请再看看哦！'}
        </div>
      )}
    </div>
  );
};

export default LianXianTi;
