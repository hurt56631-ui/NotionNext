// components/Tixing/PaiXuTi.js (全新重构 - 沉浸式V2 - 放大版)

import React, 'useState', useMemo, useEffect, useCallback } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useDrag } from '@use-gesture/react';
import { FaVolumeUp, FaCheck, FaTimes, FaChevronUp } from 'react-icons/fa';
import { pinyin } from 'pinyin-pro';
import { Howl } from 'howler';
import confetti from 'canvas-confetti';

// --- 样式定义 ---
const ComponentStyles = `
  @keyframes pai-xu-ti-fade-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pai-xu-ti-bounce-up {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-15px); }
    60% { transform: translateY(-7px); }
  }
  .pai-xu-ti-wrapper {
    width: 100%;
    height: 100%;
    background-color: #1e293b; /* slate-900 */
    color: #f8fafc; /* slate-50 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    animation: pai-xu-ti-fade-in 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    user-select: none;
  }
  .pai-xu-ti-content-area {
    width: 100%;
    max-width: 640px; /* 【优化】适当增加内容区域最大宽度 */
    display: flex;
    flex-direction: column;
    gap: 24px; /* 【优化】增加元素间距 */
  }
  .pai-xu-ti-title-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
  }
  .pai-xu-ti-title {
    font-size: 2.2rem; /* 【放大】标题字体 */
    font-weight: 700;
    margin: 0;
  }
  .pai-xu-ti-title-play-button {
    cursor: pointer;
    font-size: 2rem; /* 【放大】朗读按钮 */
    color: #94a3b8; /* slate-400 */
    transition: color 0.2s;
  }
  .pai-xu-ti-title-play-button:hover { color: #cbd5e1; /* slate-300 */ }
  .pai-xu-ti-drop-zone, .pai-xu-ti-word-pool {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 12px; /* 【优化】卡片间距 */
    padding: 16px;
    min-height: 100px; /* 【放大】区域最小高度 */
    border-radius: 18px;
  }
  .pai-xu-ti-drop-zone {
    background-color: #0f172a; /* slate-950 */
    border: 2px dashed #475569; /* slate-600 */
    transition: border-color 0.3s ease;
  }
  .pai-xu-ti-drop-zone-error { border-color: #f87171; /* red-400 */ }
  .pai-xu-ti-word-pool {
    background-color: rgba(15, 23, 42, 0.5); /* slate-950/50 */
  }
  .pai-xu-ti-card {
    touch-action: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 90px; /* 【放大】卡片最小宽度 */
    padding: 12px 8px; /* 【放大】卡片内边距 */
    border-radius: 14px; /* 【优化】圆角 */
    border: 1px solid #475569; /* slate-600 */
    background-color: #334155; /* slate-700 */
    color: #f1f5f9; /* slate-100 */
    cursor: pointer;
    position: relative;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .pai-xu-ti-card:hover { transform: translateY(-4px); }
  .pai-xu-ti-pinyin {
    font-size: 0.9rem; /* 【放大】拼音字体 */
    color: #94a3b8; /* slate-400 */
    height: 1.3em;
  }
  .pai-xu-ti-content {
    font-size: 2rem; /* 【放大】核心文字字体 */
    font-weight: 600;
  }
  .pai-xu-ti-drag-overlay {
    transform: scale(1.1) rotate(-5deg);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    cursor: grabbing;
  }
  .pai-xu-ti-button-container { /* ... (样式无变化) ... */ }
  .pai-xu-ti-submit-button { /* ... (样式无变化) ... */ }
  .pai-xu-ti-feedback-container { /* ... (样式无变化) ... */ }
  .pai-xu-ti-continue-prompt { /* ... (样式无变化) ... */ }
`;

// ... (音频管理、Card 和 SortableCard 组件代码无变化)
// --- 音频管理 ---
let sounds = {};
if (typeof window !== 'undefined') {
  sounds.click = new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 });
  sounds.correct = new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 });
  sounds.incorrect = new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 });
}
const playSound = (name) => sounds[name]?.play();

// --- 卡片组件 ---
const Card = React.forwardRef(({ content, ...props }, ref) => {
  const isPunctuation = useMemo(() => /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/.test(content.trim()), [content]);
  const pinyinContent = useMemo(() => (isPunctuation ? '' : pinyin(content, { toneType: 'mark' }).toLowerCase()), [content, isPunctuation]);
  return (
    <div ref={ref} {...props} className="pai-xu-ti-card">
      <div className="pai-xu-ti-pinyin">{pinyinContent}</div>
      <div className="pai-xu-ti-content">{content}</div>
    </div>
  );
});
Card.displayName = 'Card';

