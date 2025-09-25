// /components/Tixing/PaiXuTi.js

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { pinyin } from 'pinyin-pro';

// 拖拽库
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 其他库
import { useSpring, animated } from '@react-spring/web'; // 动画
import { Howl } from 'howler'; // 音效
import { FaGripVertical, FaCheckCircle, FaTimesCircle, FaVolumeUp, FaSpinner, FaRedo } from 'react-icons/fa'; // 图标

// --- 静态配置 ---

// 音效管理器：预加载所有音效，方便全局调用
const soundManager = {
  dragStart: new Howl({ src: ['/sounds/drag-start.mp3'], volume: 0.5 }),
  dragEnd: new Howl({ src: ['/sounds/drag-end.mp3'], volume: 0.5 }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }),
  wrong: new Howl({ src: ['/sounds/wrong.mp3'], volume: 0.7 }),
};

// TTS 文本转语音 API 配置
const TTS_API_CONFIG = {
    BASE_URL: 'https://t.leftsite.cn/tts',
    VOICE: 'zh-CN-XiaochenMultilingualNeural',
    RATE: '-20',
    PITCH: '0',
};

// --- 子组件：可排序的卡片 ---

/**
 * 渲染单个可拖拽、带动画的卡片项。
 * 使用 React.memo 进行性能优化，只有在 props 变化时才重新渲染。
 */
const SortableItem = React.memo(({ id, pinyin, content, isPlaying, onPlaySound }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [isHovered, setIsHovered] = useState(false);

  // 使用 react-spring 创建流畅的物理动画
  const springProps = useSpring({
    scale: isDragging ? 1.05 : isHovered ? 1.02 : 1,
    boxShadow: isDragging
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    config: { tension: 300, friction: 20 },
  });
  
  // dnd-kit 所需的 transform 和 transition 样式
  const dndStyles = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <animated.div
      ref={setNodeRef}
      style={{ ...dndStyles, ...springProps }}
      className="relative flex items-center bg-white/70 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-lg touch-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 拖拽手柄 */}
      <div {...attributes} {...listeners} className="cursor-grab p-2 text-slate-500 hover:text-slate-800" aria-label="拖动手柄">
        <FaGripVertical size={20} />
      </div>

      {/* 内容区 */}
      <div className="flex-grow ml-3">
        <p className="text-sm text-slate-500 select-none">{pinyin}</p>
        <p className="text-xl font-semibold text-slate-800">{content}</p>
      </div>

      {/* 播放按钮 */}
      <button 
        onClick={onPlaySound} 
        aria-label={`朗读 ${content}`}
        className="p-3 text-slate-600 hover:text-blue-600 rounded-full hover:bg-slate-100/50 transition-colors"
      >
        {isPlaying ? <FaSpinner className="animate-spin" size={20} /> : <FaVolumeUp size={20} />}
      </button>
    </animated.div>
  );
});

// --- 主组件：排序题 ---

/**
 * 一个功能完整的排序题组件
 * @param {object} props
 * @param {string} props.question - 题目问题
 * @param {Array<{id: string|number, content: string}>} props.items - 待排序的选项数组
 * @param {Array<string|number>} props.answer - 正确顺序的 ID 数组
 */
