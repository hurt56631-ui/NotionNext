// components/Tixing/LianXianTi.js (V6 - 大图优化版)

import React, { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaVolumeUp, FaEye } from 'react-icons/fa';

// --- 样式定义 (V6 - 重点优化图片占比) ---
const styles = {
  container: { backgroundColor: '#f7f9fc', borderRadius: '28px', padding: '24px', boxShadow: '0 8px 40px rgba(0, 0, 0, 0.08)', fontFamily: 'sans-serif', maxWidth: '700px', width: '95%', margin: '2rem auto', userSelect: 'none', border: '1px solid rgba(0, 0, 0, 0.05)' },
  titleContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px', },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', textAlign: 'center' },
  readAloudButton: { cursor: 'pointer', color: '#3b82f6', fontSize: '1.5rem', transition: 'transform 0.2s', },
  mainArea: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '47%', zIndex: 2 },
  item: {
    padding: '12px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.8)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
    cursor: 'pointer',
    border: '2px solid transparent',
    borderBottomWidth: '4px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px', // 核心修改：减小图片与文字的间距，让布局更紧凑
    minHeight: '120px', // 核心修改：增加最小高度以容纳更大的图片
    justifyContent: 'center',
    flex: 1,
  },
  // 核心修改：显著增加图片尺寸，使其成为视觉焦点
  itemImage: {
    height: '80px', // 从 60px 大幅增加到 80px
    width: 'auto',
    maxWidth: '90%',
    borderRadius: '12px',
    objectFit: 'contain',
  },
  itemContent: { fontSize: '1.2rem', fontWeight: '500', color: '#334155', textAlign: 'center' },
  pinyin: { fontSize: '0.85rem', color: '#64748b', height: '1.1em' },
  selected: {
    borderColor: '#6366f1',
    transform: 'translateY(-4px) scale(1.03)',
    boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 8px 10px -6px rgba(99, 102, 241, 0.1)',
  },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' },
  line: { stroke: '#94a3b8', strokeWidth: 3, strokeDasharray: '5, 5', transition: 'stroke 0.3s ease' },
  lineCorrect: { stroke: '#22c55e', strokeWidth: 3.5, strokeDasharray: 'none' },
  lineIncorrect: { stroke: '#ef4444', strokeWidth: 3.5, strokeDasharray: 'none' },
  buttonContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' },
  submitButton: { padding: '14px 28px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px' },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold' },
};

