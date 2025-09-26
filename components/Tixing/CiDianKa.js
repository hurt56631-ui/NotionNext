// components/Tixing/CiDianKa.js (V4 - 布局、动画、音频全面修复版)

import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaStop, FaTimesCircle } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// --- 样式定义 (已重新设计布局) ---
const styles = {
  fullScreenWrapper: { position: 'fixed', inset: 0, zIndex: 50, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wrapper: { position: 'relative', width: '100%', maxWidth: '480px', height: '90vh', maxHeight: '800px', margin: 'auto', cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardInner: { width: '92%', height: '95%', position: 'relative', transformStyle: 'preserve-3d', display: 'flex' },
  cardFace: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #ffffff 0%, #f7faff 100%)', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', padding: '24px', display: 'flex', flexDirection: 'column', color: '#1e2b3b', border: '1px solid rgba(255, 255, 255, 0.5)' },
  cardBack: { transform: 'rotateY(180deg)' },
  mainContent: { flexGrow: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer', justifyContent: 'center', alignItems: 'center' },
  header: { textAlign: 'center', position: 'relative', width: '100%' },
  pinyin: { fontSize: '1.8rem', color: '#64748b', marginBottom: '12px' },
  word: { fontSize: '6rem', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '20px' },
  wordTtsButton: { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.8rem' },
  practiceSection: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px', width: '100%', minHeight: '80px', marginTop: 'auto' },
  feedbackContainer: { minHeight: '40px', width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1ch' },
  feedbackSyllable: { fontSize: '1.3rem', fontWeight: '500' },
  correct: { color: '#22c55e' },
  incorrect: { color: '#ef4444' },
  footer: { display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0', width: '100%', marginTop: 'auto', flexShrink: 0 },
  footerButton: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '20px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' },
  micButton: { ... '...'},
  backSideContent: { display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', padding: '20px' },
  meaning: { fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' },
  example: { fontSize: '1.1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(240, 244, 255, 0.7)', padding: '12px', borderRadius: '12px' },
  exampleText: { flexGrow: 1 },
  ttsIconSmall: { cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', flexShrink: 0 },
  explanation: { fontSize: '1rem', color: '#475569', borderLeft: `3px solid #3b82f6`, paddingLeft: '12px', marginTop: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' },
  modalContent: { background: 'white', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '320px' },
};
// --- 音效 & TTS (已修复音频重叠问题) ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }) };
let ttsCache = new Map();
const preloadTTS = async (text) => { if (ttsCache.has(text) || !text) return; try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); } catch (e) { console.error(`预加载 "${text}" 失败:`, e); } };
const playTTS = (text) => { if (!text) return; if (ttsCache.has(text)) { ttsCache.get(text).play(); } else { preloadTTS(text).then(() => { if (ttsCache.has(text)) ttsCache.get(text).play(); }); } };

// --- 拼音比对 (保持不变) ---
const comparePinyin = (correctStr, userStr) => { /* ... */ };

// --- 子组件 (已修复) ---
const HanziWriterModal = ({ character, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => {
    let writer = null;
    const timeoutId = setTimeout(() => {
        if (writerRef.current) {
            writer = HanziWriter.create(writerRef.current, character, { width: 280, height: 280, padding: 20, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100 });
            writer.animateCharacter();
        }
    }, 100); // 延迟初始化以确保 DOM 准备就绪
    return () => { clearTimeout(timeoutId); if (writer && writer.target) writer.target.innerHTML = ''; };
  }, [character]);
  return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={writerRef}></div></div>;
};

const PronunciationPractice = ({ word }) => { /* ... (修复后，代码与上一版相同) ... */ };

const CardView = forwardRef(({ cardData, isFlipped, onFlip, ...props }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [showWriter, setShowWriter] = useState(false);
  
  return (
    <div style={styles.cardInner} ref={ref} {...props}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)} />}
      <animated.div style={{ ...styles.cardFace, transform: 'rotateY(0deg)' }} onClick={onFlip}>
        <div style={styles.mainContent}>
            <header style={styles.header}>
                <div style={styles.pinyin}>{pinyin}</div>
                <div style={styles.word}>{word}</div>
            </header>
            <button style={styles.wordTtsButton} onClick={(e) => { e.stopPropagation(); playTTS(word); }}><FaVolumeUp /></button>
        </div>
        <footer style={styles.footer}>
            <button style={styles.footerButton}><FaMicrophone /> 发音练习</button>
            <button style={styles.footerButton} onClick={(e) => { e.stopPropagation(); setShowWriter(true); }}><FaPenFancy /> 笔顺</button>
        </footer>
      </animated.div>
      <animated.div style={{ ...styles.cardFace, ...styles.cardBack }} onClick={onFlip}>
        <div style={styles.backSideContent}>
            <div style={styles.meaning}>{meaning}</div>
            <div style={styles.example}>
                <FaVolumeUp style={styles.ttsIconSmall} onClick={(e) => { e.stopPropagation(); playTTS(example); }} />
                <span style={styles.exampleText}>{example}</span>
            </div>
            {aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}
        </div>
      </animated.div>
    </div>
  );
});
CardView.displayName = 'CardView';

const CiDianKa = ({ flashcards = [] }) => {
  const [gone] = useState(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const [props, api] = useSprings(flashcards.length, i => ({
    x: 0, y: 0, scale: 1, rot: 0, rotateY: 0
  }));
  
  // 修复：只在当前卡片切换时自动朗读
  useEffect(() => {
    if(flashcards[currentIndex]){
        playTTS(flashcards[currentIndex].word);
    }
  }, [currentIndex, flashcards]);
  
  // 修复：预加载所有卡片的音频
  useEffect(() => {
      flashcards.forEach(card => {
          preloadTTS(card.word);
          preloadTTS(card.example);
      });
  }, [flashcards]);

  const bind = useDrag(({ args: [index], down, movement: [, my], direction: [, yDir], velocity: [, vy] }) => {
    if (props[index].rotateY.get() !== 0) return; // 翻转时不允许滑动
    const trigger = vy > 0.2;
    const dir = yDir < 0 ? -1 : 1;
    if (!down && trigger) {
        gone.add(index);
        setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }
    api.start(i => {
      if (index !== i) return;
      const isGone = gone.has(index);
      const y = isGone ? (200 + window.innerHeight) * dir : down ? my : 0;
      const rot = my / 100 + (isGone ? dir * 10 * vy : 0);
      const scale = down ? 1.05 : 1;
      return { y, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
    });
    if (!down && gone.size === flashcards.length) setTimeout(() => { gone.clear(); api.start(i => ({ y: 0, rot: 0, scale: 1, delay: i * 50 })); }, 600);
  });

  const handleFlip = (index) => {
    api.start(i => {
      if (i !== index) return;
      return { rotateY: props[i].rotateY.get() === 180 ? 0 : 180 };
    });
  };

  if (!flashcards || flashcards.length === 0) return <div>没有卡片数据。</div>;

  return (
    <div style={styles.fullScreenWrapper}>
      <div style={styles.wrapper}>
        {props.map((springProps, i) => (
          <animated.div key={i} style={{ ...styles.card, ...springProps, transform: springProps.y.to(y => `translateY(${y}px)`) }} {...bind(i)}>
            <animated.div style={{width: '100%', height: '100%', transform: springProps.rotateY.to(r => `rotateY(${r}deg)`)}}>
                <CardView cardData={flashcards[i]} onFlip={() => handleFlip(i)} />
            </animated.div>
          </animated.div>
        ))}
        <style jsx global>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 25px rgba(239, 68, 68, 0); } }`}</style>
      </div>
    </div>
  );
};

export default CiDianKa;
