// components/Tixing/PaiXuTi.js (V9 - 完整最终修复版)
import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaCommentAlt } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';

const styles = {
  paiXuTiContainer: { backgroundColor: '#f0f4f8', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', border: '1px solid rgba(255, 255, 255, 0.18)', fontFamily: 'sans-serif', marginBottom: '2rem', maxWidth: '600px', margin: '2rem auto' },
  questionTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', marginBottom: '2rem', textAlign: 'center' },
  cardList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  paiXuKaPian: { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', position: 'relative', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', transition: 'box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease', touchAction: 'none' },
  draggingSource: { opacity: 0.4, borderStyle: 'dashed', },
  dragOverlay: { boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', transform: 'scale(1.05)', cursor: 'grabbing' },
  textContentWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexGrow: 1, },
  pinyinText: { fontSize: '0.9rem', color: '#64748b', marginBottom: '4px', height: '1.2em', fontFamily: 'sans-serif' },
  characterText: { fontSize: '1.4rem', color: '#334155', fontWeight: '500' },
  punctuationCharacterText: { fontSize: '1.4rem', color: '#64748b', fontWeight: '500' },
  ttsButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#64748b', transition: 'color 0.2s ease', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  feedback: { marginTop: '1.5rem', padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  loadingPlaceholder: { textAlign: 'center', padding: '2rem', color: '#6c757d' },
  submitButton: { width: '100%', padding: '14px', marginTop: '1.5rem', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease' },
  resetButton: { width: '100%', padding: '12px', marginTop: '1rem', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '1rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner: { animation: 'spin 1s linear infinite' },
};
let soundDrag, soundDrop, soundCorrect, soundIncorrect, currentAudio;
if (typeof window !== 'undefined') { soundDrag = new Howl({ src: ['/sounds/drag.mp3'], volume: 0.5 }); soundDrop = new Howl({ src: ['/sounds/drop.mp3'], volume: 0.5 }); soundCorrect = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }); soundIncorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }); }
const playSound = (sound) => { if (sound && sound.play) { sound.play(); } };
async function playTTS(text, onStart, onEnd) { if (currentAudio) { currentAudio.pause(); currentAudio = null; } onStart(); const apiBaseUrl = 'https://t.leftsite.cn'; const voice = 'zh-CN-XiaochenMultilingualNeural'; const encodedText = encodeURIComponent(text); const url = `${apiBaseUrl}/tts?t=${encodedText}&v=${voice}`; try { const response = await fetch(url); if (!response.ok) throw new Error(`API 错误: ${response.statusText}`); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); currentAudio = audio; audio.play(); audio.onended = () => { currentAudio = null; onEnd(); }; audio.onerror = () => { currentAudio = null; onEnd(); }; } catch (error) { console.error('TTS 朗读失败:', error); alert('抱歉，朗读失败了。请检查网络或稍后再试。'); onEnd(); } }

const PaiXuKaPian = ({ id, content, isDragging }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const isPunctuation = useMemo(() => { if (!content) return false; const punctuationRegex = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/; return punctuationRegex.test(content.trim()); }, [content]);
  const pinyinContent = useMemo(() => { if (!content || isPunctuation) return ''; return pinyin(content, { toneType: 'mark' }).toLowerCase(); }, [content, isPunctuation]);
  const style = { ...styles.paiXuKaPian, transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  const handleTtsClick = (e) => { e.stopPropagation(); if (isTtsLoading || isPunctuation) return; playTTS(content, () => setIsTtsLoading(true), () => setIsTtsLoading(false)); };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={styles.textContentWrapper}>
        <div style={styles.pinyinText}>{pinyinContent}</div>
        <div style={isPunctuation ? styles.punctuationCharacterText : styles.characterText}>{content}</div>
      </div>
      {!isPunctuation && (
        <button style={styles.ttsButton} onClick={handleTtsClick} title="朗读" disabled={isTtsLoading}>
            {isTtsLoading ? <FaSpinner style={styles.spinner} /> : <FaVolumeUp />}
        </button>
      )}
    </div>
  );
};

