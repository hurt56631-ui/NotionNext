import React, { useState, useCallback, useEffect, useRef } from 'react';
import { pinyin } from 'pinyin-pro';

// Dnd-kit and related libraries
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sound and Icons
import { Howl } from 'howler';
import { FaGripVertical, FaCheckCircle, FaTimesCircle, FaVolumeUp, FaSpinner } from 'react-icons/fa';

// --- 音效管理器 (与之前版本相同) ---
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

// --- 子组件：列表项的UI模板 (集成TTS按钮) ---
const ItemTemplate = ({ item, attributes, listeners, isOverlay = false, isPlaying, onPlaySound }) => {
  const shadow = isOverlay ? 'shadow-2xl scale-105' : 'shadow-md';

  return (
    <div className={`flex items-center bg-white p-4 my-2 rounded-lg ${shadow} border border-gray-200 transition-all`}>
      {/* 拖拽把手 */}
      <div {...attributes} {...listeners} className="cursor-grab p-2 text-gray-500 hover:text-gray-800 touch-none">
        <FaGripVertical size={20} />
      </div>

      {/* 文本内容 */}
      <div className="flex-grow ml-4">
        <div className="text-sm text-gray-500 select-none">{item.pinyin}</div>
        <div className="text-2xl text-gray-800">{item.text}</div>
      </div>

      {/* 朗读按钮 */}
      <button onClick={onPlaySound} className="p-3 text-gray-600 hover:text-blue-600 rounded-full hover:bg-gray-100 transition-colors">
        {isPlaying ? (
          <FaSpinner className="animate-spin" size={20} />
        ) : (
          <FaVolumeUp size={20} />
        )}
      </button>
    </div>
  );
};

// --- 子组件：可排序项 ---
const SortableItem = React.memo(({ id, item, isDragging, isPlaying, onPlaySound }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ItemTemplate 
        item={item} 
        attributes={attributes} 
        listeners={listeners} 
        isPlaying={isPlaying}
        onPlaySound={onPlaySound}
      />
    </div>
  );
});


// --- 主组件：PaiXuTi (TTS 朗读版) ---
function PaiXuTi({ question, initialItems = [], correctOrder }) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [playingId, setPlayingId] = useState(null); // 追踪正在朗读的 item ID

  const audioRef = useRef(new Audio()); // 使用 useRef 来持久化 Audio 对象

  // 动态生成拼音
  useEffect(() => {
    const itemsWithPinyin = initialItems.map(item => ({
      ...item,
      pinyin: pinyin(item.text, { toneType: 'symbol' }),
    }));
    setItems(itemsWithPinyin);
  }, [initialItems]);

  // TTS 朗读处理函数
  const handlePlaySound = useCallback(async (item) => {
    const currentAudio = audioRef.current;
    
    // 如果点击的是正在播放的项，则停止播放
    if (playingId === item.id && !currentAudio.paused) {
        currentAudio.pause();
        setPlayingId(null);
        return;
    }

    // 停止任何可能正在播放的音频
    if (!currentAudio.paused) {
        currentAudio.pause();
    }
    
    setPlayingId(item.id); // 设置加载状态

    try {
        const { baseUrl, voice, rate, pitch } = ttsApiConfig;
        const encodedText = encodeURIComponent(item.text);
        const url = `${baseUrl}?t=${encodedText}&v=${voice}&r=${rate}&p=${pitch}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error status: ${response.status}`);
        
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        
        currentAudio.src = audioUrl;
        currentAudio.play();
        
        currentAudio.onended = () => setPlayingId(null);
        currentAudio.onerror = () => {
            console.error("Audio playback error.");
            setPlayingId(null);
        };

    } catch (error) {
        console.error("Failed to fetch TTS audio:", error);
        alert('朗读失败，请检查网络或稍后再试。');
        setPlayingId(null); // 出错时重置状态
    }
  }, [playingId]);


  const sensors = useSensors(
    useSensor(PointerSensor),
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

  const checkAnswer = () => {
    const currentOrder = items.map(item => item.id);
    if (JSON.stringify(currentOrder) === JSON.stringify(correctOrder)) {
      setStatus('correct');
      soundManager.correct.play();
    } else {
      setStatus('wrong');
      soundManager.wrong.play();
    }
  };
  
  const reset = () => {
    const itemsWithPinyin = initialItems.map(item => ({
      ...item,
      pinyin: pinyin(item.text, { toneType: 'symbol' }),
    }));
    setItems(itemsWithPinyin);
    setStatus('pending');
  };

  const activeItem = items.find(item => item.id === activeId);
  const cardBorderColor = {
    pending: 'border-gray-200',
    correct: 'border-green-500',
    wrong: 'border-red-500',
  }[status];

  return (
    <div className={`max-w-md mx-auto my-8 p-6 bg-slate-50 rounded-xl shadow-lg border-2 ${cardBorderColor} transition-colors duration-300`}>
      <h3 className="text-xl font-bold text-gray-900 mb-4">{question}</h3>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem 
                key={item.id} 
                id={item.id} 
                item={item} 
                isDragging={activeId === item.id}
                isPlaying={playingId === item.id}
                onPlaySound={() => handlePlaySound(item)}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeId ? <ItemTemplate item={activeItem} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-6 flex justify-between">
        <button onClick={reset} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors">重置</button>
        <button onClick={checkAnswer} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors">检查答案</button>
      </div>

      {status === 'correct' && <div className="mt-4 flex items-center text-green-600"><FaCheckCircle className="mr-2" /><span>太棒了，排序完全正确！</span></div>}
      {status === 'wrong' && <div className="mt-4 flex items-center text-red-600"><FaTimesCircle className="mr-2" /><span>再试一次吧，顺序好像不对哦。</span></div>}
    </div>
  );
}

export default PaiXuTi;
