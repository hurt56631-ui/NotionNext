// components/Tixing/LianXianTi.js (V8 - 专业教学产品版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howl';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaVolumeUp, FaEye, FaRedo, FaSpinner } from 'react-icons/fa';

// ⚙️ [核心] 统一视觉主题，方便全站复用
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
  borderRadiusContainer: '28px',
  borderRadiusCard: '20px',
  borderRadiusButton: '12px',
  boxShadowContainer: '0 8px 40px rgba(0, 0, 0, 0.08)',
  boxShadowCard: '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
};

// --- 样式定义 ---
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
  selected: { borderColor: theme.primaryDark, transform: 'translateY(-4px) scale(1.03)', boxShadow: `0 10px 25px -5px rgba(99, 102, 241, 0.2), 0 8px 10px -6px ${theme.primaryDark}1A` },
  ttsLoader: { position: 'absolute', top: '8px', right: '8px', color: theme.primary, animation: 'spin 1s linear infinite' },
  svgContainer: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' },
  // ✅ [核心] 曲线样式
  path: { fill: 'none', stroke: '#94a3b8', strokeWidth: 3, strokeDasharray: '5, 5', transition: 'stroke 0.3s ease' },
  pathCorrect: { stroke: theme.success, strokeWidth: 3.5, strokeDasharray: 'none' },
  pathIncorrect: { stroke: theme.error, strokeWidth: 3.5, strokeDasharray: 'none' },
  buttonContainer: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '24px' },
  actionButton: { padding: '14px 28px', borderRadius: theme.borderRadiusButton, border: 'none', backgroundColor: theme.primary, color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '8px' },
  // ✅ [核心] 优化禁用按钮样式
  disabledButton: { backgroundColor: '#9ca3af', cursor: 'not-allowed', opacity: 0.7, pointerEvents: 'none' },
  finishMessage: { textAlign: 'center', marginTop: '24px', fontSize: '1.5rem', fontWeight: 'bold' },
};

// ⚙️ [优化] 抽离音频管理器 (未来可放入 /utils/audioManager.js)
const audioManager = { /* ... */ }; // (保持不变)
const sounds = { /* ... */ }; // (保持不变)
const playSound = (name) => { /* ... */ };

const LianXianTi = ({ title, columnA, columnB, pairs, onCorrect }) => {
  // ⚙️ [优化] 状态命名统一
  const [selection, setSelection] = useState({ a: null, b: null });
  const [userPairs, setUserPairs] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  // 🧠 [新增] TTS 加载状态
  const [ttsPlayingId, setTtsPlayingId] = useState(null);
  const itemRefs = useRef({});

  const isAllPaired = userPairs.length === columnA.length;
  const isFinished = isAllPaired && isSubmitted;
  const isAllCorrect = isFinished && userPairs.every(p => pairs[p.a] === p.b);
  
  // ✅ [核心] 播放 TTS 逻辑，带加载状态
  const playTTS = useCallback(async (item, lang = 'zh') => {
    if (!item.content) return;
    audioManager.stopCurrentSound();
    setTtsPlayingId(item.id);
    const voice = lang === 'zh' ? 'zh-CN-XiaoyouNeural' : 'my-MM-ThihaNeural';
    try {
      const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(item.content)}&v=${voice}&r=-15`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('API Error');
      const blob = await response.blob();
      const ttsAudio = new Audio(URL.createObjectURL(blob));
      audioManager.currentSound = ttsAudio;
      ttsAudio.play();
      ttsAudio.onended = () => { if (audioManager.currentSound === ttsAudio) audioManager.currentSound = null; setTtsPlayingId(null); };
      ttsAudio.onerror = () => setTtsPlayingId(null);
    } catch (e) { console.error('TTS 失败:', e); setTtsPlayingId(null); }
  }, []);

  useEffect(() => {
    if (isAllCorrect) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      if (onCorrect) onCorrect();
    }
  }, [isAllCorrect, onCorrect]);

  const handleSelect = (column, item) => { /* ... */ }; // (逻辑保持不变，调用 playTTS)
  const handleCheckAnswers = () => { /* ... */ }; // (逻辑保持不变)
  const handleShowAnswers = () => { /* ... */ }; // (逻辑保持不变)
  
  // 🧠 [新增] 重置功能
  const handleReset = () => {
    setUserPairs([]);
    setIsSubmitted(false);
    setShowAnswers(false);
    setSelection({ a: null, b: null });
  };
    
  // ✅ [核心] 计算贝塞尔曲线路径
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
    
    // 控制点偏移量，使曲线更平滑
    const offset = Math.abs(x2 - x1) * 0.4;
    return `M ${x1},${y1} C ${x1 + offset},${y1} ${x2 - offset},${y2} ${x2},${y2}`;
  };

  const getPathStyle = (pair) => { /* ... */ }; // (逻辑保持不变, s/line/path/g)

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

  return (
    <div style={styles.container}>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      <div style={styles.titleContainer}> {/* ... Title ... */} </div>

      <div style={styles.mainArea} data-id="main-area">
        {/* ... Columns and Items ... */}
        <svg style={styles.svgContainer}>
          {userPairs.map((pair, index) => {
              // ✅ [核心] 使用 path 替代 line
              const pathData = getCurvePath(pair);
              if (!pathData) return null;
              return <path key={index} d={pathData} style={getPathStyle(pair)} />
          })}
        </svg>
      </div>
      
      <div style={styles.buttonContainer}>
        {!isFinished && !showAnswers && (
            <button style={{...styles.actionButton, ...(!isAllPaired || isSubmitted ? styles.disabledButton : {})}} 
                    onClick={handleCheckAnswers} disabled={!isAllPaired || isSubmitted}>
                检查答案
            </button>
        )}
        {/* 🧠 [新增] 只有在提交后、未全对、且未显示答案时，才显示“查看答案” */}
        {isSubmitted && !isAllCorrect && !showAnswers && (
             <button style={{...styles.actionButton, backgroundColor: theme.warning}} onClick={handleShowAnswers}>
                <FaEye /> 查看答案
            </button>
        )}
        {/* 🧠 [新增] 只要提交过，就显示“再来一次”按钮 */}
        {(isSubmitted || showAnswers) && (
            <button style={{...styles.actionButton, backgroundColor: theme.gray}} onClick={handleReset}>
                <FaRedo /> 再来一次
            </button>
        )}
      </div>

      {isFinished && (
        <div style={{ ...styles.finishMessage, color: isAllCorrect ? theme.success : theme.error }}>
          {isAllCorrect ? '🎉 太棒了，全部正确！' : '部分答案有误，请再看看哦！'}
        </div>
      )}
    </div>
  );
};

export default LianXianTi;
