// components/ShortSentenceCard.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { Volume2, ArrowLeft, ArrowRight, CornerDownLeft, Copy } from 'lucide-react';
import { pinyin as pinyinConverter } from 'pinyin-pro';

// --- 音频播放工具 ---
let howlInstance = null;
const playTTS = (text, lang) => {
  if (!text) return;
  const voice = lang === 'my' ? 'my-MM-NilarNeural' : 'zh-CN-XiaoxiaoNeural';
  if (howlInstance?.playing()) howlInstance.stop();
  const ttsUrl = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=0`;
  howlInstance = new Howl({ src: [ttsUrl], html5: true });
  howlInstance.play();
};

// --- 卡片翻转组件 ---
const CardFace = ({ text, pinyin, isFront, lang, ...props }) => {
    return (
        <animated.div style={{...styles.cardFace, ...props}}>
            <div style={styles.cardContent}>
                {isFront && pinyin && <p style={styles.pinyin}>{pinyin}</p>}
                <p style={isFront ? styles.mainTextFront : styles.mainTextBack} lang={lang}>
                    {text}
                </p>
            </div>
        </animated.div>
    );
};

// --- 主组件 ---
const ShortSentenceCard = ({ sentences = [] }) => {
  const cards = useMemo(() => {
    if (!sentences || sentences.length === 0) {
      return [{ id: 'default', sentence: '暂无短句', translation: 'No sentences available.', pinyin: 'zàn wú duǎn jù' }];
    }
    return sentences;
  }, [sentences]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lastDirection, setLastDirection] = useState(0);

  const currentCard = cards[currentIndex];

  const cardTransitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translateX(${lastDirection >= 0 ? '100%' : '-100%'}) scale(0.8)` },
    enter: { opacity: 1, transform: 'translateX(0%) scale(1)' },
    leave: { opacity: 0, transform: `translateX(${lastDirection >= 0 ? '-100%' : '100%'}) scale(0.8)`, position: 'absolute' },
    config: { tension: 300, friction: 30 },
    onRest: () => setIsFlipped(false),
  });

  const navigate = useCallback((direction) => {
    setLastDirection(direction);
    setCurrentIndex(prev => (prev + direction + cards.length) % cards.length);
  }, [cards.length]);

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], direction: [xDir], tap }) => {
    if (tap) { setIsFlipped(f => !f); return; }
    if (!down && (Math.abs(mx) > 80 || Math.abs(vx) > 0.4)) { navigate(xDir > 0 ? -1 : 1); }
  }, { axis: 'x', filterTaps: true, taps: true });

  useEffect(() => {
    const timer = setTimeout(() => { if (currentCard) { playTTS(currentCard.sentence, 'zh'); } }, 500);
    return () => clearTimeout(timer);
  }, [currentIndex, currentCard]);
  
  const handleCopy = (e) => { e.stopPropagation(); navigator.clipboard.writeText(currentCard.sentence); };

  return (
    <div style={styles.container}>
      <div style={styles.progressContainer}><div style={{...styles.progressBar, width: `${((currentIndex + 1) / cards.length) * 100}%` }} /></div>
      <div style={styles.cardArea} {...bind()}>
        {cardTransitions((style, i) => {
          const cardData = cards[i];
          return (
            <animated.div style={{...styles.cardWrapper, ...style}} onClick={() => setIsFlipped(f => !f)}>
                 <div style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', ...styles.flipper }}>
                    <CardFace text={cardData.sentence} pinyin={cardData.pinyin} isFront={true} lang="zh" style={{ backfaceVisibility: 'hidden' }}/>
                    <CardFace text={cardData.translation} isFront={false} lang="my" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}/>
                </div>
            </animated.div>
          );
        })}
      </div>
      <div style={styles.controls}>
        <button style={styles.controlButton} onClick={() => navigate(-1)}><ArrowLeft /></button>
        <button style={styles.mainButton} onClick={() => playTTS(isFlipped ? currentCard.translation : currentCard.sentence, isFlipped ? 'my' : 'zh')}><Volume2 size={32} /></button>
        <button style={styles.controlButton} onClick={() => navigate(1)}><ArrowRight /></button>
      </div>
      <div style={styles.topTools}>
         <button style={styles.toolButton} onClick={handleCopy}><Copy size={18}/></button>
         <button style={styles.toolButton} onClick={() => setIsFlipped(true)}><CornerDownLeft size={18}/></button>
      </div>
    </div>
  );
};

const styles = {
    container: { position: 'relative', width: '100%', height: 'calc(80vh - 40px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '20px', overflow: 'hidden', userSelect: 'none', touchAction: 'pan-y' },
    progressContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#e2e8f0' },
    progressBar: { height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' },
    cardArea: { flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1000px', padding: '20px' },
    cardWrapper: { width: '90%', maxWidth: '500px', height: '100%', cursor: 'pointer' },
    flipper: { position: 'relative', width: '100%', height: '100%', transition: 'transform 0.6s', transformStyle: 'preserve-3d' },
    cardFace: { position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '30px' },
    cardContent: { textAlign: 'center' },
    pinyin: { fontSize: '1.2rem', color: '#64748b', margin: '0 0 15px 0', lineHeight: 1.5 },
    mainTextFront: { fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', margin: 0, lineHeight: 1.4 },
    mainTextBack: { fontSize: '1.8rem', color: '#334155', margin: 0, fontWeight: 500, lineHeight: 1.5 },
    controls: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', padding: '20px', width: '100%' },
    controlButton: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    mainButton: { background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' },
    topTools: { position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' },
    toolButton: { background: 'rgba(0,0,0,0.05)', color: '#475569', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
};

export default ShortSentenceCard;
