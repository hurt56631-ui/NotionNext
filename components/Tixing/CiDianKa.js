// components/Tixing/CiDianKa.js (V7 - 交互、布局和动画完全修复)

import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { useSprings, animated, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import HanziWriter from 'hanzi-writer';

// --- 样式 ---
const styles = {
  fullScreenWrapper: { position: 'fixed', inset: 0, zIndex: 50, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', perspective: '1500px' },
  wrapper: { position: 'relative', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardInner: { width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', display: 'flex' },
  cardFace: {
    position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
    background: 'linear-gradient(145deg, #ffffff 0%, #f7faff 100%)',
    padding: '24px',
    // 关键修复：为底部导航栏增加安全区域，防止遮挡
    paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 24px))',
    display: 'flex', flexDirection: 'column', color: '#1e2b3b'
  },
  cardBack: { transform: 'rotateY(180deg)' },
  mainContent: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
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

// --- TTS (单例播放) ---
let currentSound = null;
const playTTS = (text) => {
  if (!text) return;
  if (currentSound) currentSound.stop();
  currentSound = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`] });
  currentSound.play();
};

// --- 汉字书写 Modal ---
const HanziWriterModal = ({ character, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => {
    let writer = null;
    const timeoutId = setTimeout(() => {
      if (writerRef.current) {
        writerRef.current.innerHTML = ''; // 清空旧实例
        writer = HanziWriter.create(writerRef.current, character, { width: 280, height: 280, padding: 20, showOutline: true });
        writer.animateCharacter();
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [character]);
  return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={writerRef}></div></div>;
};

// --- 单词卡 (移除手势相关逻辑，由父组件全权处理) ---
const CardView = forwardRef(({ cardData }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [showWriter, setShowWriter] = useState(false);
  return (
    <div style={styles.cardInner} ref={ref}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)} />}
      <animated.div style={{ ...styles.cardFace, transform: 'rotateY(0deg)' }}>
        <div style={styles.mainContent}>
          <header style={styles.header}><div style={styles.pinyin}>{pinyin}</div><div style={styles.word}>{word}</div></header>
        </div>
        <footer style={styles.footer} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '12px' }}><button style={styles.footerButton}><FaMicrophone /> 发音练习</button><button style={styles.footerButton} onClick={() => setShowWriter(true)}><FaPenFancy /> 笔顺</button></div>
          <button style={styles.footerButton} onClick={() => playTTS(word)}><FaVolumeUp /></button>
        </footer>
      </animated.div>
      <animated.div style={{ ...styles.cardFace, ...styles.cardBack }}>
        <div style={styles.backSideContent}><div style={styles.meaning}>{meaning}</div><div style={styles.example}><FaVolumeUp style={styles.ttsIconSmall} onClick={(e) => { e.stopPropagation(); playTTS(example); }} /><span style={styles.exampleText}>{example}</span></div>{aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}</div>
      </animated.div>
    </div>
  );
});
CardView.displayName = 'CardView';

// --- 主组件 ---
const CiDianKa = ({ flashcards = [] }) => {
  const [gone] = useState(() => new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [props, api] = useSprings(flashcards.length, i => ({ x: 0, rot: 0, scale: 1, rotateY: 0, zIndex: flashcards.length - i }));

  useEffect(() => { if (flashcards[currentIndex]) playTTS(flashcards[currentIndex].word); }, [flashcards]);

  const handleFlip = (index) => api.start(i => i === index && { rotateY: props[i].rotateY.get() === 180 ? 0 : 180 });

  const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx] }) => {
    // 关键修复：整合手势，只允许操作顶层卡片
    if (index !== currentIndex) return;

    const trigger = vx > 0.2;
    const dir = xDir < 0 ? -1 : 1;

    // 如果卡片已翻转，则不允许滑动
    if (props[index].rotateY.get() !== 0) return;

    if (!down) { // 手势释放
      if (trigger) { // 判定为有效滑动
        gone.add(index);
        api.start(i => {
          if (i !== index) return;
          return { x: (200 + window.innerWidth) * dir, rot: mx / 10 + dir * 45 * vx, config: { friction: 50, tension: 200 } };
        });
        // 动画开始后立即更新索引，准备下一张卡片
        const nextIndex = (currentIndex + 1) % flashcards.length;
        setCurrentIndex(nextIndex);
        if (gone.size === flashcards.length) {
            setTimeout(() => {
                gone.clear();
                api.start(i => ({ x: 0, rot: 0, scale: 1, delay: i * 50 }));
                setCurrentIndex(0); // 重置索引
            }, 600);
        }
      } else if (Math.abs(mx) < 5) { // 判定为轻点 (翻转卡片)
        handleFlip(index);
        api.start(i => i === index && { x: 0, rot: 0, scale: 1, config: { friction: 50, tension: 500 } });
      } else { // 判定为无效滑动 (松手后弹回)
        api.start(i => i === index && { x: 0, rot: 0, scale: 1, config: { friction: 50, tension: 500 } });
      }
    } else { // 手势进行中
      const x = mx;
      const rot = mx / 10;
      const scale = 1.05;
      api.start(i => i === index && { x, rot, scale, config: { friction: 50, tension: 800 } });
    }
  });

  if (!flashcards || flashcards.length === 0) return <div>没有卡片数据。</div>;

  return (
    <div style={styles.fullScreenWrapper}>
      <div style={styles.wrapper}>
        {props.map((springProps, i) => (
          <animated.div key={i} style={{ ...styles.card, zIndex: springProps.zIndex, transform: to([springProps.x, springProps.rot], (x, r) => `translateX(${x}px) rotateY(${r}deg)`) }} {...bind(i)}>
            <animated.div style={{ width: '100%', height: '100%', transform: springProps.rotateY.to(r => `rotateY(${r}deg)`) }}>
              <CardView cardData={flashcards[i]} />
            </animated.div>
          </animated.div>
        ))}
      </div>
    </div>
  );
};

export default CiDianKa;
