// components/Tixing/LianXianTi.js (V3 - 最终修复与功能增强版)

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaEye } from 'react-icons/fa'; // 引入图标

// --- 样式定义 (与您提供的 V2 版本完全相同) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', userSelect: 'none' },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', textAlign: 'center', marginBottom: '24px' },
  mainArea: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  column: { display: 'flex', flexDirection: 'column', gap: '16px', width: '45%', zIndex: 2 },
  item: { padding: '12px', borderRadius: '12px', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', cursor: 'pointer', textAlign: 'center', border: '2px solid transparent', borderBottomWidth: '5px', transition: 'all 0.15s ease-out', },
  itemContent: { fontSize: '1.2rem', fontWeight: '500', color: '#334155', },
  pinyin: { fontSize: '0.85rem', color: '#64748b', marginBottom: '4px', height: '1.1em', },
  selected: { borderColor: '#3b82f6', transform: 'translateY(-2px) scale(1.03)', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.2), 0 4px 6px -2px rgba(59,130,246,0.1)', },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' },
  line: { stroke: '#94a3b8', strokeWidth: 3, strokeDasharray: '5, 5', transition: 'stroke 0.3s ease' },
  lineCorrect: { stroke: '#22c55e', strokeDasharray: 'none' },
  lineIncorrect: { stroke: '#ef4444', strokeDasharray: 'none' },
  buttonContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '24px' },
  submitButton: { padding: '14px 28px', borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px' },
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold' },
};

// --- 音效 & TTS (与您提供的 V2 版本完全相同) ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }), correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 1.0 }), incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }), };
const playSound = (name) => sounds[name]?.play();
const playTTS = async (text, lang = 'zh') => { const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural'; try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=-15`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); new Audio(URL.createObjectURL(blob)).play(); } catch (e) { console.error('TTS 失败:', e); } };

// --- 主组件 ---
const LianXianTi = ({ title, columnA, columnB, pairs }) => {
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [checkMode, setCheckMode] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false); // 新增状态
  const itemRefs = useRef({});

  const isAllPaired = userPairs.length === columnA.length;
  const isFinished = isAllPaired && checkMode;

  useEffect(() => {
    if (isFinished && userPairs.every(p => pairs[p.a] === p.b)) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [isFinished, userPairs, pairs, columnA.length]);

  const handleSelect = (column, itemId, text, lang) => {
    if (checkMode || showAnswers) return;
    playSound('click');
    playTTS(text, lang);

    let newSelection = { ...selection };

    // 如果点击的已被选中，则取消选择
    if (selection[column] === itemId) {
        newSelection[column] = null;
        setSelection(newSelection);
        return;
    }
    
    newSelection[column] = itemId;

    // 如果两边都已选择
    if (newSelection.a !== null && newSelection.b !== null) {
      let updatedPairs = [...userPairs];
      // 【关键修复】移除任何与新选择的 a 或 b 相关的旧配对
      updatedPairs = updatedPairs.filter(p => p.a !== newSelection.a && p.b !== newSelection.b);
      // 添加新的配对
      updatedPairs.push(newSelection);
      
      setUserPairs(updatedPairs);
      setSelection({ a: null, b: null }); // 重置选择
    } else {
      setSelection(newSelection);
    }
  };

  const handleCheckAnswers = () => {
    setCheckMode(true);
    const correctCount = userPairs.filter(p => pairs[p.a] === p.b).length;
    if (correctCount === columnA.length) {
      playSound('correct');
    } else {
      playSound('incorrect');
    }
  };

  const handleShowAnswers = () => {
    setShowAnswers(true);
    const correctPairsArray = Object.entries(pairs).map(([keyA, valueB]) => ({ a: keyA, b: valueB }));
    setUserPairs(correctPairsArray); // 直接用正确答案覆盖用户的答案
  };

  const getLinePoints = (pair) => {
    const elA = itemRefs.current[pair.a];
    const elB = itemRefs.current[pair.b];
    if (!elA || !elB) return null;
    const containerRect = elA.closest('[data-id="main-area"]')?.getBoundingClientRect();
    if (!containerRect) return null;
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();
    return { x1: rectA.right - containerRect.left, y1: rectA.top + rectA.height / 2 - containerRect.top, x2: rectB.left - containerRect.left, y2: rectB.top + rectB.height / 2 - containerRect.top };
  };

  const getLineStyle = (pair) => {
    if (showAnswers) return styles.lineCorrect;
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
                 style={{...styles.item, ...(selection.a === item.id ? styles.selected : {})}} 
                 onClick={() => handleSelect('a', item.id, item.content, 'zh')}>
                <div style={styles.pinyin}>{pinyin(item.content, { toneType: 'mark' })}</div>
                <div style={styles.itemContent}>{item.content}</div>
            </div>
          ))}
        </div>
        <div style={styles.column}>
           {columnB.map(item => (
            <div key={item.id} ref={el => itemRefs.current[item.id] = el}
                 style={{...styles.item, ...(selection.b === item.id ? styles.selected : {})}} 
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
        {!isFinished && !showAnswers && (
            <button style={{...styles.submitButton, ...(!isAllPaired || checkMode ? styles.disabledButton : {})}} 
                    onClick={handleCheckAnswers} 
                    disabled={!isAllPaired || checkMode}>
                检查答案
            </button>
        )}
        {checkMode && !userPairs.every(p => pairs[p.a] === p.b) && (
             <button style={{...styles.submitButton, backgroundColor: '#f59e0b'}} 
                    onClick={handleShowAnswers}>
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

export default LianXianTi;```
