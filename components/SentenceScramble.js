// components/SentenceScramble.js

import React, { useState, useEffect } from 'react'; // 引入 useEffect
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

// 单个可拖拽词语的组件 (无需修改)
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
    touchAction: 'none',
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
  // 关键修复：添加 prop 校验和安全的初始值
  const getInitialItems = () => {
    if (typeof scrambledSentence === 'string' && scrambledSentence.length > 0) {
      return scrambledSentence.split(' ');
    }
    return []; // 如果 prop 有问题，返回一个空数组，避免崩溃
  };

  const [words, setWords] = useState(getInitialItems());
  const [isCorrect, setIsCorrect] = useState(null);

  // 当 scrambledSentence prop 变化时，重置组件状态
  useEffect(() => {
    setWords(getInitialItems());
    setIsCorrect(null);
  }, [scrambledSentence]);


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
      setIsCorrect(null);
    }
  }

  function checkAnswer() {
    // 同样在这里添加校验
    if (typeof correctSentence === 'string') {
        const currentSentence = words.join(' ');
        setIsCorrect(currentSentence === correctSentence);
    } else {
        console.error("`correctSentence` prop is missing or not a string.");
    }
  }

  function reset() {
    setWords(getInitialItems());
    setIsCorrect(null);
  }
  
  // 如果初始数据为空，显示错误提示
  if (words.length === 0) {
      return (
          <div style={{ padding: '2rem', border: '2px dashed #e53e3e', borderRadius: '1rem', margin: '2rem auto', maxWidth: '90%', textAlign: 'center' }}>
              <p style={{ color: '#e53e3e', fontWeight: 'bold' }}>句子排序组件加载失败！</p>
              <p style={{ color: '#718096' }}>请检查 Notion 中的 `!include` 代码块，确保 `scrambledSentence` 属性已正确提供。</p>
          </div>
      )
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
