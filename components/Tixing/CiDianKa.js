// components/Tixing/CiDianKa.js (V9 - 采用点击区域交互模型，已完全修复)

import React, { useState, useEffect, useRef, forwardRef, useCallback } from 'react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  container: { position: 'relative', width: '100%', height: '100%', touchAction: 'none' },
  // 新增：卡片容器，处理切换时的淡入淡出
  cardTransitionWrapper: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 300ms ease-in-out',
  },
  // 新增：卡片翻转容器
  cardFlipWrapper: {
    width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px',
    perspective: '1500px',
  },
  cardInner: {
    position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d',
    transition: 'transform 0.6s ease-in-out',
  },
  face: {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px',
    background: 'linear-gradient(180deg,#ffffff,#eef6ff)', boxShadow: '0 30px 60px rgba(10,30,80,0.12)',
    display: 'flex', flexDirection: 'column', padding: '28px',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))',
  },
  backFace: { transform: 'rotateY(180deg)' },
  header: { textAlign: 'center', marginBottom: 8 },
  pinyin: { fontSize: '1.4rem', color: '#5b6b82', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: '#102035' },
  practiceArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12 },
  button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  // 新增：交互覆盖层，用于点击区域
  interactionOverlay: { position: 'absolute', inset: 0, zIndex: 10, display: 'flex' },
  interactionZone: { height: '100%', cursor: 'pointer' },
  // 其他样式...
  modalBackdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 10000 },
  modalBox: { background: '#fff', padding: 18, borderRadius: 12, width: '92%', maxWidth: 380 },
  example: { background: 'rgba(240,244,255,0.9)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' },
  meaning: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  explanation: { marginTop: 10, fontStyle: 'italic', color: '#415161', borderLeft: '3px solid #3b82f6', paddingLeft: 10 },
  tiny: { fontSize: 12, color: '#6b7280' },
};

// ===================== TTS, Hanzi Modal, Pronunciation etc. (保持不变) =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance && _howlInstance.playing()) _howlInstance.stop(); } catch (e) {}
  const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`;
  _howlInstance = new Howl({ src: [ttsUrl], html5: true });
  _howlInstance.play();
};

const HanziModal = ({ char, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    let writer = null;
    const tid = setTimeout(() => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      writer = HanziWriter.create(ref.current, char, { width: 260, height: 260, padding: 10, showOutline: true });
      writer.animateCharacter();
    }, 80);
    return () => clearTimeout(tid);
  }, [char]);
  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div ref={ref} /><div style={{ marginTop: 12, textAlign: 'center' }}><button style={styles.button} onClick={onClose}>关闭</button></div>
      </div>
    </div>
  );
};
// ... (其他辅助组件和函数可以保持原样)

// ===================== CardView (简化，只负责渲染) =====================
const CardView = forwardRef(({ data, onOpenWriter, onPronounceClick, renderPractice }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = data;
  return (
    <div ref={ref}>
      {/* 正面 */}
      <div style={{ ...styles.face }}>
        <div style={styles.header}><div style={styles.pinyin}>{pinyin}</div><div style={styles.hanzi}>{word}</div></div>
        <div style={styles.practiceArea}>{renderPractice ? renderPractice() : <div style={styles.tiny}>点击底部「发音练习」开始</div>}</div>
        <div style={styles.footer} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 10 }}><button style={styles.button}><FaMicrophone /> 发音练习</button><button style={styles.button} onClick={() => onOpenWriter(word)}><FaPenFancy /> 笔顺</button></div>
            <button style={styles.button} onClick={() => onPronounceClick(word)}><FaVolumeUp /></button>
        </div>
      </div>
      {/* 背面 */}
      <div style={{ ...styles.face, ...styles.backFace }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={styles.meaning}>{meaning}</div>
          <div style={styles.example}><FaVolumeUp style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onPronounceClick(example); }} /><div style={styles.exampleText}>{example}</div></div>
          {aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}
        </div>
      </div>
    </div>
  );
});
CardView.displayName = 'CardView';

// ===================== 主组件 CiDianKa (全新交互逻辑) =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [writerChar, setWriterChar] = useState(null);

  // 卡片切换时自动播放单词读音
  useEffect(() => {
    if (!cards.length) return;
    const cardWord = cards[currentIndex]?.word;
    if (cardWord) {
      const timer = setTimeout(() => playTTS(cardWord), 300); // 延迟播放，避免与UI过渡冲突
      return () => clearTimeout(timer);
    }
  }, [currentIndex, cards]);
  
  // 核心交互函数
  const changeCard = (newIndex) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsFlipped(false); // 切换卡片时总是返回正面
    
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300); // 等待淡出动画完成
  };
  
  const handlePrev = useCallback(() => {
    if (!cards.length) return;
    const newIndex = (currentIndex - 1 + cards.length) % cards.length;
    changeCard(newIndex);
  }, [currentIndex, cards.length, isTransitioning]);
  
  const handleNext = useCallback(() => {
    if (!cards.length) return;
    const newIndex = (currentIndex + 1) % cards.length;
    changeCard(newIndex);
  }, [currentIndex, cards.length, isTransitioning]);

  const handleFlip = useCallback(() => {
    if(isTransitioning) return;
    setIsFlipped(prev => !prev);
  }, [isTransitioning]);

  if (!cards.length) return <div>没有卡片数据。</div>;
  const currentCardData = cards[currentIndex];

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}
      <div style={styles.container}>
        <div style={{ ...styles.cardTransitionWrapper, opacity: isTransitioning ? 0 : 1 }}>
          <div style={styles.cardFlipWrapper}>
            {/* 交互层 - 这是关键 */}
            <div style={styles.interactionOverlay}>
              <div style={{ ...styles.interactionZone, width: '20%' }} onClick={handlePrev}></div>
              <div style={{ ...styles.interactionZone, width: '60%' }} onClick={handleFlip}></div>
              <div style={{ ...styles.interactionZone, width: '20%' }} onClick={handleNext}></div>
            </div>

            {/* 卡片内容 */}
            <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <CardView
                data={currentCardData}
                onOpenWriter={setWriterChar}
                onPronounceClick={playTTS}
                renderPractice={() => <div>发音练习区域</div> /* 占位 */}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CiDianKa;
