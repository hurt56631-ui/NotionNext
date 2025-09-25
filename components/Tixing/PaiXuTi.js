// components/Tixing/PaiXuTi.js

import React, { useState, useMemo } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { VscKebabVertical } from 'react-icons/vsc';

// --- 样式定义 ---
// 将所有样式内联，避免额外的 CSS 文件
const styles = {
  paiXuTiContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 8px 32px 0 rgba( 31, 38, 135, 0.1 )',
    backdropFilter: 'blur( 4px )',
    border: '1px solid rgba( 255, 255, 255, 0.18 )',
    fontFamily: 'sans-serif',
    marginBottom: '2rem',
  },
  questionTitle: {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#343a40',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  paiXuKaPian: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.07)',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'grab',
    position: 'relative',
    border: '1px solid #dee2e6',
    touchAction: 'none', // 优化移动端手势
  },
  cardContent: {
    fontSize: '1.1rem',
    color: '#495057',
    fontWeight: '500',
  },
  dragHandle: {
    fontSize: '1.5rem',
    color: '#adb5bd',
    display: 'flex',
    alignItems: 'center',
  },
  feedback: {
    marginTop: '1.5rem',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
    fontWeight: '500',
    fontSize: '1rem',
  },
  feedbackCorrect: {
    backgroundColor: '#d1e7dd',
    color: '#0f5132',
  },
  feedbackIncorrect: {
    backgroundColor: '#f8d7da',
    color: '#842029',
  }
};


// --- 音效管理器 ---
// 提示: 你需要在 public 目录下创建 sounds 文件夹，并放入音效文件
// 如果没有音效文件，组件也能正常工作，只是没有声音
let soundDrag, soundDrop;
if (typeof window !== 'undefined') {
  soundDrag = new Howl({ src: ['/sounds/drag.mp3'], volume: 0.5 });
  soundDrop = new Howl({ src: ['/sounds/drop.mp3'], volume: 0.5 });
}

const playSound = (sound) => {
  if (sound && sound.play) {
    sound.play();
  }
};


// --- 内部子组件：排序卡片 (PaiXuKaPian) ---
const PaiXuKaPian = ({ id, content }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const springStyles = useSpring({
    transform: CSS.Transform.toString(transform),
    boxShadow: isDragging ? '0 10px 15px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.07)',
    scale: isDragging ? 1.05 : 1,
    config: { tension: 300, friction: 20 },
  });
  
  const style = {
    ...styles.paiXuKaPian,
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <animated.div ref={setNodeRef} style={{ ...style, ...springStyles }} {...attributes}>
      <span style={styles.cardContent}>{content}</span>
      <div style={styles.dragHandle} {...listeners}>
        <VscKebabVertical />
      </div>
    </animated.div>
  );
};


// --- 主组件：排序题 (PaiXuTi) ---
const PaiXuTi = ({ question, items: initialItems, answer }) => {
  // 用 useMemo 来确保初始选项只在初次渲染时被打乱一次
  const shuffledItems = useMemo(() => {
    // 创建一个副本进行打乱，避免影响原始 props
    const itemsCopy = [...initialItems];
    // 简单的 Fisher-Yates 随机排序算法
    for (let i = itemsCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsCopy[i], itemsCopy[j]] = [itemsCopy[j], itemsCopy[i]];
    }
    return itemsCopy;
  }, [initialItems]);

  const [items, setItems] = useState(shuffledItems);
  const [isCorrect, setIsCorrect] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = () => {
    playSound(soundDrag);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      
      setItems(newOrder);
      playSound(soundDrop);

      // 检查答案
      const currentAnswer = newOrder.map((item) => item.id).join(',');
      const correctAnswer = answer.join(',');
      setIsCorrect(currentAnswer === correctAnswer);
    }
  };

  return (
    <div style={styles.paiXuTiContainer}>
      <h3 style={styles.questionTitle}>{question}</h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div style={styles.cardList}>
            {items.map((item) => (
              <PaiXuKaPian key={item.id} id={item.id} content={item.content} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {isCorrect !== null && (
        <div style={{
          ...styles.feedback, 
          ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) 
        }}>
          {isCorrect ? '太棒了，顺序完全正确！' : '顺序不对哦，再试一次吧！'}
        </div>
      )}
    </div>
  );
};

export default PaiXuTi;
