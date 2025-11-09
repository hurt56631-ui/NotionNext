// components/Tixing/PaiXuTi.js (最终修复版 - 修正字段名并按要求修改)

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaSpinner, FaCommentAlt, FaLightbulb } from 'react-icons/fa';
// import confetti from 'canvas-confetti'; // Parent handles confetti now
import { pinyin } from 'pinyin-pro';

// --- 样式定义 ---
const keyColors = [ { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }, { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' }, { bg: '#fef9c3', border: '#fde047', text: '#854d0e' }, { bg: '#dcfce7', border: '#86efac', text: '#166534' }, { bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' }, { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' }, { bg: '##f1f5f9', border: '#cbd5e1', text: '#334155' }, ];

const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '520px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  titleContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', margin: 0 },
  titlePlayButton: { cursor: 'pointer', color: '#64748b', fontSize: '1.5rem', display: 'flex', alignItems: 'center' },
  answerArea: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#cbd5e1', borderRadius: '12px', border: '2px solid #94a3b8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#cbd5e1', borderRadius: '12px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)' },
  // [核心修改] 卡片大小自适应
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 'max-content', flexShrink: 0, padding: '6px 12px', borderRadius: '10px', border: '1px solid #94a3b8', borderBottomWidth: '4px', cursor: 'pointer', position: 'relative', transition: 'transform 0.1s ease, box-shadow 0.1s ease' },
  cardActive: { transform: 'translateY(2px)', borderBottomWidth: '2px' },
  pinyin: { fontSize: '0.8rem', color: 'inherit', opacity: 0.7, height: '1.2em', lineHeight: '1.2em' },
  content: { fontSize: '1.3rem', fontWeight: '500', color: 'inherit', lineHeight: '1.5em' },
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

// --- 音频与TTS ---
let sounds = {};
let ttsCache = new Map();
if (typeof window !== 'undefined') { sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }); sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }); sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }); }
const playSound = (name) => { if (sounds[name]) sounds[name].play(); };

const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', my: 'my-MM-Nilar' };

const preloadTTS = async (text, lang = 'zh') => {
  const cacheKey = `${lang}:${text}`;
  if (ttsCache.has(cacheKey) || !text) return;
  try {
    const voice = ttsVoices[lang];
    if (!voice) throw new Error(`Unsupported language: ${lang}`);
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(cacheKey, audio);
  } catch (error) { console.error(`预加载 "${text}" (${lang}) 失败:`, error); }
};

const playCachedTTS = (text, lang = 'zh') => {
  if (!text) return;
  const cacheKey = `${lang}:${text}`;
  if (ttsCache.has(cacheKey)) { ttsCache.get(cacheKey).play(); } 
  else { preloadTTS(text, lang).then(() => { if (ttsCache.has(cacheKey)) { ttsCache.get(cacheKey).play(); } }); }
};

const buildCorrectionPrompt = (title, userOrderText, correctOrderText) => { return `你是一位专业的中文语法老师。一名学生做错了句子排序题，请用亲切、简单的方式为他解释。\n\n规则：\n1. 先鼓励学生。\n2. 指出学生的答案和正确答案。\n3. 详细解释语法点（如主谓宾）。\n4. 最后再次鼓励。\n\n题目信息：\n- 题目: "${title}"\n- 学生的错误答案: "${userOrderText}"\n- 正确答案: "${correctOrderText}"\n\n请开始你的解释：`; };

// --- 卡片组件 ---
const Card = forwardRef(({ content, color, lang, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  
  const isPunctuation = useMemo(() => {
    if (typeof content !== 'string') return false;
    return /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content.trim());
  }, [content]);
  
  const pinyinContent = useMemo(() => {
    if (lang !== 'zh' || !content || isPunctuation) return '';
    return pinyin(content, { toneType: 'mark' }).toLowerCase();
  }, [content, isPunctuation, lang]);

  const cardStyle = { ...styles.card, backgroundColor: color.bg, borderColor: color.border, color: color.text, ...(isActive ? styles.cardActive : {}) };
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
      if (!isPunctuation) playCachedTTS(content, lang);
    }
  };
  return ( <div ref={ref} {...props} style={cardStyle} onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}> <div style={styles.pinyin}>{pinyinContent}</div> <div style={styles.content}>{content}</div> </div> );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, color, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return ( <div ref={setNodeRef} style={style}> <Card id={id} content={content} color={color} lang={lang} onClick={onClick} {...attributes} {...listeners} /> </div> );
};

