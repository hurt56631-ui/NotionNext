// components/Tixing/PaiXuTi.js (V4 - 体验优化版)

import React, { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
//import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
// 【新】导入约束修改器
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated } from '@react-spring/web';
import { Howl } from 'howler';
// 【新】引入加载中图标
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner } from 'react-icons/fa';
//import confetti from 'canvas-confetti';

// --- 样式定义 ---
const styles = {
  // ... (样式基本不变, 微调)
  paiXuTiContainer: { backgroundColor: '#f0f4f8', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', border: '1px solid rgba(255, 255, 255, 0.18)', fontFamily: 'sans-serif', marginBottom: '2rem', maxWidth: '600px', margin: '2rem auto' },
  questionTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '2rem', textAlign: 'center' },
  cardList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  paiXuKaPian: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', position: 'relative', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', transition: 'box-shadow 0.2s ease, transform 0.2s ease', touchAction: 'none' },
  cardContent: { fontSize: '1.2rem', color: '#334155', fontWeight: '500', flexGrow: 1 },
  ttsButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#64748b', transition: 'color 0.2s ease', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  feedback: { marginTop: '1.5rem', padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  loadingPlaceholder: { textAlign: 'center', padding: '2rem', color: '#6c757d' },
  submitButton: { width: '100%', padding: '14px', marginTop: '1.5rem', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
  resetButton: { width: '100%', padding: '12px', marginTop: '1rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '1rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner: { animation: 'spin 1s linear infinite' }, // CSS for spinner
  '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }
};

// --- 音效管理器 ---
let soundDrag, soundDrop, soundCorrect, soundIncorrect;
if (typeof window !== 'undefined') {
  soundDrag = new Howl({ src: ['/sounds/drag.mp3'], volume: 0.5 });
  soundDrop = new Howl({ src: ['/sounds/drop.mp3'], volume: 0.5 });
  soundCorrect = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  soundIncorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (sound) => { if (sound && sound.play) { sound.play(); } };


// --- TTS 朗读功能 (已添加加载状态) ---
let currentAudio = null; // 全局音频对象，防止同时播放多个
async function playTTS(text, onStart, onEnd) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  onStart(); // 开始加载，触发UI变化
  const apiBaseUrl = 'https://t.leftsite.cn';
  const voice = 'zh-CN-XiaochenMultilingualNeural';
  const encodedText = encodeURIComponent(text);
  const url = `${apiBaseUrl}/tts?t=${encodedText}&v=${voice}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    currentAudio = audio;
    audio.play();
    audio.onended = () => { currentAudio = null; onEnd(); }; // 播放结束
    audio.onerror = () => { currentAudio = null; onEnd(); }; // 播放出错
  } catch (error) {
    console.error('TTS 朗读失败:', error);
    alert('抱歉，朗读失败了。请检查网络或稍后再试。');
    onEnd(); // 结束加载
  }
}

// --- 内部子组件：排序卡片 ---
const PaiXuKaPian = ({ id, content }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [isTtsLoading, setIsTtsLoading] = useState(false);

  const springStyles = useSpring({
    transform: CSS.Transform.toString(transform),
    // 【优化】更强的拖拽阴影
    boxShadow: isDragging ? '0 20px 30px -10px rgba(30, 41, 59, 0.25)' : '0 4px 6px rgba(0, 0, 0, 0.05)',
    scale: isDragging ? 1.05 : 1,
    config: { tension: 300, friction: 20 },
  });
  
  const style = { ...styles.paiXuKaPian, transition, zIndex: isDragging ? 100 : 1 };

  const handleTtsClick = (e) => {
    e.stopPropagation();
    if(isTtsLoading) return;
    playTTS(content, () => setIsTtsLoading(true), () => setIsTtsLoading(false));
  };
  
  return (
    <animated.div ref={setNodeRef} style={{ ...style, ...springStyles }} {...attributes} {...listeners}>
      <span style={styles.cardContent}>{content}</span>
      <button style={styles.ttsButton} onClick={handleTtsClick} title="朗读" disabled={isTtsLoading}>
        {isTtsLoading ? <FaSpinner style={styles.spinner} /> : <FaVolumeUp />}
      </button>
    </animated.div>
  );
};


// --- 主组件：排序题 ---
const PaiXuTi = (props) => {
  const { question, items: initialItems, answer } = props;
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  // ... (其他状态保持不变)
  const shuffledItems = useMemo(() => {
    if (!initialItems) return [];
    const itemsCopy = [...initialItems];
    for (let i = itemsCopy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[itemsCopy[i], itemsCopy[j]] = [itemsCopy[j], itemsCopy[i]]; }
    return itemsCopy;
  }, [initialItems]);
  const [items, setItems] = useState(shuffledItems);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, }));
  const handleDragStart = () => { playSound(soundDrag); };
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
      playSound(soundDrop);
    }
  };
  const handleSubmit = () => {
    const currentAnswer = items.map(item => item.id).join(',');
    const correctAnswer = answer.join(',');
    const isCorrect = currentAnswer === correctAnswer;
    setFeedback({ shown: true, correct: isCorrect });
    if (isCorrect) {
      playSound(soundCorrect);
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    } else {
      playSound(soundIncorrect);
    }
  };
  const handleReset = () => { setItems(shuffledItems); setFeedback({ shown: false, correct: false }); };
  if (!isMounted || !initialItems) {
    return <div style={styles.paiXuTiContainer}><div style={styles.loadingPlaceholder}>题目加载中...</div></div>;
  }

  // 为 @keyframes 添加 style 标签
  const spinAnimationStyle = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

  return (
    <>
      <style>{spinAnimationStyle}</style>
      <div style={styles.paiXuTiContainer}>
        <h3 style={styles.questionTitle}>{question}</h3>
        {/* 【核心修复】添加 modifiers 属性 */}
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter} 
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div style={styles.cardList}>
              {items.map((item) => ( <PaiXuKaPian key={item.id} id={item.id} content={item.content} /> ))}
            </div>
          </SortableContext>
        </DndContext>
        {!feedback.shown ? (<button style={styles.submitButton} onClick={handleSubmit}>提交答案</button>) : (<>
          <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
            {feedback.correct ? <><FaCheck /> 太棒了，完全正确！</> : <><FaTimes /> 顺序不对哦，再试一次！</>}
          </div>
          <button style={styles.resetButton} onClick={handleReset}><FaRedo /> 再做一次</button>
        </>)}
      </div>
    </>
  );
};

export default PaiXuTi;
