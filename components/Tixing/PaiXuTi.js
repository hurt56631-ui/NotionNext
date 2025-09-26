// components/Tixing/PaiXuTi.js (V15 - 终极修复与体验增强版)

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaCommentAlt, FaLightbulb } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { useSpring, animated } from '@react-spring/web';

// --- 样式定义 ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '520px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: 0, padding: '8px' },
  answerArea: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', padding: '12px', minHeight: '70px', backgroundColor: '#cbd5e1', borderRadius: '12px', border: '2px solid #94a3b8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', padding: '12px', minHeight: '70px', backgroundColor: '#cbd5e1', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)' },
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #94a3b8', borderBottomWidth: '4px', cursor: 'pointer', position: 'relative', transition: 'transform 0.1s ease, box-shadow 0.1s ease' },
  cardActive: { transform: 'translateY(2px)', borderBottomWidth: '2px' },
  pinyin: { fontSize: '0.85rem', color: 'inherit', opacity: 0.7, height: '1.2em', lineHeight: '1.2em' },
  content: { fontSize: '1.5rem', fontWeight: '500', color: 'inherit', lineHeight: '1.5em' },
  dragOverlay: { transform: 'scale(1.1) rotate(-5deg)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)', cursor: 'grabbing' },
  draggingSource: { opacity: 0.5, transform: 'scale(0.95)' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '0.95rem', lineHeight: '1.6' },
  spinner: { animation: 'spin 1s linear infinite' },
};

// ... (音效, TTS函数, Prompt构建函数都和之前一样)

const Card = forwardRef(({ content, color, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  const isPunctuation = useMemo(() => /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content.trim()), [content]);
  const pinyinContent = useMemo(() => isPunctuation ? '' : pinyin(content, { toneType: 'mark' }).toLowerCase(), [content, isPunctuation]);
  const cardStyle = { ...styles.card, backgroundColor: color.bg, borderColor: color.border, color: color.text, ...(isActive ? styles.cardActive : {}) };
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  const handleClick = () => { if (props.onClick) { props.onClick(); if (!isPunctuation) playCachedTTS(content); } };
  return ( <div ref={ref} {...props} style={cardStyle} onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}> <div style={styles.pinyin}>{pinyinContent}</div> <div style={styles.content}>{content}</div> </div> );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, color, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return ( <div ref={setNodeRef} style={style}> <Card id={id} content={content} color={color} onClick={onClick} {...attributes} {...listeners} /> </div> );
};

const PaiXuTi = ({ title, items: initialItems, correctOrder, aiExplanation, onCorrectionRequest }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false, showExplanation: false });
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);

  const itemsWithColors = useMemo(() => { if (!initialItems) return []; return initialItems.map((item, index) => ({ ...item, color: keyColors[index % keyColors.length] })); }, [initialItems]);
  const shuffledItems = useMemo(() => [...itemsWithColors].sort(() => Math.random() - 0.5), [itemsWithColors]);

  useEffect(() => {
    if (itemsWithColors.length > 0) {
      setPoolItems(shuffledItems);
      setAnswerItems([]);
      setFeedback({ shown: false, correct: false, showExplanation: false });
      itemsWithColors.forEach(item => { if (!/^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(item.content.trim())) { preloadTTS(item.content); } });
    }
  }, [itemsWithColors, shuffledItems]); // shuffledItems 加入依赖
  
  useEffect(() => { setIsMounted(true); }, []);

  const sensors = useSensors( useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) );

  const handleDragStart = useCallback((event) => { setActiveId(event.active.id); }, []);
  const handleDragEnd = useCallback((event) => { const { active, over } = event; if (over && active.id !== over.id) { setAnswerItems((items) => { const oldIndex = items.findIndex(({ id }) => id === active.id); const newIndex = items.findIndex(({ id }) => id === over.id); return arrayMove(items, oldIndex, newIndex); }); } setActiveId(null); }, []);
  
  const toggleItemPlacement = useCallback((itemToMove) => {
    playSound('click');
    if (answerItems.some(item => item.id === itemToMove.id)) {
      setAnswerItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setPoolItems(prev => [...prev, itemToMove]);
    } else {
      setPoolItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setAnswerItems(prev => [...prev, itemToMove]);
    }
  }, [answerItems]);

  const handleSubmit = useCallback(() => {
    const isCorrect = answerItems.map(item => item.id).join(',') === correctOrder.join(',');
    setFeedback({ shown: true, correct: isCorrect, showExplanation: !isCorrect }); // 答错时自动显示解释
    playSound(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }, [answerItems, correctOrder]);

  const handleReset = useCallback(() => {
      const reShuffled = [...itemsWithColors].sort(() => Math.random() - 0.5);
      setPoolItems(reShuffled);
      setAnswerItems([]);
      setFeedback({ shown: false, correct: false, showExplanation: false });
  }, [itemsWithColors]);
  
  const activeItem = useMemo(() => itemsWithColors.find(item => item.id === activeId), [activeId, itemsWithColors]);
  if (!isMounted || !initialItems) return null;
  const spinAnimationStyle = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

  return (
    <>
      <style>{spinAnimationStyle}</style>
      <div style={styles.container}>
        <h3 style={styles.title}>{title}</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ ...styles.answerArea, ...(feedback.shown && !feedback.correct ? styles.answerAreaError : {})}}>
                <SortableContext items={answerItems} strategy={rectSortingStrategy}>
                    {answerItems.map(item => <SortableCard key={item.id} id={item.id} content={item.content} color={item.color} onClick={() => toggleItemPlacement(item)} />)}
                </SortableContext>
            </div>
            <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
              {activeId && activeItem ? <Card id={activeItem.id} content={activeItem.content} color={activeItem.color} style={styles.dragOverlay} /> : null}
            </DragOverlay>
        </DndContext>
        <div style={styles.wordPool}>
            {poolItems.map(item => <Card key={item.id} id={item.id} content={item.content} color={item.color} onClick={() => toggleItemPlacement(item)} />)}
        </div>
        <div style={styles.buttonContainer}>
            {!feedback.shown ? (
                <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
            ) : (
                <>
                    <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                        {feedback.correct ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再试一次吧！</>}
                    </div>
                    {feedback.showExplanation && aiExplanation && (
                        <div style={styles.explanationBox}>{aiExplanation}</div>
                    )}
                    {feedback.correct && aiExplanation && !feedback.showExplanation && (
                        <button style={{...styles.submitButton, backgroundColor: '#10b981'}} onClick={() => setFeedback(f => ({...f, showExplanation: true}))}>
                            <FaLightbulb /> 查看语法点
                        </button>
                    )}
                    <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleReset}>
                        <FaRedo /> 再试一次
                    </button>
                </>
            )}
        </div>
      </div>
    </>
  );
};

export default PaiXuTi;