const SortableCard = ({ id, content, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    ...(isDragging ? { opacity: 0.4 } : {}),
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card content={content} onClick={onClick} {...attributes} {...listeners} />
    </div>
  );
};


// --- 主组件 (逻辑无变化) ---
const PaiXuTi = ({ title, items, correctOrder, onCorrect, onComplete, settings }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });

  // 初始化和重置题目
  useEffect(() => {
    if (items) {
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      setPoolItems(shuffled);
      setAnswerItems([]);
      setFeedback({ shown: false, correct: false });
    }
  }, [items, title]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const activeItem = useMemo(() => items.find(item => item.id === activeId), [activeId, items]);

  const toggleItemPlacement = useCallback((itemToMove) => {
    if (feedback.shown) return;
    playSound('click');
    settings.playTTS(itemToMove.text, 'zh');
    if (answerItems.some(item => item.id === itemToMove.id)) {
      setAnswerItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setPoolItems(prev => [...prev, itemToMove]);
    } else {
      setPoolItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setAnswerItems(prev => [...prev, itemToMove]);
    }
  }, [answerItems, feedback.shown, settings]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setAnswerItems((currentItems) => {
        const oldIndex = currentItems.findIndex(({ id }) => id === active.id);
        const newIndex = currentItems.findIndex(({ id }) => id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  }, []);
  
  const handleSubmit = useCallback(() => {
    const isCorrect = answerItems.map(item => item.id).join(',') === correctOrder.join(',');
    setFeedback({ shown: true, correct: isCorrect });
    if (isCorrect) {
      playSound('correct');
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      setTimeout(() => onCorrect(), 1500);
    } else {
      playSound('incorrect');
    }
  }, [answerItems, correctOrder, onCorrect]);

  const handleContinue = useCallback(() => {
    if (feedback.correct) {
      onCorrect();
    } else {
      onComplete();
    }
  }, [feedback.correct, onCorrect, onComplete]);
  
  const bind = useDrag(({ swipe: [, swipeY], event }) => {
    event.stopPropagation();
    if (feedback.shown && swipeY === -1) {
      handleContinue();
    }
  }, { axis: 'y' });

  return (
    <div {...bind()} className="pai-xu-ti-wrapper">
      <style>{ComponentStyles}</style>
      <div className="pai-xu-ti-content-area">
        <div className="pai-xu-ti-title-container">
          <h2 className="pai-xu-ti-title">{title}</h2>
          <button className="pai-xu-ti-title-play-button" onClick={() => settings.playTTS(title, 'zh')}>
            <FaVolumeUp />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
          <div className={`pai-xu-ti-drop-zone ${feedback.shown && !feedback.correct ? 'pai-xu-ti-drop-zone-error' : ''}`}>
            <SortableContext items={answerItems} strategy={rectSortingStrategy}>
              {answerItems.map(item => (
                <SortableCard key={item.id} id={item.id} content={item.text} onClick={() => toggleItemPlacement(item)} />
              ))}
            </SortableContext>
          </div>
          <DragOverlay>
            {activeId && activeItem ? <Card content={activeItem.text} className="pai-xu-ti-drag-overlay" /> : null}
          </DragOverlay>
        </DndContext>

        <div className="pai-xu-ti-word-pool">
          {poolItems.map(item => (
            <Card key={item.id} content={item.text} onClick={() => toggleItemPlacement(item)} />
          ))}
        </div>

        <div className="pai-xu-ti-button-container">
          {!feedback.shown ? (
            <button className="pai-xu-ti-submit-button" onClick={handleSubmit} disabled={answerItems.length === 0}>
              检查答案
            </button>
          ) : (
            feedback.correct ? (
              <div className="pai-xu-ti-feedback-container pai-xu-ti-feedback-correct">
                <FaCheck /> 完全正确！
              </div>
            ) : (
              <div className="pai-xu-ti-feedback-container pai-xu-ti-feedback-incorrect">
                <FaTimes /> 正确答案是不同的哦
              </div>
            )
          )}
        </div>
        
        {feedback.shown && (
          <div className="pai-xu-ti-continue-prompt" onClick={handleContinue}>
             <FaChevronUp className="icon" />
             <span>上滑或点击继续</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaiXuTi;
