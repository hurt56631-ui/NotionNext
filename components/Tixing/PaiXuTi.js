import React, { useState, useMemo, useEffect, useCallback, forwardRef, memo } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaCheck, FaTimes, FaRedo, FaSpinner, FaCommentAlt, FaLightbulb } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';
import { useTransition, animated, config } from '@react-spring/web';

// --- Styles and Constants ---

// V18: Refined color palette for a more modern and accessible look.
const keyColors = [
  { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  { bg: '#fef3c7', border: '#facc15', text: '#854d0e' },
  { bg: '#f3e8ff', border: '#a78bfa', text: '#5b21b6' },
  { bg: '#fee2e2', border: '#f87171', text: '#991b1b' },
  { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
];

// V18: Modernized styles with better shadows, spacing, and fonts.
const styles = {
  container: { backgroundColor: '#ffffff', borderRadius: '24px', padding: '28px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.07), 0 8px 10px -6px rgba(0,0,0,0.07)', fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif", maxWidth: '560px', margin: '2rem auto', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' },
  title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', textAlign: 'center', margin: 0, padding: '0 8px 8px' },
  answerArea: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px', minHeight: '80px', backgroundColor: '#f1f5f9', borderRadius: '16px', border: '2px dashed #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', padding: '16px', minHeight: '80px', backgroundColor: 'transparent' },
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '65px', padding: '8px 14px', borderRadius: '12px', border: '1px solid', borderBottomWidth: '4px', cursor: 'grab', position: 'relative', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
  cardActive: { transform: 'translateY(2px) scale(0.98)', borderBottomWidth: '2px', cursor: 'grabbing' },
  pinyin: { fontSize: '0.9rem', color: 'inherit', opacity: 0.8, height: '1.2em', lineHeight: '1.2em' },
  content: { fontSize: '1.6rem', fontWeight: '500', color: 'inherit', lineHeight: '1.5em' },
  dragOverlay: { transform: 'scale(1.1) rotate(-4deg)', boxShadow: '0 12px 20px -4px rgba(0,0,0,0.2)', cursor: 'grabbing' },
  draggingSource: { opacity: 0.4, transform: 'scale(0.95)' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  button: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  submitButton: { backgroundColor: '#2563eb', boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.3)' },
  resetButton: { backgroundColor: '#64748b', boxShadow: '0 4px 14px 0 rgba(100, 116, 139, 0.3)' },
  aiButton: { backgroundColor: '#f59e0b', boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.3)' },
  viewHintButton: { backgroundColor: '#10b981', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.3)'},
  feedback: { padding: '16px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '12px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7' },
  spinner: { animation: 'spin 1s linear infinite' },
};

// V18: Inject dynamic styles for keyframes, hover effects, and responsive design.
const dynamicStyles = `
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .pai-xu-ti-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .pai-xu-ti-button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
  @media (max-width: 600px) {
    .pai-xu-ti-container { margin: 1rem; padding: 20px; border-radius: 16px; }
    .pai-xu-ti-card-base { min-width: 50px; padding: 6px 10px; }
    .pai-xu-ti-pinyin { font-size: 0.8rem; }
    .pai-xu-ti-content { font-size: 1.3rem; }
    .pai-xu-ti-title { font-size: 1.3rem; }
  }
`;

// --- Audio Management ---

let sounds = {};
let ttsCache = new Map();
if (typeof window !== 'undefined') {
  sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 });
  sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (name) => { if (sounds[name]) sounds[name].play(); };
const preloadTTS = async (text) => {
  if (ttsCache.has(text) || /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(text.trim())) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-30`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) {
    console.error(`TTS preload failed for "${text}":`, error);
  }
};
const playCachedTTS = (text) => {
  if (ttsCache.has(text)) {
    ttsCache.get(text).play();
  } else {
    preloadTTS(text).then(() => { if (ttsCache.has(text)) ttsCache.get(text).play(); });
  }
};

// --- Helper Functions ---

const buildCorrectionPrompt = (title, userOrderText, correctOrderText) => {
  return `You are a professional and friendly Chinese grammar teacher. A student made a mistake in a sentence ordering exercise. Please explain it to them in a gentle and simple manner.\n\nRules:\n1. Start with encouragement.\n2. State the student's answer and the correct answer.\n3. Explain the grammatical point in detail (e.g., Subject-Verb-Object structure).\n4. End with more encouragement.\n\nExercise Info:\n- Title: "${title}"\n- Student's incorrect answer: "${userOrderText}"\n- Correct answer: "${correctOrderText}"\n\nPlease begin your explanation:`;
};


// --- Child Components (V18: Refactored and Memoized) ---

const Card = memo(forwardRef(({ content, color, style, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  const isPunctuation = useMemo(() => /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content.trim()), [content]);
  const pinyinContent = useMemo(() => isPunctuation ? '' : pinyin(content, { toneType: 'mark' }).toLowerCase(), [content, isPunctuation]);
  const cardStyle = { ...styles.card, ...style, backgroundColor: color.bg, borderColor: color.border, color: color.text, ...(isActive ? styles.cardActive : {}) };
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  const handleClick = () => {
    if (props.onClick) {
      props.onClick();
      if (!isPunctuation) playCachedTTS(content);
    }
  };
  return (
    <div ref={ref} {...props} style={cardStyle} className="pai-xu-ti-card pai-xu-ti-card-base" onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div style={styles.pinyin} className="pai-xu-ti-pinyin">{pinyinContent}</div>
      <div style={styles.content} className="pai-xu-ti-content">{content}</div>
    </div>
  );
}));
Card.displayName = 'Card';

const SortableCard = memo(({ id, content, color, onClick, style }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const dndStyle = { transition, transform: CSS.Transform.toString(transform), ...(isDragging ? styles.draggingSource : {}) };
  return (
    <animated.div ref={setNodeRef} style={{...dndStyle, ...style}}>
      <Card id={id} content={content} color={color} onClick={onClick} {...attributes} {...listeners} />
    </animated.div>
  );
});
SortableCard.displayName = 'SortableCard';

// V18: New component to handle the feedback display logic.
const FeedbackDisplay = ({ feedback, aiExplanation, onShowExplanation }) => {
  if (!feedback.shown) return null;
  return (
    <>
      <div style={{ ...styles.feedback, ...(feedback.correct ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
        {feedback.correct ? <><FaCheck /> Absolutely correct!</> : <><FaTimes /> Not quite, try again!</>}
      </div>
      {feedback.showExplanation && aiExplanation && (
        <animated.div style={useSpring({ from: { opacity: 0, y: 10 }, to: { opacity: 1, y: 0 }})}>
          <div style={styles.explanationBox}>{aiExplanation}</div>
        </animated.div>
      )}
      {feedback.correct && aiExplanation && !feedback.showExplanation && (
        <button className="pai-xu-ti-button" style={{ ...styles.button, ...styles.viewHintButton }} onClick={onShowExplanation}>
          <FaLightbulb /> View Grammar Point
        </button>
      )}
    </>
  );
};

// V18: New component to handle the action buttons logic.
const ActionButtons = ({ feedback, aiExplanation, onCorrectionRequest, isRequestingCorrection, handleSubmit, handleReset }) => {
  if (feedback.shown) {
    return (
      <>
        {!feedback.correct && !aiExplanation && onCorrectionRequest && (
          <button className="pai-xu-ti-button" style={{ ...styles.button, ...styles.aiButton }} onClick={onCorrectionRequest} disabled={isRequestingCorrection}>
            {isRequestingCorrection ? <FaSpinner style={styles.spinner} /> : <><FaCommentAlt /> Ask AI for Explanation</>}
          </button>
        )}
        <button className="pai-xu-ti-button" style={{ ...styles.button, ...styles.resetButton }} onClick={handleReset}>
          <FaRedo /> Try Again
        </button>
      </>
    );
  }
  return (
    <button className="pai-xu-ti-button" style={{ ...styles.button, ...styles.submitButton }} onClick={handleSubmit}>
      Check Answer
    </button>
  );
};

// --- Main Component ---

const PaiXuTi = ({ title, items: initialItems, correctOrder, aiExplanation, onCorrectionRequest }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false, showExplanation: false });
  const [isRequestingCorrection, setIsRequestingCorrection] = useState(false);

  const itemsWithColors = useMemo(() => {
    if (!initialItems) return [];
    return initialItems.map((item, index) => ({ ...item, color: keyColors[index % keyColors.length] }));
  }, [initialItems]);

  const shuffledItems = useMemo(() => [...itemsWithColors].sort(() => Math.random() - 0.5), [itemsWithColors]);

  useEffect(() => {
    if (itemsWithColors.length > 0) {
      setPoolItems(shuffledItems);
      setAnswerItems([]);
      setFeedback({ shown: false, correct: false, showExplanation: false });
      itemsWithColors.forEach(item => preloadTTS(item.content));
    }
  }, [itemsWithColors, shuffledItems]);
  
  // V18: Set mounted flag for animations.
  useEffect(() => setIsMounted(true), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
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
  }, [answerItems]); // V18: Dependency array is correct.

  const handleSubmit = useCallback(() => {
    const isCorrect = answerItems.map(item => item.id).join(',') === correctOrder.join(',');
    setFeedback({ shown: true, correct: isCorrect, showExplanation: !isCorrect });
    playSound(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  }, [answerItems, correctOrder]);

  const handleReset = useCallback(() => {
    const reShuffled = [...itemsWithColors].sort(() => Math.random() - 0.5);
    setPoolItems(reShuffled);
    setAnswerItems([]);
    setFeedback({ shown: false, correct: false, showExplanation: false });
  }, [itemsWithColors]);
  
  const handleAskForCorrection = useCallback(async () => {
    if (!onCorrectionRequest) return;
    setIsRequestingCorrection(true);
    try {
        const userOrderText = answerItems.map(item => item.content).join('');
        const correctItems = correctOrder.map(id => itemsWithColors.find(item => item.id === id));
        const correctOrderText = correctItems.map(item => item.content).join('');
        const prompt = buildCorrectionPrompt(title, userOrderText, correctOrderText);
        await onCorrectionRequest(prompt);
    } catch (error) {
        console.error("Error requesting AI correction:", error);
    } finally {
        setIsRequestingCorrection(false);
    }
  }, [answerItems, correctOrder, itemsWithColors, onCorrectionRequest, title]);

  const activeItem = useMemo(() => itemsWithColors.find(item => item.id === activeId), [activeId, itemsWithColors]);
  
  // V18: Animation transitions for items entering/leaving the lists.
  const answerTransitions = useTransition(answerItems, {
    from: { opacity: 0, transform: 'scale(0.8)' },
    enter: { opacity: 1, transform: 'scale(1)' },
    leave: { opacity: 0, transform: 'scale(0.8)' },
    keys: item => item.id,
    config: config.gentle,
  });

  const poolTransitions = useTransition(poolItems, {
    from: { opacity: 0, transform: 'scale(0.8)' },
    enter: { opacity: 1, transform: 'scale(1)' },
    leave: { opacity: 0, transform: 'scale(0.8)' },
    keys: item => item.id,
    config: config.gentle,
  });

  if (!isMounted || !initialItems) return null;

  return (
    <>
      <style>{dynamicStyles}</style>
      <div style={styles.container} className="pai-xu-ti-container">
        <h3 style={styles.title} className="pai-xu-ti-title">{title}</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ ...styles.answerArea, ...(feedback.shown && !feedback.correct ? styles.answerAreaError : {})}}>
            <SortableContext items={answerItems} strategy={rectSortingStrategy}>
              {answerTransitions((style, item) => (
                <SortableCard key={item.id} id={item.id} content={item.content} color={item.color} onClick={() => toggleItemPlacement(item)} style={style} />
              ))}
            </SortableContext>
          </div>
          <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
            {activeId && activeItem ? <Card id={activeItem.id} content={activeItem.content} color={activeItem.color} style={styles.dragOverlay} /> : null}
          </DragOverlay>
        
          <div style={styles.wordPool}>
            {poolTransitions((style, item) => (
               <animated.div style={style}>
                 <Card key={item.id} id={item.id} content={item.content} color={item.color} onClick={() => toggleItemPlacement(item)} />
               </animated.div>
            ))}
          </div>
        </DndContext>
        <div style={styles.buttonContainer}>
            <FeedbackDisplay 
              feedback={feedback} 
              aiExplanation={aiExplanation} 
              onShowExplanation={() => setFeedback(f => ({...f, showExplanation: true}))} 
            />
            <ActionButtons
              feedback={feedback}
              aiExplanation={aiExplanation}
              onCorrectionRequest={handleAskForCorrection}
              isRequestingCorrection={isRequestingCorrection}
              handleSubmit={handleSubmit}
              handleReset={handleReset}
            />
        </div>
      </div>
    </>
  );
};

export default PaiXuTi;
