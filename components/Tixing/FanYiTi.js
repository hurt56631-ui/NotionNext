// components/Tixing/FanYiTi.js

import React, { useState, useMemo, useEffect, useCallback, forwardRef } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Howl } from 'howler';
import { FaVolumeUp, FaCheck, FaTimes, FaRedo, FaLightbulb, FaEye, FaEyeSlash } from 'react-icons/fa';
import confetti from 'canvas-confetti';
import { pinyin } from 'pinyin-pro';

// --- 样式定义 ---
// 🎨 [优化] 添加了CSS动画和响应式媒体查询
const keyColors = [ { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' }, { bg: '#ffedd5', border: '#fdba74', text: '#9a3412' }, { bg: '#fef9c3', border: '#fde047', text: '#854d0e' }, { bg: '#dcfce7', border: '#86efac', text: '#166534' }, { bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e' }, { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' }, { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' }, ];

const styles = {
  // ... (容器、标题等样式保持不变)
  container: { backgroundColor: '#f0f4f8', borderRadius: '24px', padding: '24px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)', fontFamily: 'sans-serif', maxWidth: '600px', margin: '2rem auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { fontSize: '1.4rem', fontWeight: '600', color: '#475569', textAlign: 'center', margin: '0 0 16px 0' },
  sourceSentenceBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#e2e8f0', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '12px' },
  sourceSentenceText: { fontSize: '1.3rem', fontWeight: '500', color: '#1e293b', flex: 1 },
  playButton: { cursor: 'pointer', color: '#64748b', fontSize: '1.5rem', display: 'flex', alignItems: 'center', marginLeft: '12px', transition: 'color 0.2s' },
  answerArea: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#cbd5e1', borderRadius: '12px', border: '2px solid #94a3b8', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)', transition: 'border-color 0.3s ease' },
  answerAreaError: { borderColor: '#ef4444' },
  wordPool: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', padding: '12px', minHeight: '60px', backgroundColor: '#e2e8f0', borderRadius: '12px' },
  card: { touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '40px', padding: '6px 14px', borderRadius: '10px', border: '1px solid #94a3b8', borderBottomWidth: '4px', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.3s ease', whiteSpace: 'nowrap' },
  cardActive: { transform: 'translateY(2px)', borderBottomWidth: '2px' },
  pinyin: { fontSize: '0.8rem', color: 'inherit', opacity: 0.7, height: '1.2em', lineHeight: '1.2em', transition: 'opacity 0.3s' },
  content: { fontSize: '1.3rem', fontWeight: '500', color: 'inherit', lineHeight: '1.5em' },
  dragOverlay: { transform: 'scale(1.1) rotate(-5deg)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)', cursor: 'grabbing' },
  draggingSource: { opacity: 0.5, transform: 'scale(0.95)' },
  buttonContainer: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  // 🎨 [优化] 按钮悬停效果
  submitButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s ease, transform 0.1s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  feedback: { padding: '14px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', animation: 'fadeIn 0.5s ease' },
  feedbackCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
  feedbackIncorrect: { backgroundColor: '#fee2e2', color: '#991b1b' },
  explanationBox: { backgroundColor: '#fffbeb', color: '#b45309', padding: '16px', borderRadius: '10px', border: '1px solid #fcd34d', marginTop: '12px', textAlign: 'left', fontSize: '1rem', lineHeight: '1.7', animation: 'fadeIn 0.5s ease' },
  // 🧠 [新增] 顶部工具栏样式
  toolbar: { display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '-8px' },
  toolButton: { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '8px', transition: 'background-color 0.2s, color 0.2s' },
  hintHighlight: { animation: 'blink 0.6s 2' } // 🎨 [新增] 提示高亮动画
};

// --- 音频与TTS ---
// ⚙️ [优化] 统一管理音效实例
let sounds = {};
if (typeof window !== 'undefined') {
  sounds = {
    click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }),
    correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.7 }),
    incorrect: new Howl({ src: ['/sounds/incorrect.mp3'], volume: 0.7 }),
  };
}
const playSound = (name) => sounds[name]?.play();

const ttsVoices = { zh: 'zh-CN-XiaoyouNeural', en: 'en-US-JennyNeural', my: 'my-MM-Nilar' };
const ttsCache = new Map();

// ⚙️ [优化] TTS 缓存逻辑，自动释放内存
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
    const audioSrc = URL.createObjectURL(blob);
    const audio = new Audio(audioSrc);
    // 核心优化：播放结束后自动释放Blob URL占用的内存
    audio.onended = () => URL.revokeObjectURL(audioSrc);
    ttsCache.set(cacheKey, audio);
  } catch (error) { console.error(`预加载 "${text}" (${lang}) 失败:`, error); }
};

