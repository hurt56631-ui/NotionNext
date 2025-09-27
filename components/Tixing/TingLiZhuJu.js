// components/Tixing/TingLiZhuJu.js (V1 - 听力组句题)

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { FaPlay, FaCheck, FaTimes, FaRedo, FaVolumeUp } from 'react-icons/fa';

// --- 样式定义 (与 PaiXuTi V16 几乎一致) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '520px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: 0, padding: '8px' },
  mainPlayButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' },
  answerArea: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', padding: '12px', minHeight: '70px', backgroundColor: '#cbd5e1', borderRadius: '12px', border: '2px dashed #94a3b8', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', padding: '12px', minHeight: '70px', backgroundColor: '#cbd5e1', borderRadius: '12px' },
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '60px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #94a3b8', borderBottomWidth: '4px', cursor: 'pointer', position: 'relative', transition: 'transform 0.1s ease, box-shadow 0.1s ease', background: 'white' },
  cardActive: { transform: 'translateY(2px)', borderBottomWidth: '2px' },
  pinyin: { fontSize: '0.85rem', color: '#64748b', height: '1.2em', lineHeight: '1.2em' },
  content: { fontSize: '1.5rem', fontWeight: '500', color: '#334155', lineHeight: '1.5em' },
  dragOverlay: { transform: 'scale(1.1) rotate(-5deg)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)', cursor: 'grabbing' },
  draggingSource: { opacity: 0.5, transform: 'scale(0.95)' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
};

// --- 音效 & TTS ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }), correct: new Howl({ src: ['/sounds/correct.mp3'] }), incorrect: new Howl({ src: ['/sounds/incorrect.mp3'] }) };
let ttsCache = new Map();
const playSound = (name) => sounds[name]?.play();
const preloadTTS = async (text) => { if (ttsCache.has(text) || !text) return; try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-20`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); } catch (e) { console.error(`预加载 "${text}" 失败:`, e); } };
const playCachedTTS = (text) => { if (ttsCache.has(text)) { ttsCache.get(text).play(); } else { preloadTTS(text).then(() => { if (ttsCache.has(text)) ttsCache.get(text).play(); }); } };

const Card = forwardRef(({ content, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  const pinyinContent = useMemo(() => pinyin(content, { toneType: 'mark' }).toLowerCase(), [content]);
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  const handleClick = () => { if (props.onClick) { props.onClick(); playCachedTTS(content); } };
  return ( <div ref={ref} {...props} style={{ ...styles.card, ...(isActive ? styles.cardActive : {}) }} onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}> <div style={styles.pinyin}>{pinyinContent}</div> <div style={styles.content}>{content}</div> </div> );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return ( <div ref={setNodeRef} style={style}> <Card id={id} content={content} onClick={() => onClick({ id, content })} {...attributes} {...listeners} /> </div> );
};

const TingLiZhuJu = ({ title, fullSentence, candidateItems, correctOrder }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });
  const shuffledItems = useMemo(() => [...candidateItems].sort(() => Math.random() - 0.5), [candidateItems]);

  useEffect(() => {
    setPoolItems(shuffledItems);
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false });
    preloadTTS(fullSentence);
    candidateItems.forEach(item => preloadTTS(item.content));
  }, [shuffledItems, candidateItems, fullSentence]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);
  const handleDragEnd = useCallback((event) => { const { active, over } = event; if (over && active.id !== over.id) { setAnswerItems((items) => arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id))); } setActiveId(null); }, []);
  
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
    setFeedback({ shown: true, correct: isCorrect });
    playSound(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) confetti();
  }, [answerItems, correctOrder]);

  const handleReset = useCallback(() => {
    setPoolItems([...candidateItems].sort(() => Math.random() - 0.5));
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false });
  }, [candidateItems]);

  const activeItem = useMemo(() => candidateItems.find(item => item.id === activeId), [activeId, candidateItems]);
  if (!candidateItems) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{title}</h3>
      <button style={styles.mainPlayButton} onClick={() => playCachedTTS(fullSentence)}>
        <FaPlay /> 播放句子
      </button>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ ...styles.answerArea, ...(feedback.shown && !feedback.correct ? styles.answerAreaError : {})}}>
            <SortableContext items={answerItems} strategy={rectSortingStrategy}>
                {answerItems.map(item => <SortableCard key={item.id} id={item.id} content={item.content} onClick={toggleItemPlacement} />)}
            </SortableContext>
        </div>
        <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>{activeId && activeItem ? <Card content={activeItem.content} style={styles.dragOverlay} /> : null}</DragOverlay>
      </DndContext>
      <div style={styles.wordPool}>
        {poolItems.map(item => <Card key={item.id} content={item.content} onClick={() => toggleItemPlacement(item)} />)}
      </div>
      <div style={styles.buttonContainer}>
        {!feedback.shown ? (
            <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
        ) : (
            <>
                <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                    {feedback.correct ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 答案不对哦，再试一次！</>}
                </div>
                <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleReset}>
                    <FaRedo /> 再试一次
                </button>
            </>
        )}
      </div>
    </div>
  );
};
export default TingLiZhuJu;