const PaiXuTi = ({ title, items: initialItems, correctOrder, onCorrectionRequest }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const shuffledItems = useMemo(() => { if (!initialItems) return []; const itemsCopy = [...initialItems]; for (let i = itemsCopy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[itemsCopy[i], itemsCopy[j]] = [itemsCopy[j], itemsCopy[i]]; } return itemsCopy; }, [initialItems]);
  const [items, setItems] = useState(shuffledItems);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 }}));
  const activeItem = useMemo(() => items.find(item => item.id === activeId), [activeId, items]);

  function handleDragStart(event) { setActiveId(event.active.id); playSound(soundDrag); }
  function handleDragEnd(event) { const { active, over } = event; if (over && active.id !== over.id) { setItems((currentItems) => { const oldIndex = currentItems.findIndex(item => item.id === active.id); const newIndex = currentItems.findIndex(item => item.id === over.id); return arrayMove(currentItems, oldIndex, newIndex); }); playSound(soundDrop); } setActiveId(null); }
  function handleDragCancel() { setActiveId(null); }
  
  const handleSubmit = () => { const currentAnswer = items.map(item => item.id).join(','); const correctAnswer = correctOrder.join(','); const isCorrect = currentAnswer === correctAnswer; setFeedback({ shown: true, correct: isCorrect }); if (isCorrect) { playSound(soundCorrect); confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } }); } else { playSound(soundIncorrect); } };
  const handleReset = () => { setItems(shuffledItems); setFeedback({ shown: false, correct: false }); setIsRequestingCorrection(false); };
  const handleAskForCorrection = () => { if (!onCorrectionRequest) { alert("纠错功能当前不可用。"); return; } setIsRequestingCorrection(true); const userOrder = items.map(item => item.content).join(''); const correctItems = correctOrder.map(id => initialItems.find(item => item.id === id)); const correctOrderText = correctItems.map(item => item.content).join(''); const correctionPrompt = `你是一位专业的、富有同情心的中文语法老师。一名缅甸学生正在做一个句子排序题，但是他做错了。\n你的任务是：\n1. 首先，用亲切的语气承认学生犯了一个很常见的错误，鼓励他不要灰心。\n2. 清晰地指出学生给出的答案是什么，以及正确答案应该是什么。\n3. 【最重要】用简单易懂的方式，结合中文语法规则（例如：主谓宾结构、时间状语的位置等），解释为什么学生的答案是错的，以及为什么正确答案是正确的。\n4. 最后，用一句鼓励的话结束。\n5. 你的整个回答都必须使用简体中文。\n\n这是题目的信息：\n- **题目要求**: "${title}"\n- **学生给出的错误顺序**: "${userOrder}"\n- **正确的顺序**: "${correctOrderText}"\n\n请开始你的解释。`; onCorrectionRequest(correctionPrompt); };
  
  if (!isMounted || !initialItems) { return <div style={styles.paiXuTiContainer}><div style={styles.loadingPlaceholder}>题目加载中...</div></div>; }
  const spinAnimationStyle = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
  
  return (
    <>
      <style>{spinAnimationStyle}</style>
      <div style={styles.paiXuTiContainer}>
        <h3 style={styles.questionTitle}>{title}</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div style={styles.cardList}>
              {items.map((item) => ( <PaiXuKaPian key={item.id} id={item.id} content={item.content} isDragging={item.id === activeId} /> ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId && activeItem ? (
                <div style={{...styles.paiXuKaPian, ...styles.dragOverlay}}>
                    <div style={styles.textContentWrapper}>
                        <div style={styles.pinyinText}>{pinyin(activeItem.content, { toneType: 'mark' }).toLowerCase()}</div>
                        <div style={styles.characterText}>{activeItem.content}</div>
                    </div>
                    <button style={styles.ttsButton}><FaVolumeUp /></button>
                </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        {!feedback.shown ? (<button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>) : (<>
          <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
            {feedback.correct ? <><FaCheck /> 太棒了，完全正确！</> : <><FaTimes /> 顺序不对哦，再试一次！</>}
          </div>
          {!feedback.correct && (
            <button style={{...styles.submitButton, backgroundColor: '#f59e0b', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}} onClick={handleAskForCorrection} disabled={isRequestingCorrection}>
              {isRequestingCorrection ? <FaSpinner style={styles.spinner} /> : <><FaCommentAlt /> 请 AI 帮忙纠错</>}
            </button>
          )}
          <button style={styles.resetButton} onClick={handleReset}><FaRedo /> 再做一次</button>
        </>)}
      </div>
    </>
  );
};

export default PaiXuTi;
