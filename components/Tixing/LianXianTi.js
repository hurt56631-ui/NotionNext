// components/Tixing/LianXianTi.js (V1 - 现代交互连线题)

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { useSpring, animated } from '@react-spring/web';

// --- 样式定义 ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', userSelect: 'none' },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', textAlign: 'center', marginBottom: '24px' },
  mainArea: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '45%' },
  item: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'white',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    textAlign: 'center',
    fontSize: '1.2rem',
    fontWeight: '500',
    color: '#334155',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  selected: { borderColor: '#3b82f6', transform: 'scale(1.05)', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.2), 0 4px 6px -2px rgba(59,130,246,0.1)' },
  correct: { backgroundColor: '#dcfce7', color: '#166534', cursor: 'default', opacity: 0.7 },
  incorrect: { animation: 'shake 0.5s ease' },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' },
  line: { stroke: '#a5b4fc', strokeWidth: 3, transition: 'stroke 0.3s ease' },
  lineCorrect: { stroke: '#4ade80' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }
};

// --- 音效 & TTS ---
let sounds = {
  click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
};
const playSound = (name) => sounds[name]?.play();
const playTTS = async (text) => {
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    new Audio(URL.createObjectURL(blob)).play();
  } catch (e) { console.error('TTS 失败:', e); }
};

// --- 主组件 ---
const LianXianTi = ({ title, columnA, columnB, pairs }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [correctPairs, setCorrectPairs] = useState([]);
  const [incorrectFlash, setIncorrectFlash] = useState([]);
  const itemRefs = useRef({});

  const isFinished = correctPairs.length === columnA.length;

  useEffect(() => {
    if (isFinished) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [isFinished]);

  const handleSelect = (column, itemId, text) => {
    if (isFinished) return;
    playSound('click');
    playTTS(text);

    const newSelection = { ...selection };
    newSelection[column] = itemId;

    // 如果两边都已选择
    if (newSelection.a !== null && newSelection.b !== null) {
      const correctB = pairs[newSelection.a];
      if (correctB === newSelection.b) {
        // 配对正确
        playSound('correct');
        setCorrectPairs(prev => [...prev, newSelection]);
        setSelection({ a: null, b: null });
      } else {
        // 配对错误
        playSound('incorrect');
        setIncorrectFlash([newSelection.a, newSelection.b]);
        setTimeout(() => {
          setIncorrectFlash([]);
          setSelection({ a: null, b: null });
        }, 500);
      }
    } else {
      setSelection(newSelection);
    }
  };

  const getItemState = (column, itemId) => {
    if (correctPairs.some(p => p[column] === itemId)) return 'correct';
    if (selection[column] === itemId) return 'selected';
    if (incorrectFlash.includes(itemId)) return 'incorrect';
    return 'idle';
  };
  
  const getLinePoints = (pair) => {
    const elA = itemRefs.current[pair.a];
    const elB = itemRefs.current[pair.b];
    if (!elA || !elB) return null;
    
    const containerRect = elA.parentElement.parentElement.getBoundingClientRect();
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();

    return {
      x1: rectA.right - containerRect.left,
      y1: rectA.top + rectA.height / 2 - containerRect.top,
      x2: rectB.left - containerRect.left,
      y2: rectB.top + rectB.height / 2 - containerRect.top
    };
  };

  return (
    <div style={styles.container}>
      <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }`}</style>
      <h2 style={styles.title}>{title}</h2>
      <div style={styles.mainArea}>
        <div style={styles.column}>
          {columnA.map(item => {
            const state = getItemState('a', item.id);
            return <div key={item.id} ref={el => itemRefs.current[item.id] = el} style={{...styles.item, ...styles[state]}} onClick={() => state !== 'correct' && handleSelect('a', item.id, item.content)}>
                {item.content}
            </div>
          })}
        </div>
        <div style={styles.column}>
           {columnB.map(item => {
            const state = getItemState('b', item.id);
            return <div key={item.id} ref={el => itemRefs.current[item.id] = el} style={{...styles.item, ...styles[state]}} onClick={() => state !== 'correct' && handleSelect('b', item.id, item.content)}>
                 {item.content}
            </div>
          })}
        </div>
        <svg style={styles.svgContainer}>
          {correctPairs.map((pair, index) => {
              const points = getLinePoints(pair);
              if (!points) return null;
              return <line key={index} {...points} style={{...styles.line, ...styles.lineCorrect}} />
          })}
        </svg>
      </div>
      {isFinished && <div style={styles.finishMessage}>🎉 太棒了，全部完成！ 🎉</div>}
    </div>
  );
};

export default LianXianTi;
