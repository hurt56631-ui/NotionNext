// components/Tixing/PaiXuTi.js (V13 - 修复预加载声音重叠的最终版)

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaCommentAlt } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { useSpring, animated } from '@react-spring/web';

// --- 样式定义 (保持不变) ---
const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '24px' },
  title: { fontSize: '1.6rem', fontWeight: 'bold', color: '#1e2b3b', textAlign: 'center', margin: 0 },
  answerArea: { display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px', minHeight: '80px', backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: '12px', border: '2px dashed #cbd5e1', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '12px', minHeight: '80px', backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: '12px', border: '2px solid #e2e8f0' },
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', borderLeft: '4px solid #3b82f6', transition: 'box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease' },
  pinyin: { fontSize: '0.85rem', color: '#64748b', height: '1.1em' },
  content: { fontSize: '1.3rem', fontWeight: '500', color: '#334155' },
  dragOverlay: { transform: 'scale(1.1)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', cursor: 'grabbing' },
  draggingSource: { opacity: 0.5 },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  spinner: { animation: 'spin 1s linear infinite' },
};

// --- 音效 & TTS (核心修改在这里) ---
let sounds = {};
let ttsCache = new Map();
if (typeof window !== 'undefined') {
  sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 });
  sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (name) => { if (sounds[name]) sounds[name].play(); };

// 新的、分离的函数
const preloadTTS = async (text) => {
    if (ttsCache.has(text)) return; // 如果已经缓存，就什么都不做
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(text, audio); // 只缓存，不播放
    } catch (error) {
        console.error(`预加载 "${text}" 失败:`, error);
    }
};

const playCachedTTS = (text) => {
    if (ttsCache.has(text)) {
        ttsCache.get(text).play();
    } else {
        // 如果由于某种原因预加载失败，则退回到即时加载播放
        preloadTTS(text).then(() => {
            if (ttsCache.has(text)) {
                ttsCache.get(text).play();
            }
        });
    }
};

// --- 抽离的 Prompt 构建函数 (保持不变) ---
const buildCorrectionPrompt = (title, userOrderText, correctOrderText) => {
  return `你是一位专业的中文语法老师。一名学生做错了句子排序题，请用亲切、简单的方式为他解释。\n\n规则：\n1. 先鼓励学生。\n2. 指出学生的答案和正确答案。\n3. 详细解释语法点（如主谓宾）。\n4. 最后再次鼓励。\n\n题目信息：\n- 题目: "${title}"\n- 学生的错误答案: "${userOrderText}"\n- 正确答案: "${correctOrderText}"\n\n请开始你的解释：`;
};

// --- 卡片子组件 (需要修改 onClick) ---
const Card = forwardRef(({ content, ...props }, ref) => {
  const isPunctuation = useMemo(() => /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content.trim()), [content]);
  const pinyinContent = useMemo(() => isPunctuation ? '' : pinyin(content, { toneType: 'mark' }).toLowerCase(), [content, isPunctuation]);

  const handleClick = useCallback(() => {
      if (props.onClick) {
          props.onClick();
      }
      if (!isPunctuation) {
          playCachedTTS(content); // 点击时播放已缓存的音频
      }
  }, [props.onClick, content, isPunctuation]);
  
  return (
    <div ref={ref} {...props} style={{ ...styles.card, cursor: props.onClick ? 'pointer' : 'grab' }} onClick={handleClick}>
      <div style={styles.pinyin}>{pinyinContent}</div>
      <div style={styles.content}>{content}</div>
    </div>
  );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [springProps, api] = useSpring(() => ({ x: 0, config: { tension: 300, friction: 15 } }));
  useEffect(() => { if (isDragging) { api.start({ x: 0 }); } }, [isDragging, api]);
  const style = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return (
    <animated.div ref={setNodeRef} style={{...style, ...springProps}}>
      <Card id={id} content={content} {...attributes} {...listeners} />
    </animated.div>
  );
};

// --- 主组件 ---
const PaiXuTi = ({ title, items: initialItems, correctOrder, onCorrectionRequest }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);

  // useEffect 中只调用预加载
  useEffect(() => {
    if (initialItems) {
      const shuffled = [...initialItems].sort(() => Math.random() - 0.5);
      setPoolItems(shuffled);
      setAnswerItems([]);
      setFeedback({ shown: false, correct: false });
      // 只预加载，不播放
      initialItems.forEach(item => {
        if (!/^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(item.content.trim())) {
          preloadTTS(item.content);
        }
      });
    }
  }, [initialItems]);
  
  useEffect(() => { setIsMounted(true); }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event) => { setActiveId(event.active.id); }, []);
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        setAnswerItems((items) => {
            const oldIndex = items.findIndex(({ id }) => id === active.id);
            const newIndex = items.findIndex(({ id }) => id === over.id);
            return arrayMove(items, oldIndex, newIndex);
        });
    }
    setActiveId(null);
  }, []);

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
    if (isCorrect) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }, [answerItems, correctOrder]);
  
  const handleAskForCorrection = useCallback(() => {
    if (!onCorrectionRequest) return;
    setIsRequestingCorrection(true);
    const userOrderText = answerItems.map(item => item.content).join('');
    const correctItems = correctOrder.map(id => initialItems.find(item => item.id === id));
    const correctOrderText = correctItems.map(item => item.content).join('');
    const prompt = buildCorrectionPrompt(title, userOrderText, correctOrderText);
    onCorrectionRequest(prompt);
  }, [answerItems, correctOrder, initialItems, onCorrectionRequest, title]);

  const activeItem = useMemo(() => initialItems.find(item => item.id === activeId), [activeId, initialItems]);
  
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
                    {answerItems.map(item => <SortableCard key={item.id} id={item.id} content={item.content} />)}
                </SortableContext>
            </div>
            <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
              {activeId && activeItem ? <Card id={activeItem.id} content={activeItem.content} style={styles.dragOverlay} /> : null}
            </DragOverlay>
        </DndContext>
        <div style={styles.wordPool}>
            {poolItems.map(item => <Card key={item.id} id={item.id} content={item.content} onClick={() => toggleItemPlacement(item)} />)}
        </div>
        <div style={styles.buttonContainer}>
            {!feedback.shown ? (
                <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
            ) : (
                <>
                    <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                        {feedback.correct ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再试一次吧！</>}
                    </div>
                    {!feedback.correct && (
                        <button style={{...styles.submitButton, backgroundColor: '#f59e0b'}} onClick={handleAskForCorrection} disabled={isRequestingCorrection}>
                            {isRequestingCorrection ? <FaSpinner style={styles.spinner} /> : <><FaCommentAlt /> 请 AI 解释</>}
                        </button>
                    )}
                </>
            )}
        </div>
      </div>
    </>
  );
};

export default PaiXuTi;
