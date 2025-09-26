// components/Tixing/CiDianKa.js (V12 - 最终交互与功能修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import HanziWriter from 'hanzi-writer';

// (复用上面的 HanziWriterTest 组件作为 Modal, 或者使用下面的内联版本)
const HanziModal = ({ char, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => {
    let writer = null;
    const tid = setTimeout(() => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      writer = HanziWriter.create(ref.current, char, { width: 260, height: 260, padding: 10, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100 });
      writer.animateCharacter();
    }, 100);
    return () => clearTimeout(tid);
  }, [char]);
  // ... (Modal的样式和JSX)
};


// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1500px' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', background: 'linear-gradient(180deg,#ffffff,#eef6ff)', boxShadow: '0 30px 60px rgba(10,30,80,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))' },
  backFace: { transform: 'rotateY(180deg)' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', cursor: 'pointer' },
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.4rem', color: '#5b6b82', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: '#102035' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12, flexShrink: 0 },
  button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  navButton: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  // ... (其他样式)
};

// ===================== TTS & Speech Recognition =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

const PronunciationPractice = ({ word }) => {
    // ... (语音识别组件逻辑保持不变)
};

// ===================== 主组件 CiDianKa =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: "示例", pinyin: "shì lì", meaning: "Example" }];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    if (cards[currentIndex]?.word && !isFlipped) {
      const timer = setTimeout(() => playTTS(cards[currentIndex].word), 400);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isFlipped, cards]);

  const changeCard = (direction) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
    setTimeout(() => { isAnimating.current = false; }, 500);
  };
  
  const handleFlip = useCallback(() => setIsFlipped(prev => !prev), []);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `scale(0.9)` },
    enter: { opacity: 1, transform: `scale(1)` },
    leave: { opacity: 0, transform: `scale(0.9)` },
    config: { tension: 280, friction: 30 },
  });

  return (
    <div style={styles.fullScreen}>
      {/* 左右切换按钮 */}
      <button style={{ ...styles.navButton, left: '10px' }} onClick={() => changeCard(-1)}><FaArrowLeft /></button>
      <button style={{ ...styles.navButton, right: '10px' }} onClick={() => changeCard(1)}><FaArrowRight /></button>
      
      {writerChar && <HanziWriterTest char={writerChar} onClose={() => setWriterChar(null)} />}

      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          return (
            <animated.div style={{ ...styles.animatedCardShell, ...style }}>
              <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* 正面 */}
                <div style={styles.face}>
                   {/* 关键修复：点击事件只放在卡片主体上，不覆盖底部按钮 */}
                  <div style={styles.mainContent} onClick={handleFlip}>
                    <div style={styles.header}>
                      <div style={styles.pinyin}>{cardData.pinyin}</div>
                      <div style={styles.hanzi}>{cardData.word}</div>
                    </div>
                     {/* 语音识别组件现在可以被正常点击 */}
                    <PronunciationPractice word={cardData.word} />
                  </div>
                  <div style={styles.footer}>
                    <button style={styles.button} onClick={() => alert("语音识别功能在卡片中部。")}>功能说明</button>
                    <button style={styles.button} onClick={() => setWriterChar(cardData.word)}>笔顺</button>
                    <button style={styles.button} onClick={() => playTTS(cardData.word)}>朗读</button>
                  </div>
                </div>
                {/* 背面 */}
                <div style={styles.face} onClick={handleFlip}>
                  <div style={{ ...styles.mainContent, justifyContent: 'center' }}>
                    <div style={styles.meaning}>{cardData.meaning}</div>
                    {cardData.example && (
                      <div style={styles.example}>
                         {/* 关键修复：阻止事件冒泡 */}
                        <div onClick={(e) => { e.stopPropagation(); playTTS(cardData.example); }} style={{cursor: 'pointer'}}>
                           <FaVolumeUp />
                        </div>
                        <div style={{marginLeft: '8px'}}>{cardData.example}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </animated.div>
          );
        })}
      </div>
    </div>
  );
};

export default CiDianKa;
