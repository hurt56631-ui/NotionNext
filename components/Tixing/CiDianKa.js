// components/Tixing/CiDianKa.js (V6 - 全屏优化 & 立方体动画 & 手势修复 & 笔画动画修复)

import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { useSprings, animated, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import HanziWriter from 'hanzi-writer';

// --- 样式 ---
const styles = {
  // 添加了 perspective 以实现 3D 效果
  fullScreenWrapper: { position: 'fixed', inset: 0, zIndex: 50, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', perspective: '1500px' },
  wrapper: { position: 'relative', width: '100%', height: '100%', margin: 0, cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  // 修改了宽度和高度为 100%
  cardInner: { width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', display: 'flex' },
  // 移除了 borderRadius
  cardFace: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #ffffff 0%, #f7faff 100%)', padding: '24px', display: 'flex', flexDirection: 'column', color: '#1e2b3b' },
  cardBack: { transform: 'rotateY(180deg)' },
  mainContent: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
  header: { textAlign: 'center', width: '100%' },
  pinyin: { fontSize: '1.8rem', color: '#64748b', marginBottom: '12px' },
  word: { fontSize: '6rem', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '20px' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0', width: '100%', marginTop: 'auto', flexShrink: 0 },
  footerButton: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '20px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' },
  backSideContent: { display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', padding: '20px' },
  meaning: { fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' },
  example: { fontSize: '1.1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(240, 244, 255, 0.7)', padding: '12px', borderRadius: '12px' },
  exampleText: { flexGrow: 1 },
  ttsIconSmall: { cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', flexShrink: 0 },
  explanation: { fontSize: '1rem', color: '#475569', borderLeft: `3px solid #3b82f6`, paddingLeft: '12px', marginTop: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' },
  modalContent: { background: 'white', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '320px' },
};

// --- TTS (单例播放，避免重叠) ---
let currentSound = null;
const playTTS = (text) => {
  if (!text) return;
  if (currentSound) currentSound.stop();
  currentSound = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`] });
  currentSound.play();
};

// --- 汉字书写 Modal (修复动画效果) ---
const HanziWriterModal = ({ character, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => {
    if (!writerRef.current) return;
    
    writerRef.current.innerHTML = ''; // 清空之前的实例
    let writer = null;

    const timeoutId = setTimeout(() => {
      if (writerRef.current) {
        writer = HanziWriter.create(writerRef.current, character, {
          width: 280,
          height: 280,
          padding: 20,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 100,
        });
        writer.animateCharacter();
      }
    }, 200); // 增加延迟确保数据加载

    return () => {
      clearTimeout(timeoutId);
    };
  }, [character]);

  return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={writerRef}></div></div>;
};

// --- 单词卡 ---
const CardView = forwardRef(({ cardData, isFlipped, onFlip }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [showWriter, setShowWriter] = useState(false);

  return (
    <div style={styles.cardInner} ref={ref}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)} />}
      <animated.div style={{ ...styles.cardFace, transform: 'rotateY(0deg)' }} onClick={onFlip}>
        <div style={styles.mainContent}>
          <header style={styles.header}>
            <div style={styles.pinyin}>{pinyin}</div>
            <div style={styles.word}>{word}</div>
          </header>
        </div>
        {/* 为 footer 添加 onPointerDown 事件来阻止 useDrag 手势 */}
        <footer style={styles.footer} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={styles.footerButton}><FaMicrophone /> 发音练习</button>
            <button style={styles.footerButton} onClick={() => setShowWriter(true)}><FaPenFancy /> 笔顺</button>
          </div>
          <button style={styles.footerButton} onClick={() => playTTS(word)}><FaVolumeUp /></button>
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

// --- 主组件 ---
const CiDianKa = ({ flashcards = [] }) => {
  const [gone] = useState(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);

  const [props, api] = useSprings(flashcards.length, i => ({ x: 0, y: 0, scale: 1, rot: 0, rotateY: 0 }));

  useEffect(() => {
    if (flashcards[currentIndex]) playTTS(flashcards[currentIndex].word);
  }, [currentIndex, flashcards]);

  const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx] }) => {
    if (props[index].rotateY.get() !== 0) return;
    const trigger = vx > 0.2;
    const dir = xDir < 0 ? -1 : 1;
    if (!down && trigger) {
      gone.add(index);
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }
    api.start(i => {
      if (index !== i) return;
      const isGone = gone.has(index);
      const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
      // 修改 rot 计算以产生更明显的 Y 轴旋转
      const rot = mx / 10 + (isGone ? dir * 45 * vx : 0);
      const scale = down ? 1.05 : 1;
      return { x, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
    });
    if (!down && gone.size === flashcards.length) setTimeout(() => { gone.clear(); api.start(i => ({ x: 0, rot: 0, scale: 1, delay: i * 50 })); }, 600);
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
          // 修改 transform 属性以包含 rotateY
          <animated.div key={i} style={{ ...styles.card, ...springProps, transform: to([springProps.x, springProps.rot], (x, r) => `translateX(${x}px) rotateY(${r}deg)`) }} {...bind(i)}>
            <animated.div style={{ width: '100%', height: '100%', transform: springProps.rotateY.to(r => `rotateY(${r}deg)`) }}>
              <CardView cardData={flashcards[i]} onFlip={() => handleFlip(i)} />
            </animated.div>
          </animated.div>
        ))}
      </div>
    </div>
  );
};

export default CiDianKa;
