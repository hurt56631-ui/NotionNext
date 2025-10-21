// components/Tixing/FanYiTi.js

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaLightbulb } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';

// --- 样式定义 (卡片宽度已设为自适应) ---
const keyColors = [ { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }, { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' }, { bg: '#fef9c3', border: '#fde047', text: '#854d0e' }, { bg: '#dcfce7', border: '#86efac', text: '#166534' }, { bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' }, { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' }, { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' }, ];

const styles = {
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: '0 0 16px 0' },
  sourceSentenceBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#e2e8f0', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px' },
  sourceSentenceText: { fontSize: '1.3rem', fontWeight: '500', color: '#1e293b', flex: 1 },
  playButton: { cursor: 'pointer', color: '#64748b', fontSize: '1.5rem', display: 'flex', alignItems: 'center', marginLeft: '12px' },
  answerArea: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#cbd5e1', borderRadius: '12px', border: '2px solid #94a3b8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#e2e8f0', borderRadius: '12px' },
  // 核心改动：移除固定宽度，使用内边距和最小宽度实现自适应
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '40px', padding: '6px 14px', borderRadius: '10px', border: '1px solid #94a3b8', borderBottomWidth: '4px', cursor: 'pointer', position: 'relative', transition: 'transform 0.1s ease, box-shadow 0.1s ease', whiteSpace: 'nowrap' },
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
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7' },
};

// --- 音频与TTS ---
let sounds = {};
let ttsCache = new Map();
if (typeof window !== 'undefined') { sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }); sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }); sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }); }
const playSound = (name) => { if (sounds[name]) sounds[name].play(); };

const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', en: 'en-US-JennyNeural', my: 'my-MM-Nilar' };

const preloadTTS = async (text, lang) => {
  const cacheKey = `${lang}:${text}`;
  if (ttsCache.has(cacheKey) || !lang) return;
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

const playCachedTTS = (text, lang) => {
  const cacheKey = `${lang}:${text}`;
  if (ttsCache.has(cacheKey)) { ttsCache.get(cacheKey).play(); } 
  else { preloadTTS(text, lang).then(() => { if (ttsCache.has(cacheKey)) { ttsCache.get(cacheKey).play(); } }); }
};

// --- 卡片组件 ---
const Card = forwardRef(({ content, color, lang, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  const pinyinContent = useMemo(() => (lang === 'zh' ? pinyin(content, { toneType: 'mark' }).toLowerCase() : ''), [content, lang]);
  const cardStyle = { ...styles.card, backgroundColor: color.bg, borderColor: color.border, color: color.text, ...(isActive ? styles.cardActive : {}) };
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  const handleClick = () => { if (props.onClick) { props.onClick(); playCachedTTS(content, lang); } };
  return ( <div ref={ref} {...props} style={cardStyle} onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}> <div style={styles.pinyin}>{pinyinContent}</div> <div style={styles.content}>{content}</div> </div> );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, color, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return ( <div ref={setNodeRef} style={style}> <Card id={id} content={content} color={color} lang={lang} onClick={onClick} {...attributes} {...listeners} /> </div> );
};

// --- 主组件 ---
const FanYiTi = ({ title, sourceSentence, wordBlocks: initialItems, correctOrder, explanation, sourceLang = 'en', targetLang = 'zh' }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const itemsWithColors = useMemo(() => { if (!initialItems) return []; return initialItems.map((item, index) => ({ ...item, color: keyColors[index % keyColors.length] })); }, [initialItems]);
  const shuffledItems = useMemo(() => [...itemsWithColors].sort(() => Math.random() - 0.5), [itemsWithColors]);
  
  useEffect(() => {
    if (itemsWithColors.length > 0) {
      setPoolItems(shuffledItems);
      setAnswerItems([]);
      setIsSubmitted(false);
      setIsCorrect(false);
      // Preload audios
      if (sourceSentence) preloadTTS(sourceSentence, sourceLang);
      itemsWithColors.forEach(item => preloadTTS(item.content, targetLang));
    }
  }, [itemsWithColors, shuffledItems, sourceSentence, sourceLang, targetLang]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);
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
    setIsCorrect(isCorrect);
    setIsSubmitted(true);
    playSound(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }, [answerItems, correctOrder]);

  const handleReset = useCallback(() => {
    setPoolItems(shuffledItems);
    setAnswerItems([]);
    setIsSubmitted(false);
    setIsCorrect(false);
  }, [shuffledItems]);

  const activeItem = useMemo(() => itemsWithColors.find(item => item.id === activeId), [activeId, itemsWithColors]);

  if (!initialItems) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{title}</h3>
      
      <div style={styles.sourceSentenceBox}>
        <span style={styles.sourceSentenceText}>{sourceSentence}</span>
        <div style={styles.playButton} onClick={() => playCachedTTS(sourceSentence, sourceLang)}>
          <FaVolumeUp />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ ...styles.answerArea, ...(isSubmitted && !isCorrect ? styles.answerAreaError : {}) }}>
          <SortableContext items={answerItems} strategy={rectSortingStrategy}>
            {answerItems.map(item => <SortableCard key={item.id} id={item.id} content={item.content} color={item.color} lang={targetLang} onClick={() => toggleItemPlacement(item)} />)}
          </SortableContext>
        </div>
        <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
          {activeId && activeItem ? <Card id={activeItem.id} content={activeItem.content} color={activeItem.color} lang={targetLang} style={styles.dragOverlay} /> : null}
        </DragOverlay>
      
        <div style={styles.wordPool}>
          {poolItems.map(item => <Card key={item.id} id={item.id} content={item.content} color={item.color} lang={targetLang} onClick={() => toggleItemPlacement(item)} />)}
        </div>
      </DndContext>

      <div style={styles.buttonContainer}>
        {!isSubmitted ? (
          <button style={styles.submitButton} onClick={handleSubmit}>检查答案</button>
        ) : (
          <>
            <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
              {isCorrect ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再试一次吧！</>}
            </div>
            {explanation && (
              <div style={styles.explanationBox}>
                <FaLightbulb style={{ marginRight: '8px', color: '#f59e0b', flexShrink: 0 }} />
                <span><strong>解析：</strong> {explanation}</span>
              </div>
            )}
            <button style={{ ...styles.submitButton, backgroundColor: '#64748b' }} onClick={handleReset}>
              <FaRedo /> 再试一次
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FanYiTi;