// --- 主组件 ---
const PaiXuTi = ({ title, items: initialItems, correctOrder, aiExplanation, onCorrectionRequest, lang = 'zh', onCorrect }) => { // 增加 onCorrect prop
  const [isMounted, setIsMounted] = useState(false);
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false, showExplanation: false });
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);
  const itemsWithColors = useMemo(() => { if (!initialItems) return []; return initialItems.map((item, index) => ({ ...item, color: keyColors[index % keyColors.length] })); }, [initialItems]);
  
  // 负责重置当前排序题的状态（重新洗牌，清空答案区）
  const resetCurrentQuestion = useCallback(() => {
    const shuffledItems = [...itemsWithColors].sort(() => Math.random() - 0.5); // 重新打乱顺序
    setPoolItems(shuffledItems);
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false, showExplanation: false });
    setIsRequestingCorrection(false); // 重置AI解释请求状态
  }, [itemsWithColors]);

  // 初始加载和 items 变化时重置题目
  useEffect(() => {
    if (itemsWithColors.length > 0) {
      resetCurrentQuestion();
      if(title) preloadTTS(title, lang);
      itemsWithColors.forEach(item => {
        if (item.text && !/^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(item.text.trim())) {
          preloadTTS(item.text, lang);
        }
      });
    }
  }, [itemsWithColors, title, lang, resetCurrentQuestion]);

  useEffect(() => { setIsMounted(true); }, []);
  
  const sensors = useSensors( useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) );
  const handleDragStart = useCallback((event) => { setActiveId(event.active.id); }, []);
  const handleDragEnd = useCallback((event) => { const { active, over } = event; if (over && active.id !== over.id) { setAnswerItems((items) => { const oldIndex = items.findIndex(({ id }) => id === active.id); const newIndex = items.findIndex(({ id }) => id === over.id); return arrayMove(items, oldIndex, newIndex); }); } setActiveId(null); }, []);
  const toggleItemPlacement = useCallback((itemToMove) => { playSound('click'); if (answerItems.some(item => item.id === itemToMove.id)) { setAnswerItems(prev => prev.filter(item => item.id !== itemToMove.id)); setPoolItems(prev => [...prev, itemToMove]); } else { setPoolItems(prev => prev.filter(item => item.id !== itemToMove.id)); setAnswerItems(prev => [...prev, itemToMove]); } }, [answerItems]);
  
  const handleSubmit = useCallback(() => { 
    const isCorrect = answerItems.map(item => item.id).join(',') === correctOrder.join(','); 
    setFeedback({ shown: true, correct: isCorrect, showExplanation: !isCorrect }); 
    playSound(isCorrect ? 'correct' : 'incorrect'); 
    
    // 如果答案正确，通知父组件（InteractiveLesson）当前块已完成
    if (isCorrect) {
      if (onCorrect) {
        onCorrect(); // 调用父组件的 onCorrect (即 delayedNextStep)
      }
      // 这里不再进行 confetti 或 4.5 秒延迟，父组件会处理
    }
  }, [answerItems, correctOrder, onCorrect]); // 增加 onCorrect 到依赖数组

  // 移除 PaiXuTi 内部的 4.5 秒自动下一题的 useEffect
  // 因为 InteractiveLesson 的 onCorrect (delayedNextStep) 已经处理了延迟和跳转
  // useEffect(() => {
  //   let timer;
  //   if (feedback.shown && feedback.correct) {
  //     timer = setTimeout(() => {
  //       handleNextQuestion();
  //     }, 4500); // 4.5秒
  //   }
  //   // 组件卸载或 feedback 变化时清除定时器
  //   return () => clearTimeout(timer);
  // }, [feedback.shown, feedback.correct, handleNextQuestion]);

  // 用户点击“下一题”或“重新尝试”的处理器
  const handleUserAction = useCallback(() => {
    if (feedback.correct) {
      // 如果答对了，直接通知父组件进入下一块
      if (onCorrect) {
        onCorrect();
      }
    } else {
      // 如果答错了，重置当前题目，让用户重新尝试
      resetCurrentQuestion();
    }
  }, [feedback.correct, onCorrect, resetCurrentQuestion]);

  const handleAskForCorrection = useCallback(() => { 
    if (!onCorrectionRequest) return; 
    setIsRequestingCorrection(true); 
    const userOrderText = answerItems.map(item => item.text).join(''); 
    const correctItems = correctOrder.map(id => itemsWithColors.find(item => item.id === id));
    const correctOrderText = correctItems.map(item => item.text).join(''); 
    const prompt = buildCorrectionPrompt(title, userOrderText, correctOrderText); 
    onCorrectionRequest(prompt); 
  }, [answerItems, correctOrder, itemsWithColors, onCorrectionRequest, title]);
  
  const activeItem = useMemo(() => itemsWithColors.find(item => item.id === activeId), [activeId, itemsWithColors]);
  
  if (!isMounted || !initialItems) return null;
  const spinAnimationStyle = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;

  return (
    <>
      <style>{spinAnimationStyle}</style>
      <div style={styles.container}>
        <div style={styles.titleContainer}>
            <h3 style={styles.title}>{title}</h3>
            <div style={styles.titlePlayButton} onClick={() => playCachedTTS(title, lang)}>
                <FaVolumeUp />
            </div>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ ...styles.answerArea, ...(feedback.shown && !feedback.correct ? styles.answerAreaError : {})}}>
                <SortableContext items={answerItems} strategy={rectSortingStrategy}>
                    {answerItems.map(item => 
                        <SortableCard key={item.id} id={item.id} content={item.text} color={item.color} lang={lang} onClick={() => toggleItemPlacement(item)} />
                    )}
                </SortableContext>
            </div>
            <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
              {activeId && activeItem ? 
                <Card id={activeItem.id} content={activeItem.text} color={activeItem.color} lang={lang} style={styles.dragOverlay} /> 
              : null}
            </DragOverlay>
        </DndContext>
        <div style={styles.wordPool}>
            {poolItems.map(item => 
                <Card key={item.id} id={item.id} content={item.text} color={item.color} lang={lang} onClick={() => toggleItemPlacement(item)} />
            )}
        </div>
        <div style={styles.buttonContainer}>
            {!feedback.shown ? (
                <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
            ) : (
                <>
                    <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.incorrect) }}> {/* 修正了feedback.incorrect拼写错误 */}
                        {/* [核心修改] 错误提示文案修改 */}
                        {feedback.correct ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 答案不对哦！</>}
                    </div>
                    {feedback.showExplanation && aiExplanation && (
                        <div style={styles.explanationBox}>{aiExplanation}</div>
                    )}
                    {feedback.correct && aiExplanation && !feedback.showExplanation && (
                        <button style={{...styles.submitButton, backgroundColor: '#10b981'}} onClick={() => setFeedback(f => ({...f, showExplanation: true}))}>
                            <FaLightbulb /> 查看语法点
                        </button>
                    )}
                    {!feedback.correct && !aiExplanation && onCorrectionRequest && (
                         <button style={{...styles.submitButton, backgroundColor: '#f59e0b'}} onClick={handleAskForCorrection} disabled={isRequestingCorrection}>
                            {isRequestingCorrection ? <FaSpinner style={styles.spinner} /> : <><FaCommentAlt /> 请 AI 解释</>}
                        </button>
                    )}
                    {/* [核心修改] 按钮文案和功能绑定修改 */}
                    <button style={{...styles.submitButton, backgroundColor: '#64748b'}} onClick={handleUserAction}>
                        {feedback.correct ? <><FaRedo /> 下一题</> : <><FaRedo /> 重新尝试</>}
                    </button>
                </>
            )}
        </div>
      </div>
    </>
  );
};

export default PaiXuTi;
