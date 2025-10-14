// components/ShortSentenceCard.js (视觉和UI优化最终版)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaCog, FaTimes, FaRandom, FaSortAmountDown, FaArrowRight } from 'react-icons/fa';
import { pinyin as pinyinConverter } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// ... (辅助工具 & 常量区代码保持不变，此处省略) ...
// (PinyinVisualizer, PronunciationComparison, SettingsPanel 等子组件也保持不变)

// =================================================================================
// ===== 主组件: ShortSentenceCard =================================================
// =================================================================================
const ShortSentenceCard = ({ sentences = [], isOpen, onClose }) => {
  // ... (所有 Hooks 和内部逻辑状态，如 useCardSettings, useState 等保持不变) ...
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const [settings, setSettings] = useCardSettings();
  const processedCards = useMemo(() => { /* ... */ }, [sentences, settings.order]);
  const cards = processedCards.length > 0 ? processedCards : [{ id: 'fallback', chinese: "暂无卡片", pinyin: "zàn wú kǎ piàn", burmese: "..." }];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [writerChar, setWriterChar] = useState(null);
  const recognitionRef = useRef(null);
  const autoBrowseTimerRef = useRef(null);
  const lastDirection = useRef(0);
  const currentCard = cards[currentIndex];
  const navigate = useCallback((direction) => { /* ... */ }, [cards.length]);
  useEffect(() => { /* ... 自动播放逻辑 ... */ }, [currentIndex, currentCard, settings, isOpen, navigate]);
  const handleListen = useCallback((e) => { /* ... 语音识别逻辑 ... */ }, [isListening]);
  const handleCloseComparison = useCallback(() => setRecognizedText(''), []);
  const handleNavigateToNext = useCallback(() => { /* ... */ }, [handleCloseComparison, navigate]);
  useEffect(() => { return () => { if (recognitionRef.current) recognitionRef.current.stop(); }; }, []);
  const pageTransitions = useTransition(isOpen, { /* ... */ });
  const cardTransitions = useTransition(currentIndex, { /* ... */ });
  const bind = useDrag(({ down, movement: [, my], velocity: [, vy], direction: [, yDir], event }) => { /* ... */ }, { axis: 'y' });


  // --- 最终渲染的 JSX ---
  const cardContent = pageTransitions((style, item) =>
    item && (
      <animated.div style={{ ...styles.fullScreen, ...style }}>
        <div style={styles.gestureArea} {...bind()} />
        
        {/* ✅ 顶部控件: 只保留计数器 */}
        <div style={styles.headerControls} data-no-gesture="true">
            <div style={styles.counter}>{currentIndex + 1} / {cards.length}</div>
        </div>

        {/* 各种弹窗模态框 (保持不变) */}
        {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
        {isSettingsOpen && <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setIsSettingsOpen(false)} />}
        {!!recognizedText && currentCard && (<PronunciationComparison /* ... */ />)}
        
        {cardTransitions((cardStyle, i) => {
          const cardData = cards[i];
          if (!cardData) return null;
          return (
            <animated.div key={i} style={{ ...styles.animatedCardShell, ...cardStyle }}>
              {/* ✅ 卡片容器现在是完全透明的 */}
              <div style={styles.cardContainer}>
                  <div style={styles.mainContent} onClick={(e) => playTTS(cardData.chinese, settings.voiceChinese, settings.speechRateChinese, null, e)}>
                      <div style={styles.pinyin}>{cardData.pinyin || pinyinConverter(cardData.chinese, { toneType: 'mark', separator: ' ' })}</div>
                      <div style={styles.textChinese}>{cardData.chinese}</div>
                  </div>
                  <div style={styles.translationContent} onClick={(e) => playTTS(cardData.burmese, settings.voiceBurmese, settings.speechRateBurmese, null, e)}>
                      <div style={styles.textBurmese}>{cardData.burmese}</div>
                  </div>
              </div>
            </animated.div>
          );
        })}

        {/* 右侧控件 (保持不变) */}
        {currentCard && (
            <div style={styles.rightControls} data-no-gesture="true">
                <button style={styles.rightIconButton} onClick={() => setIsSettingsOpen(true)} title="设置"><FaCog size={20} /></button>
                <button style={styles.rightIconButton} onClick={handleListen} title="发音练习"><FaMicrophone size={20} color={isListening ? '#dc2626' : '#4a5568'} /></button>
                <button style={styles.rightIconButton} onClick={() => setWriterChar(currentCard.chinese)} title="笔顺"><FaPenFancy size={20} /></button>
            </div>
        )}
      </animated.div>
    )
  );

  if (isMounted) {
      return createPortal(cardContent, document.body);
  }
  return null;
};

// =================================================================================
// ===== 样式表 (视觉优化的核心) =================================================
// =================================================================================
const styles = {
    // --- 核心布局 ---
    fullScreen: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', background: 'url(/background.jpg) center/cover no-repeat', backgroundAttachment: 'fixed' },
    gestureArea: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 },
    animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '20px' },
    
    // ✅ 核心修改: 卡片容器变为透明，不再有背景、模糊和阴影
    cardContainer: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'transparent', // 透明背景
        // backdropFilter: 'blur(15px)', // 移除模糊
        borderRadius: '24px',
        // boxShadow: '0 20px 40px -10px rgba(0, 30, 80, 0.15)', // 移除阴影
        overflow: 'hidden'
    },
    
    // --- 卡片内容 ---
    mainContent: { flex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center', cursor: 'pointer' },
    translationContent: { flex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px', cursor: 'pointer', textAlign: 'center' },
    
    // ✅ 核心修改: 调整字体大小，并为主要文字添加阴影以保证可读性
    pinyin: {
        fontSize: '1.3rem', // 字体变小
        color: '#f1f5f9', // 亮色，适应深色背景
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        marginBottom: '1rem',
        letterSpacing: '0.05em'
    },
    textChinese: {
        fontSize: '2.8rem', // 字体变小
        fontWeight: 'bold',
        color: '#ffffff', // 白色
        lineHeight: 1.4,
        wordBreak: 'break-word',
        textShadow: '0 2px 8px rgba(0,0,0,0.6)' // 添加阴影
    },
    textBurmese: {
        fontSize: '2.2rem', // 字体变小
        color: '#e0e7ff', // 淡紫色，与背景协调
        fontFamily: '"Padauk", "Myanmar Text", sans-serif',
        lineHeight: 1.8,
        wordBreak: 'break-word',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)' // 添加阴影
    },

    // --- 控件 ---
    // ✅ 核心修改: 顶部只保留计数器，并居中
    headerControls: {
        position: 'fixed',
        top: '25px',
        left: '50%',
        transform: 'translateX(-50%)', // 水平居中
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center', // 内部元素居中
        alignItems: 'center'
    },
    counter: { background: 'rgba(0, 0, 0, 0.5)', color: 'white', padding: '5px 15px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold' },
    // (其他控件样式如 rightControls, 各种面板样式保持不变)
};

// ... (HanziModal 和其他子组件的定义应在文件内或正确导入) ...

export default ShortSentenceCard;
