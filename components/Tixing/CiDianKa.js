// components/Tixing/CiDianKa.js (V10 - 交互模型完全重构，已最终修复)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import HanziWriter from 'hanzi-writer';

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // 容器现在负责 perspective
  container: {
    position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px',
    perspective: '1500px',
  },
  cardTransitionWrapper: {
    position: 'absolute', inset: 0,
    transition: 'opacity 300ms ease-in-out',
  },
  cardInner: {
    position: 'relative', width: '100%', height: '100%',
    transformStyle: 'preserve-3d', // 关键：建立3D空间
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
  // 卡片主体内容，不包含footer
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12, flexShrink: 0 },
  button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  // 关键修复：交互网格层
  interactionGrid: {
    position: 'absolute', top: 0, left: 0, right: 0,
    bottom: '95px', // 精确控制高度，避开底部按钮区域
    zIndex: 10, display: 'grid', gridTemplateColumns: '1fr 3fr 1fr',
  },
  interactionZone: { cursor: 'pointer', height: '100%' },
  modalBackdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 10000 },
  modalBox: { background: '#fff', padding: 18, borderRadius: 12, width: '92%', maxWidth: 380 },
  example: { background: 'rgba(240,244,255,0.9)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' },
  meaning: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  explanation: { marginTop: 10, fontStyle: 'italic', color: '#415161', borderLeft: '3px solid #3b82f6', paddingLeft: 10 },
};

// ===================== TTS & Hanzi Modal (保持不变) =====================
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

// ===================== 主组件 CiDianKa (全新交互逻辑) =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: "示例", pinyin: "shì lì", meaning: "Example" }];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [writerChar, setWriterChar] = useState(null);

  useEffect(() => {
    if (!cards.length) return;
    const cardWord = cards[currentIndex]?.word;
    if (cardWord) {
      const timer = setTimeout(() => playTTS(cardWord), 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, cards]);

  const changeCard = (newIndex) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex(newIndex);
      setIsTransitioning(false);
    }, 300);
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
    if (isTransitioning) return;
    setIsFlipped(prev => !prev);
  }, [isTransitioning]);

  if (!cards.length) return <div>没有卡片数据。</div>;
  const currentCardData = cards[currentIndex];
  
  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}
      <div style={styles.container}>
        <div style={{ ...styles.cardTransitionWrapper, opacity: isTransitioning ? 0 : 1 }}>
          {/* 关键修复：交互网格现在独立于卡片内容，且不遮挡按钮 */}
          <div style={styles.interactionGrid}>
            <div style={styles.interactionZone} onClick={handlePrev}></div>
            <div style={styles.interactionZone} onClick={handleFlip}></div>
            <div style={styles.interactionZone} onClick={handleNext}></div>
          </div>
          
          {/* 卡片内容：结构调整以支持正确的3D翻转 */}
          <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            {/* 正面 */}
            <div style={styles.face}>
              <div style={styles.mainContent}>
                <div style={styles.header}>
                  <div style={styles.pinyin}>{currentCardData.pinyin}</div>
                  <div style={styles.hanzi}>{currentCardData.word}</div>
                </div>
                {/* 发音练习区域可以放在这里 */}
              </div>
              <div style={styles.footer}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={styles.button}><FaMicrophone /> 发音练习</button>
                  <button style={styles.button} onClick={() => setWriterChar(currentCardData.word)}><FaPenFancy /> 笔顺</button>
                </div>
                <button style={styles.button} onClick={() => playTTS(currentCardData.word)}><FaVolumeUp /></button>
              </div>
            </div>
            
            {/* 背面 */}
            <div style={{ ...styles.face, ...styles.backFace }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={styles.meaning}>{currentCardData.meaning}</div>
                {currentCardData.example && (
                  <div style={styles.example}>
                    <FaVolumeUp style={{ cursor: 'pointer', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); playTTS(currentCardData.example); }} />
                    <div>{currentCardData.example}</div>
                  </div>
                )}
                {currentCardData.aiExplanation && <div style={styles.explanation}>{currentCardData.aiExplanation}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CiDianKa;