// --- 音频管理器 (与 V5 相同，无需改动) ---
const audioManager = {
  currentSound: null,
  stopCurrentSound: () => {
    if (audioManager.currentSound) {
      if (typeof audioManager.currentSound.stop === 'function') { audioManager.currentSound.stop(); }
      else if (typeof audioManager.currentSound.pause === 'function') { audioManager.currentSound.pause(); audioManager.currentSound.src = ''; }
      audioManager.currentSound = null;
    }
  },
};
const sounds = {
  click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }),
  incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
};
const playSound = (name) => {
  audioManager.stopCurrentSound();
  const sound = sounds[name];
  if (sound) { audioManager.currentSound = sound; sound.play(); }
};
const playTTS = async (text, lang = 'zh') => {
  audioManager.stopCurrentSound();
  const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural';
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-15`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const ttsAudio = new Audio(URL.createObjectURL(blob));
    audioManager.currentSound = ttsAudio;
    ttsAudio.play();
    ttsAudio.onended = () => { if (audioManager.currentSound === ttsAudio) { audioManager.currentSound = null; } };
  } catch (e) { console.error('TTS 失败:', e); audioManager.currentSound = null; }
};

// --- 主组件 (与 V5 相同，无需改动) ---
const LianXianTi = ({ title, columnA, columnB, pairs }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [checkMode, setCheckMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const itemRefs = useRef({});

  const isAllPaired = userPairs.length === columnA.length;
  const isFinished = isAllPaired && checkMode;

  useEffect(() => {
    if (isFinished && userPairs.every(p => pairs[p.a] === p.b)) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [isFinished, userPairs, pairs]);

  const handleSelect = (column, item) => {
    if (checkMode || showAnswers) return;
    if (selection[column] === item.id) {
        playSound('click');
        setSelection({ ...selection, [column]: null });
        return;
    }
    if (item.content) { playTTS(item.content, column === 'a' ? 'zh' : 'my'); }
    else { playSound('click'); }
    let newSelection = { ...selection, [column]: item.id };
    if (newSelection.a !== null && newSelection.b !== null) {
      let updatedPairs = userPairs.filter(p => p.a !== newSelection.a && p.b !== newSelection.b);
      updatedPairs.push(newSelection);
      setUserPairs(updatedPairs);
      setSelection({ a: null, b: null });
    } else { setSelection(newSelection); }
  };
    
  const handleCheckAnswers = () => { setCheckMode(true); const correctCount = userPairs.filter(p => pairs[p.a] === p.b).length; if (correctCount === columnA.length) { playSound('correct'); } else { playSound('incorrect'); } };
  const handleShowAnswers = () => { setShowAnswers(true); const correctPairsArray = Object.entries(pairs).map(([keyA, valueB]) => ({ a: keyA, b: valueB })); setUserPairs(correctPairsArray); };
  const getLinePoints = (pair) => { const elA = itemRefs.current[pair.a]; const elB = itemRefs.current[pair.b]; if (!elA || !elB) return null; const containerRect = elA.closest('[data-id="main-area"]')?.getBoundingClientRect(); if (!containerRect) return null; const rectA = elA.getBoundingClientRect(); const rectB = elB.getBoundingClientRect(); return { x1: rectA.right - containerRect.left, y1: rectA.top + rectA.height / 2 - containerRect.top, x2: rectB.left - containerRect.left, y2: rectB.top + rectB.height / 2 - containerRect.top }; };
  const getLineStyle = (pair) => { if (showAnswers) return styles.lineCorrect; if (!checkMode) return styles.line; return pairs[pair.a] === pair.b ? styles.lineCorrect : styles.lineIncorrect; };
  
  const renderItemContent = (item, hasPinyin = false) => (
    <>
      {item.imageUrl && <img src={item.imageUrl} alt={item.content || 'image'} style={styles.itemImage} />}
      {item.content && (
        <div>
          {hasPinyin && item.content && <div style={styles.pinyin}>{pinyin(item.content, { toneType: 'mark' })}</div>}
          <div style={styles.itemContent}>{item.content}</div>
        </div>
      )}
    </>
  );

  return (
    <div style={styles.container}>
      <div style={styles.titleContainer}>
        <h2 style={styles.title}>{title}</h2>
        <FaVolumeUp 
          style={styles.readAloudButton}
          onClick={() => playTTS(title, 'zh')}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        />
      </div>

      <div style={styles.mainArea} data-id="main-area">
        <div style={styles.column}>
          {columnA.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el} 
                 style={{...styles.item, ...(selection.a === item.id ? styles.selected : {})}} 
                 onClick={() => handleSelect('a', item)}>
                 {renderItemContent(item, true)}
            </div>
          ))}
        </div>
        <div style={styles.column}>
           {columnB.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el}
                 style={{...styles.item, ...(selection.b === item.id ? styles.selected : {})}} 
                 onClick={() => handleSelect('b', item)}>
                 {renderItemContent(item)}
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
        {!isFinished && !showAnswers && (
            <button style={{...styles.submitButton, ...(!isAllPaired || checkMode ? styles.disabledButton : {})}} 
                    onClick={handleCheckAnswers} disabled={!isAllPaired || checkMode}>
                检查答案
            </button>
        )}
        {checkMode && !userPairs.every(p => pairs[p.a] === p.b) && (
             <button style={{...styles.submitButton, backgroundColor: '#f59e0b'}} onClick={handleShowAnswers}>
                <FaEye /> 查看答案
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