const playCachedTTS = (text, lang) => {
  const cacheKey = `${lang}:${text}`;
  const cachedAudio = ttsCache.get(cacheKey);
  if (cachedAudio) {
    cachedAudio.currentTime = 0; // 确保从头播放
    cachedAudio.play();
  } else {
    preloadTTS(text, lang).then(() => {
      ttsCache.get(cacheKey)?.play();
    });
  }
};


// --- ⚙️ [优化] 卡片组件抽离 (Card.js) ---
const Card = forwardRef(({ id, content, pinyinContent, color, lang, showPinyin, isHinted, ...props }, ref) => {
  const [isActive, setIsActive] = useState(false);
  
  const cardStyle = {
    ...styles.card,
    backgroundColor: color.bg,
    borderColor: color.border,
    color: color.text,
    ...(isActive ? styles.cardActive : {}),
    ...(isHinted ? styles.hintHighlight : {}) // 🧠 应用提示高亮
  };
  
  const handlePointerDown = () => setIsActive(true);
  const handlePointerUp = () => setIsActive(false);
  
  const handleClick = () => {
    if (props.onClick) props.onClick();
    playCachedTTS(content, lang);
  };
  
  return (
    <div ref={ref} {...props} style={cardStyle} onClick={handleClick} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div style={{ ...styles.pinyin, opacity: showPinyin ? 0.7 : 0 }}>
        {pinyinContent || ' '}
      </div>
      <div style={styles.content}>{content}</div>
    </div>
  );
});
Card.displayName = 'Card';


const SortableCard = ({ item, showPinyin, isHinted, lang, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
    ...(isDragging ? styles.draggingSource : {})
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        id={item.id}
        content={item.content}
        pinyinContent={item.pinyin}
        color={item.color}
        lang={lang}
        showPinyin={showPinyin}
        isHinted={isHinted}
        onClick={onClick}
        {...attributes}
        {...listeners}
      />
    </div>
  );
};