function PaiXuTi({ question, items: initialItems = [], answer: correctOrder = [] }) {
  // 使用 useMemo 仅在组件首次加载时计算初始乱序状态，避免不必要的重复计算
  const initialShuffledItems = useMemo(() => {
    const itemsWithPinyin = initialItems.map(item => ({
      ...item,
      pinyin: pinyin(item.content, { toneType: 'symbol' }),
    }));
    return [...itemsWithPinyin].sort(() => Math.random() - 0.5);
  }, [initialItems]);

  // --- State 管理 ---
  const [items, setItems] = useState(initialShuffledItems);
  const [activeId, setActiveId] = useState(null); // 当前正在拖拽的项的 ID
  const [status, setStatus] = useState('pending'); // 答题状态: 'pending', 'correct', 'wrong'
  const [playingId, setPlayingId] = useState(null); // 正在朗读的项的 ID
  const audioRef = useRef(null); // 使用 Ref 持久化 Audio 对象实例

  // --- 音频播放逻辑 ---
  const handlePlaySound = useCallback(async (item) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const currentAudio = audioRef.current;
    if (playingId === item.id && !currentAudio.paused) {
      currentAudio.pause();
      setPlayingId(null);
      return;
    }
    if (!currentAudio.paused) currentAudio.pause();

    setPlayingId(item.id);
    try {
        const { BASE_URL, VOICE, RATE, PITCH } = TTS_API_CONFIG;
        const url = `${BASE_URL}?t=${encodeURIComponent(item.content)}&v=${VOICE}&r=${RATE}&p=${PITCH}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API 请求失败，状态码: ${response.status}`);
        const blob = await response.blob();
        currentAudio.src = URL.createObjectURL(blob);
        await currentAudio.play();
    } catch (error) {
        console.error("朗读失败:", error);
        alert('朗读失败，请稍后再试。');
        setPlayingId(null);
    }
  }, [playingId]);
  
  // 附加事件监听器，并在组件卸载时清理
  useEffect(() => {
    const currentAudio = audioRef.current;
    if (currentAudio) {
      const onEnded = () => setPlayingId(null);
      const onError = () => { console.error("音频播放出错。"); setPlayingId(null); };
      currentAudio.addEventListener('ended', onEnded);
      currentAudio.addEventListener('error', onError);

      return () => {
        currentAudio.removeEventListener('ended', onEnded);
        currentAudio.removeEventListener('error', onError);
        currentAudio.pause();
        currentAudio.src = '';
      };
    }
  }, []);

  // --- 拖拽逻辑 ---
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
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        return arrayMove(currentItems, oldIndex, newIndex);
      });
      soundManager.dragEnd.play();
    }
    setActiveId(null);
  }, []);
  
  // --- 答题逻辑 ---
  const checkAnswer = () => {
    const currentOrderIds = items.map(item => item.id);
    if (JSON.stringify(currentOrderIds) === JSON.stringify(correctOrder)) {
      setStatus('correct');
      soundManager.correct.play();
    } else {
      setStatus('wrong');
      soundManager.wrong.play();
    }
  };

  const reset = () => {
    setItems(initialShuffledItems);
    setStatus('pending');
  };

  // 记忆化当前拖拽的项，避免不必要的重渲染
  const activeItem = useMemo(() => items.find(item => item.id === activeId), [items, activeId]);

  // --- 渲染 ---
  return (
    <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-blue-100 rounded-2xl shadow-xl font-sans">
      <h3 className="text-2xl font-bold text-slate-800 mb-6 text-center">{question}</h3>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map(item => (
              <SortableItem 
                key={item.id} 
                {...item} 
                isPlaying={playingId === item.id} 
                onPlaySound={() => handlePlaySound(item)} 
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId && activeItem ? <SortableItem {...activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-8">
        {status === 'pending' && (
          <button 
            onClick={checkAnswer} 
            className="w-full py-3 px-4 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-200"
          >
            检查答案
          </button>
        )}
        {status === 'correct' && (
          <div className="text-center p-4 bg-green-100 text-green-800 rounded-xl font-semibold flex items-center justify-center">
            <FaCheckCircle className="inline mr-2" /> 太棒了，完全正确！
          </div>
        )}
        {status === 'wrong' && (
          <div className="text-center p-4 bg-red-100 text-red-800 rounded-xl font-semibold flex items-center justify-center">
            <FaTimesCircle className="inline mr-2" /> 顺序不对哦，再试一次吧！
          </div>
        )}
        {(status === 'correct' || status === 'wrong') && (
           <button 
             onClick={reset} 
             className="w-full mt-4 py-3 px-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors flex items-center justify-center"
           >
             <FaRedo className="inline mr-2" /> 再做一次
           </button>
        )}
      </div>
    </div>
  );
}

export default PaiXuTi;
