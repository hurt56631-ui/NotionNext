// components/Tixing/PaiXuTi.js (V3 - 终极功能版)

import React, { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo } from 'react-icons/fa'; // 引入更丰富的图标
//import confetti from 'canvas-confetti'; // 引入彩纸库，需要先安装: npm install canvas-confetti

// --- 样式定义 (全新美化版) ---
const styles = {
  paiXuTiContainer: { backgroundColor: '#f0f4f8', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', border: '1px solid rgba(255, 255, 255, 0.18)', fontFamily: 'sans-serif', marginBottom: '2rem', maxWidth: '600px', margin: '2rem auto' },
  questionTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '2rem', textAlign: 'center' },
  cardList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  paiXuKaPian: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', position: 'relative', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', transition: 'box-shadow 0.2s ease, transform 0.2s ease', touchAction: 'none' },
  cardContent: { fontSize: '1.2rem', color: '#334155', fontWeight: '500', flexGrow: 1 },
  ttsButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#64748b', transition: 'color 0.2s ease', padding: '8px' },
  feedback: { marginTop: '1.5rem', padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  loadingPlaceholder: { textAlign: 'center', padding: '2rem', color: '#6c757d' },
  submitButton: { width: '100%', padding: '14px', marginTop: '1.5rem', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
  disabledButton: { backgroundColor: '#94a3b8', cursor: 'not-allowed' },
  resetButton: { width: '100%', padding: '12px', marginTop: '1rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '1rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
};


// --- 音效管理器 ---
// 解释: `howler` 是播放器, `.mp3` 是音乐文件。你需要提供音乐文件。
let soundDrag, soundDrop, soundCorrect, soundIncorrect;
if (typeof window !== 'undefined') {
  soundDrag = new Howl({ src: ['/sounds/drag.mp3'], volume: 0.5 });
  soundDrop = new Howl({ src: ['/sounds/drop.mp3'], volume: 0.5 });
  soundCorrect = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  soundIncorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (sound) => { if (sound && sound.play) { sound.play(); } };

// --- TTS 朗读功能 ---
// 从你提供的代码中提取的核心逻辑
async function playTTS(text) {
  const apiBaseUrl = 'https://t.leftsite.cn';
  const voice = 'zh-CN-XiaochenMultilingualNeural';
  const rate = '-25';
  const encodedText = encodeURIComponent(text);
  const url = `${apiBaseUrl}/tts?t=${encodedText}&v=${voice}&r=${rate}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API 错误: ${response.statusText}`);
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  } catch (error) {
    console.error('TTS 朗读失败:', error);
    alert('抱歉，朗读失败了。');
  }
}

// --- 内部子组件：排序卡片 (已美化和功能增强) ---
const PaiXuKaPian = ({ id, content }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const springStyles = useSpring({
    transform: CSS.Transform.toString(transform),
    boxShadow: isDragging ? '0 15px 25px rgba(0, 0, 0, 0.15)' : '0 4px 6px rgba(0, 0, 0, 0.05)',
    scale: isDragging ? 1.05 : 1,
    config: { tension: 300, friction: 20 },
  });
  
  const style = { ...styles.paiXuKaPian, transition, zIndex: isDragging ? 100 : 1, };

  const handleTtsClick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发拖拽
    playTTS(content);
  };
  
  // 【核心修改】将 listeners 绑定到整个 div 上，实现整卡拖拽
  return (
    <animated.div ref={setNodeRef} style={{ ...style, ...springStyles }} {...attributes} {...listeners}>
      <span style={styles.cardContent}>{content}</span>
      <button style={styles.ttsButton} onClick={handleTtsClick} title="朗读">
        <FaVolumeUp />
      </button>
    </animated.div>
  );
};


// --- 主组件：排序题 (已升级) ---
const PaiXuTi = ({ question, items: initialItems, answer }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const shuffledItems = useMemo(() => {
    const itemsCopy = [...initialItems];
    for (let i = itemsCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsCopy[i], itemsCopy[j]] = [itemsCopy[j], itemsCopy[i]];
    }
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
      // 庆祝动画！
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    } else {
      playSound(soundIncorrect);
    }
  };

  const handleReset = () => {
    setItems(shuffledItems);
    setFeedback({ shown: false, correct: false });
  };
  
  if (!isMounted) {
    return <div style={styles.paiXuTiContainer}><div style={styles.loadingPlaceholder}>题目加载中...</div></div>;
  }

  return (
    <div style={styles.paiXuTiContainer}>
      <h3 style={styles.questionTitle}>{question}</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div style={styles.cardList}>
            {items.map((item) => ( <PaiXuKaPian key={item.id} id={item.id} content={item.content} /> ))}
          </div>
        </SortableContext>
      </DndContext>

      {!feedback.shown ? (
        <button style={styles.submitButton} onClick={handleSubmit}>提交答案</button>
      ) : (
        <>
          <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
            {feedback.correct ? <><FaCheck /> 太棒了，完全正确！</> : <><FaTimes /> 顺序不对哦，再试一次！</>}
          </div>
          <button style={styles.resetButton} onClick={handleReset}><FaRedo /> 再做一次</button>
        </>
      )}
    </div>
  );
};

export default PaiXuTi;
