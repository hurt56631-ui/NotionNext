// /components/Tixing/PaiXuTi.js
import React, 'react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';

// 拖拽核心
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 动画库、音效库、图标库
import { useSpring, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaGripVertical, FaCheckCircle, FaTimesCircle, FaVolumeUp, FaSpinner, FaRedo } from 'react-icons/fa';

// --- 音效管理器 ---
const soundManager = {
  dragStart: new Howl({ src: ['/sounds/drag-start.mp3'], volume: 0.5 }),
  dragEnd: new Howl({ src: ['/sounds/drag-end.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }),
  wrong: new Howl({ src: ['/sounds/wrong.mp3'], volume: 0.7 }),
};

// --- TTS 朗读功能核心 ---
const ttsApiConfig = {
    baseUrl: 'https://t.leftsite.cn/tts',
    voice: 'zh-CN-XiaochenMultilingualNeural',
    rate: '-20%',
    pitch: '0%',
};

// --- 子组件：带动画的卡片模板 ---
const SortableCard = ({ id, pinyin, content, isPlaying, onPlaySound }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [hovered, setHovered] = useState(false);

  const springStyles = useSpring({
    scale: isDragging ? 1.05 : hovered ? 1.02 : 1,
    boxShadow: isDragging
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      : hovered
      ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    config: { tension: 300, friction: 20 },
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <animated.div ref={setNodeRef} style={{...style, ...springStyles}} {...attributes} {...listeners}
      className={`relative flex items-center bg-white/70 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-lg`}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    >
      <div className="cursor-grab p-2 text-slate-500 hover:text-slate-800 touch-none">
        <FaGripVertical size={20} />
      </div>
      <div className="flex-grow ml-3">
        <div className="text-sm text-slate-500 select-none">{pinyin}</div>
        <div className="text-xl font-semibold text-slate-800">{content}</div>
      </div>
      <button onClick={onPlaySound} className="p-3 text-slate-600 hover:text-blue-600 rounded-full hover:bg-slate-100/50 transition-colors">
        {isPlaying ? <FaSpinner className="animate-spin" size={20} /> : <FaVolumeUp size={20} />}
      </button>
    </animated.div>
  );
};


// --- 主组件：PaiXuTi ---
// 接收你指定的 props: question, items, answer
function PaiXuTi({ question, items: initialItems = [], answer: correctOrder = [] }) {
  // 仅在组件首次加载时执行一次乱序
  const shuffledItems = useMemo(() => {
    const itemsWithPinyin = initialItems.map(item => ({
      ...item,
      pinyin: pinyin(item.content, { toneType: 'symbol' }),
    }));
    return [...itemsWithPinyin].sort(() => Math.random() - 0.5);
  }, [initialItems]);
  
  const [items, setItems] = useState(shuffledItems);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(new Audio());

  const handlePlaySound = useCallback(async (item) => {
    const currentAudio = audioRef.current;
    if (playingId === item.id && !currentAudio.paused) {
        currentAudio.pause(); setPlayingId(null); return;
    }
    if (!currentAudio.paused) currentAudio.pause();
    setPlayingId(item.id);
    try {
        const url = `${ttsApiConfig.baseUrl}?t=${encodeURIComponent(item.content)}&v=${ttsApiConfig.voice}&r=${ttsApiConfig.rate}&p=${ttsApiConfig.pitch}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error`);
        const blob = await response.blob();
        currentAudio.src = URL.createObjectURL(blob);
        await currentAudio.play();
        currentAudio.onended = () => setPlayingId(null);
        currentAudio.onerror = () => setPlayingId(null);
    } catch (error) {
        alert('朗读失败，请稍后再试。');
        setPlayingId(null);
    }
  }, [playingId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
    soundManager.dragStart.play();
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((current) => {
        const oldIndex = current.findIndex((item) => item.id === active.id);
        const newIndex = current.findIndex((item) => item.id === over.id);
        return arrayMove(current, oldIndex, newIndex);
      });
      soundManager.dragEnd.play();
    }
    setActiveId(null);
  }, []);

  const checkAnswer = () => {
    const currentIds = items.map(item => item.id);
    if (JSON.stringify(currentIds) === JSON.stringify(correctOrder)) {
      setStatus('correct');
      soundManager.correct.play();
    } else {
      setStatus('wrong');
      soundManager.wrong.play();
    }
  };
  
  const reset = () => {
    setItems(shuffledItems);
    setStatus('pending');
  };

  const activeItem = items.find(item => item.id === activeId);
  
  return (
    <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-blue-100 rounded-2xl shadow-xl font-sans">
      <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">{question}</h3>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map(item => (
              <SortableCard key={item.id} {...item} isPlaying={playingId === item.id} onPlaySound={() => handlePlaySound(item)} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? <SortableCard {...activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-8">
        {status === 'pending' && (
          <button onClick={checkAnswer} className="w-full py-3 px-4 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-200">检查答案</button>
        )}
        {status === 'correct' && (
          <div className="text-center p-4 bg-green-100 text-green-800 rounded-xl font-semibold">
            <FaCheckCircle className="inline mr-2" /> 太棒了，完全正确！
          </div>
        )}
        {status === 'wrong' && (
          <div className="text-center p-4 bg-red-100 text-red-800 rounded-xl font-semibold">
            <FaTimesCircle className="inline mr-2" /> 顺序不对哦，再试一次吧！
          </div>
        )}
        {(status === 'correct' || status === 'wrong') && (
           <button onClick={reset} className="w-full mt-4 py-3 px-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors">
             <FaRedo className="inline mr-2" /> 再做一次
           </button>
        )}
      </div>
    </div>
  );
}

export default PaiXuTi;