// --- 主组件 ---
const FanYiTi = ({ title, sourceSentence, wordBlocks: initialItems, correctOrder, explanation, sourceLang = 'en', targetLang = 'zh', onCorrect }) => {
  const [answerItems, setAnswerItems] = useState([]);
  const [poolItems, setPoolItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  // 🧠 [新增] 教学体验状态
  const [showPinyin, setShowPinyin] = useState(true);
  const [hintedWordId, setHintedWordId] = useState(null);

  // 预处理数据，添加颜色和拼音
  const itemsWithData = useMemo(() => {
    if (!initialItems) return [];
    return initialItems.map((item, index) => ({
      ...item,
      color: keyColors[index % keyColors.length],
      pinyin: targetLang === 'zh' ? pinyin(item.content, { toneType: 'mark' }).toLowerCase() : ''
    }));
  }, [initialItems, targetLang]);
  
  const shuffledItems = useMemo(() => [...itemsWithData].sort(() => Math.random() - 0.5), [itemsWithData]);

  // 初始化和重置逻辑
  const resetState = useCallback(() => {
    setPoolItems(shuffledItems);
    setAnswerItems([]);
    setIsSubmitted(false);
    setIsCorrect(false);
    setHintedWordId(null);
  }, [shuffledItems]);

  useEffect(() => {
    if (itemsWithData.length > 0) {
      resetState();
      // 预加载所有音频
      if (sourceSentence) preloadTTS(sourceSentence, sourceLang);
      itemsWithData.forEach(item => preloadTTS(item.content, targetLang));
    }
  }, [itemsWithData, sourceSentence, sourceLang, targetLang, resetState]);


  // 拖拽逻辑
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
  
  // 点击卡片逻辑
  const toggleItemPlacement = useCallback((itemToMove) => {
    playSound('click');
    setHintedWordId(null); // 任何操作都取消提示
    if (answerItems.some(item => item.id === itemToMove.id)) {
      setAnswerItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setPoolItems(prev => [...prev, itemToMove]);
    } else {
      setPoolItems(prev => prev.filter(item => item.id !== itemToMove.id));
      setAnswerItems(prev => [...prev, itemToMove]);
    }
  }, [answerItems]);
  
  // 提交答案
  const handleSubmit = useCallback(() => {
    const isAnswerCorrect = answerItems.map(item => item.id).join(',') === correctOrder.join(',');
    setIsCorrect(isAnswerCorrect);
    setIsSubmitted(true);
    playSound(isAnswerCorrect ? 'correct' : 'incorrect');
    if (isAnswerCorrect) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      // 🧠 [新增] 答对后自动朗读全句
      const fullSentence = answerItems.map(i => i.content).join('');
      setTimeout(() => playCachedTTS(fullSentence, targetLang), 500);
      // 🧩 [新增] 触发外部进度回调
      if (onCorrect) onCorrect();
    }
  }, [answerItems, correctOrder, targetLang, onCorrect]);
  
  // 🧠 [新增] 显示提示
  const showHint = () => {
    const nextCorrectWordId = correctOrder[answerItems.length];
    if (nextCorrectWordId) {
      setHintedWordId(nextCorrectWordId);
      setTimeout(() => setHintedWordId(null), 1200); // 提示高亮1.2秒
    }
  };
  
  const activeItem = useMemo(() => itemsWithData.find(item => item.id === activeId), [activeId, itemsWithData]);

  if (!initialItems) return null;

  return (
    <>
      {/* 🎨 [新增] 动态添加CSS动画和响应式样式 */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 50% { border-color: #f59e0b; box-shadow: 0 0 12px #fde047; } }
        .submit-btn:hover { background-color: #2563eb !important; }
        .submit-btn:active { transform: scale(0.98); }
        .tool-btn:hover { background-color: #e2e8f0; color: #1e293b; }
        .play-btn:hover { color: #1e293b; }
        /* 📱 [优化] 移动端响应式 */
        @media (max-width: 480px) {
          .fyt-card-content { font-size: 1.1rem !important; }
          .fyt-card-pinyin { font-size: 0.7rem !important; }
          .fyt-card { padding: 4px 10px !important; }
          .fyt-source-text { font-size: 1.1rem !important; }
          .fyt-container { padding: 16px !important; }
        }
      `}</style>
      
      <div style={styles.container} className="fyt-container">
        <h3 style={styles.title}>{title}</h3>
        
        <div style={styles.sourceSentenceBox}>
          <span style={styles.sourceSentenceText} className="fyt-source-text">{sourceSentence}</span>
          <div style={styles.playButton} className="play-btn" onClick={() => playCachedTTS(sourceSentence, sourceLang)}>
            <FaVolumeUp />
          </div>
        </div>

        {/* 🧠 [新增] 顶部工具栏：提示与拼音开关 */}
        <div style={styles.toolbar}>
          <button style={styles.toolButton} className="tool-btn" onClick={showHint} disabled={isSubmitted}>
            <FaLightbulb /> 提示
          </button>
          <button style={styles.toolButton} className="tool-btn" onClick={() => setShowPinyin(p => !p)}>
            {showPinyin ? <FaEyeSlash /> : <FaEye />} {showPinyin ? '隐藏拼音' : '显示拼音'}
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ ...styles.answerArea, ...(isSubmitted && !isCorrect ? styles.answerAreaError : {}) }}>
            <SortableContext items={answerItems} strategy={rectSortingStrategy}>
              {answerItems.map(item => (
                <SortableCard key={item.id} item={item} lang={targetLang} showPinyin={showPinyin} onClick={() => toggleItemPlacement(item)} />
              ))}
            </SortableContext>
          </div>
          
          <DragOverlay modifiers={[restrictToParentElement, restrictToHorizontalAxis]}>
            {activeId && activeItem ? (
              <Card 
                id={activeItem.id} 
                content={activeItem.content} 
                pinyinContent={activeItem.pinyin} 
                color={activeItem.color}
                lang={targetLang}
                showPinyin={showPinyin}
                style={styles.dragOverlay}
              />
            ) : null}
          </DragOverlay>
        
          <div style={styles.wordPool}>
            {poolItems.map(item => (
              <Card 
                key={item.id} 
                id={item.id}
                content={item.content}
                pinyinContent={item.pinyin}
                color={item.color}
                lang={targetLang}
                showPinyin={showPinyin}
                isHinted={item.id === hintedWordId}
                onClick={() => toggleItemPlacement(item)}
              />
            ))}
          </div>
        </DndContext>

        <div style={styles.buttonContainer}>
          {!isSubmitted ? (
            <button style={styles.submitButton} className="submit-btn" onClick={handleSubmit}>检查答案</button>
          ) : (
            <>
              <div style={{ ...styles.feedback, ...(isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect) }}>
                {isCorrect ? <><FaCheck /> 完全正确！</> : <><FaTimes /> 再试一次吧！</>}
              </div>
              {/* 🧠 [优化] 只有当答错或答对后有解析时才显示 */}
              {explanation && (!isCorrect || isCorrect) && (
                <div style={styles.explanationBox}>
                  <FaLightbulb style={{ marginRight: '8px', color: '#f59e0b', flexShrink: 0, verticalAlign: 'middle' }} />
                  <span style={{ verticalAlign: 'middle' }}><strong>解析：</strong> {explanation}</span>
                </div>
              )}
              <button style={{ ...styles.submitButton, backgroundColor: '#64748b' }} className="submit-btn" onClick={resetState}>
                <FaRedo /> 再试一次
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default FanYiTi;
