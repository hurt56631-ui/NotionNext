// components/SentenceScramble.js

import React, { useState } from 'react';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 单个可拖拽词语的组件
function SortableWord({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: '12px 20px',
    margin: '5px',
    backgroundColor: isDragging ? '#d3e3fd' : 'white',
    border: '2px solid #3182ce',
    borderRadius: '10px',
    cursor: 'grab',
    touchAction: 'none', // 优化移动端触摸体验
    boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.2)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    zIndex: isDragging ? 100 : 'auto',
    fontWeight: '500',
    fontSize: '1.2rem',
    color: '#2d3748',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// 主组件：句子排序练习
const SentenceScramble = ({ scrambledSentence, correctSentence }) => {
  const initialItems = scrambledSentence.split(' ');
  const [words, setWords] = useState(initialItems);
  const [isCorrect, setIsCorrect] = useState(null); // null, true, or false

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setWords((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // 每次拖动后都清除上一次的检查结果
      setIsCorrect(null);
    }
  }

  function checkAnswer() {
    const currentSentence = words.join(' ');
    if (currentSentence === correctSentence) {
      setIsCorrect(true);
    } else {
      setIsCorrect(false);
    }
  }

  function reset() {
    setWords(initialItems);
    setIsCorrect(null);
  }

  return (
    <div style={{
      padding: '2rem',
      border: '1px solid #e2e8f0',
      borderRadius: '1rem',
      margin: '2rem auto',
      maxWidth: '90%',
      backgroundColor: '#f7fafc',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      textAlign: 'center'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#2d3748', fontSize: '1.5rem' }}>句子排序练习</h3>
      <p style={{ color: '#718096', marginBottom: '2rem' }}>请拖拽下方的词语，组成一个正确的句子。</p>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={words} strategy={rectSortingStrategy}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80px',
            backgroundColor: '#edf2f7',
            borderRadius: '10px',
            padding: '10px',
            marginBottom: '2rem'
          }}>
            {words.map(word => <SortableWord key={word} id={word}>{word}</SortableWord>)}
          </div>
        </SortableContext>
      </DndContext>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={checkAnswer} style={{...buttonStyle, backgroundColor: '#3182ce'}}>✅ 检查答案</button>
        <button onClick={reset} style={{...buttonStyle, backgroundColor: '#718096'}}>🔄 重置</button>
      </div>

      {isCorrect === true && <p style={{ color: '#38a169', fontWeight: 'bold', fontSize: '1.2rem' }}>太棒了，完全正确！</p>}
      {isCorrect === false && <p style={{ color: '#e53e3e', fontWeight: 'bold', fontSize: '1.2rem' }}>不对哦，再试一次吧！</p>}

    </div>
  );
};

// 按钮样式
const buttonStyle = {
  padding: '0.6rem 1.2rem',
  fontSize: '1rem',
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: '500',
  transition: 'background-color 0.2s',
};


export default SentenceScramble;
