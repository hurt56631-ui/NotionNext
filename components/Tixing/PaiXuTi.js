// components/Tixing/PaiXuTiPlus.js
import React, { useState, useMemo, useEffect } from 'react';
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
//import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
//import { CSS } from '@dnd-kit/utilities';
import { useSpring, animated } from '@react-spring/web';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo } from 'react-icons/fa';
//import confetti from 'canvas-confetti';

// ---------- 卡片子组件 ----------
const Card = ({ id, content }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [hovered, setHovered] = useState(false);

  const springStyles = useSpring({
    transform: CSS.Transform.toString(transform),
    scale: isDragging ? 1.07 : hovered ? 1.03 : 1,
    boxShadow: isDragging
      ? '0 20px 40px rgba(59,130,246,0.4)'
      : hovered
      ? '0 10px 20px rgba(59,130,246,0.25)'
      : '0 6px 12px rgba(0,0,0,0.1)',
    config: { tension: 300, friction: 20 },
  });

  return (
    <animated.div
      ref={setNodeRef}
      style={{
        ...springStyles,
        transition,
        zIndex: isDragging ? 100 : 1,
        background: 'linear-gradient(135deg, #ffffffcc, #f9fafbcc)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(255,255,255,0.6)',
        cursor: 'grab',
        userSelect: 'none',
      }}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1e293b' }}>{content}</span>
      <FaVolumeUp style={{ fontSize: '1.3rem', color: '#64748b', cursor: 'pointer' }} />
    </animated.div>
  );
};

// ---------- 主组件 ----------
const PaiXuTiPlus = ({ question, items: initialItems, answer }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const shuffledItems = useMemo(() => {
    if (!initialItems) return [];
    const copy = [...initialItems];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [initialItems]);

  const [items, setItems] = useState(shuffledItems);
  const [feedback, setFeedback] = useState({ shown: false, correct: false });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleSubmit = () => {
    const current = items.map((i) => i.id).join(',');
    const correct = answer.join(',');
    const ok = current === correct;
    setFeedback({ shown: true, correct: ok });
    if (ok) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }
  };

  const handleReset = () => {
    setItems(shuffledItems);
    setFeedback({ shown: false, correct: false });
  };

  if (!isMounted || !initialItems) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        题目加载中...
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #e0f2fe, #fef9c3)',
        borderRadius: '20px',
        padding: '30px',
        maxWidth: '640px',
        margin: '2rem auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        fontFamily: 'sans-serif',
      }}
    >
      <h3
        style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#0f172a',
          marginBottom: '1.8rem',
          textAlign: 'center',
        }}
      >
        {question}
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {items.map((item) => (
              <Card key={item.id} id={item.id} content={item.content} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!feedback.shown ? (
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            marginTop: '1.8rem',
            padding: '14px',
            border: 'none',
            borderRadius: '12px',
            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            color: 'white',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 6px 12px rgba(59,130,246,0.3)',
            transition: 'all 0.2s',
          }}
        >
          提交答案
        </button>
      ) : (
        <>
          <div
            style={{
              marginTop: '1.5rem',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 600,
              textAlign: 'center',
              fontSize: '1.1rem',
              background: feedback.correct ? '#dcfce7' : '#fee2e2',
              color: feedback.correct ? '#166534' : '#991b1b',
            }}
          >
            {feedback.correct ? (
              <>
                <FaCheck /> 完全正确，太棒啦！
              </>
            ) : (
              <>
                <FaTimes /> 顺序不对，再试试~
              </>
            )}
          </div>
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              marginTop: '1rem',
              padding: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              background: '#f8fafc',
              fontSize: '1rem',
              fontWeight: 500,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            <FaRedo /> 再做一次
          </button>
        </>
      )}
    </div>
  );
};

export default PaiXuTiPlus;
