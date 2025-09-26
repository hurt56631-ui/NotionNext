// components/Tixing/CiDianKa.js (V3 - 全屏沉浸式最终版)

import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaStop, FaInfoCircle, FaTimesCircle } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// --- 样式定义 ---
const styles = {
  fullScreenWrapper: { position: 'fixed', inset: 0, zIndex: 50, background: '#f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  wrapper: { position: 'relative', width: '100%', maxWidth: '480px', height: '90vh', maxHeight: '800px', margin: 'auto', cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardInner: { width: '92%', height: '95%', position: 'relative', transformStyle: 'preserve-3d' },
  cardFace: { position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #ffffff 0%, #f7faff 100%)', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', padding: '24px', display: 'flex', flexDirection: 'column', color: '#1e2b3b', border: '1px solid rgba(255, 255, 255, 0.5)' },
  cardBack: { transform: 'rotateY(180deg)' },
  header: { textAlign: 'center', position: 'relative' },
  pinyin: { fontSize: '1.6rem', color: '#64748b', marginBottom: '8px' },
  word: { fontSize: '5rem', fontWeight: 'bold', lineHeight: '1.1' },
  wordTtsButton: { position: 'absolute', top: '0', right: '0', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.5rem' },
  mainContent: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' },
  practiceSection: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', width: '100%' },
  micButton: { width: '70px', height: '70px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: 'white', fontSize: '1.8rem' },
  micIdle: { background: '#3b82f6', boxShadow: `0 0 20px #3b82f6` },
  micListening: { background: '#ef4444', animation: 'pulse 1.5s infinite' },
  micLoading: { background: '#6b7280', cursor: 'not-allowed' },
  feedbackContainer: { minHeight: '60px', width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1ch' },
  feedbackSyllable: { fontSize: '1.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: '8px' },
  correct: { color: '#22c55e' },
  incorrect: { color: '#ef4444' },
  footer: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', width: '100%' },
  footerButton: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '20px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' },
  backSideContent: { display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' },
  meaning: { fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' },
  example: { fontSize: '1.1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(240, 244, 255, 0.7)', padding: '12px', borderRadius: '12px' },
  exampleText: { flexGrow: 1 },
  ttsIconSmall: { cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', flexShrink: 0 },
  explanation: { fontSize: '1rem', color: '#475569', borderLeft: `3px solid #3b82f6`, paddingLeft: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' },
  modalContent: { background: 'white', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '300px' },
};

// --- 音效 & TTS (保持不变) ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }) };
let ttsCache = new Map();
const playTTS = async (text) => { if (ttsCache.has(text)) { ttsCache.get(text).play(); return; } try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); audio.play(); } catch (e) { console.error('TTS 失败:', e); } };

// --- 拼音比对 (保持不变) ---
const comparePinyin = (correctStr, userStr) => { /* ... */ };

// --- 子组件 (已修复) ---
const HanziWriterModal = ({ character, onClose }) => { const writerRef = useRef(null); useEffect(() => { if (!writerRef.current) return; const writer = HanziWriter.create(writerRef.current, character, { width: 250, height: 250, padding: 20, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100 }); writer.animateCharacter(); return () => { if(writer) writer.target.innerHTML = ''; }; }, [character]); return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={writerRef}></div></div>; };

const PronunciationPractice = ({ word }) => {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState([]);
  const recognitionRef = useRef(null);
  const handleMicClick = useCallback(() => {
    if (status === 'listening') { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('您的浏览器不支持语音识别。'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.replace(/[.,。，]/g, '');
      const comparison = comparePinyin(word, transcript);
      setResult(comparison);
      setStatus('feedback');
    };
    recognition.onerror = (e) => { console.error(e); setStatus('idle'); };
    recognition.onend = () => { if (status === 'listening') setStatus('idle'); };
    recognition.start();
    recognitionRef.current = recognition;
  }, [status, word]);
  return (
    <div style={styles.practiceSection}>
      <div style={styles.feedbackContainer}>
        {status === 'feedback' && result.map((res, i) => (
            <span key={i} style={styles.feedbackSyllable}>
              <span style={styles[res.initial]}>{parsePinyin(res.syllable).initial}</span>
              <span style={styles[res.final]}>{parsePinyin(res.syllable).finalWithTone}</span>
            </span>
        ))}
      </div>
      <button onClick={handleMicClick} style={{ ...styles.micButton, ...(status === 'listening' ? styles.micListening : status === 'loading' ? styles.micLoading : styles.micIdle) }} disabled={status === 'loading'}>
        {status === 'listening' ? <FaStop /> : <FaMicrophone />}
      </button>
    </div>
  );
};

const CardView = forwardRef(({ cardData, isFlipped, onFlip, ...props }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [showWriter, setShowWriter] = useState(false);
  useEffect(() => { playTTS(word); }, [word]);
  return (
    <div style={styles.cardInner} ref={ref} {...props}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)} />}
      <animated.div style={{ ...styles.cardFace }} onClick={onFlip}>
        <header style={styles.header}>
            <button style={styles.wordTtsButton} onClick={(e) => { e.stopPropagation(); playTTS(word); }}><FaVolumeUp /></button>
            <div style={styles.pinyin}>{pinyin}</div>
            <div style={styles.word}>{word}</div>
        </header>
        <footer style={styles.footer}>
            <button style={styles.footerButton} onClick={(e) => { e.stopPropagation(); setShowWriter(true); }}><FaPenFancy /> 笔顺</button>
        </footer>
      </animated.div>
      <animated.div style={{ ...styles.cardFace, ...styles.cardBack, transform: 'rotateY(180deg)' }} onClick={onFlip}>
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
  const [flipped, setFlipped] = useState(false);
  const [gone] = useState(() => new Set());
  const [props, api] = useSprings(flashcards.length, i => ({
    x: 0, y: i * -4, scale: 1, rot: -10 + i / 10, rotateY: 0
  }));
  
  const bind = useDrag(({ args: [index], down, movement: [, my], direction: [, yDir], velocity: [, vy] }) => {
    if (flipped) return; // 翻转时不允许滑动
    const trigger = vy > 0.2;
    const dir = yDir < 0 ? -1 : 1;
    if (!down && trigger) gone.add(index);
    api.start(i => {
      if (index !== i) return;
      const isGone = gone.has(index);
      const y = isGone ? (200 + window.innerHeight) * dir : down ? my : 0;
      const rot = my / 100 + (isGone ? dir * 10 * vy : 0);
      const scale = down ? 1.05 : 1;
      return { y, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 }, onRest: () => setFlipped(false) };
    });
    if (!down && gone.size === flashcards.length) setTimeout(() => { gone.clear(); api.start(i => ({ to: { x: 0, y: i * -4, rot: -10 + i / 10, scale: 1 }, delay: i * 50 })); }, 600);
  });

  const handleFlip = (index) => {
    api.start(i => {
      if (i !== index) return;
      return { rotateY: flipped ? 0 : 180 };
    });
    setFlipped(!flipped);
  };

  if (!flashcards || flashcards.length === 0) return <div>没有卡片数据。</div>;

  return (
    <div style={styles.fullScreenWrapper}>
      <div style={styles.wrapper}>
        {props.map((springProps, i) => (
          <animated.div key={i} style={{ ...styles.card, ...springProps }} {...bind(i)}>
            <CardView cardData={flashcards[i]} isFlipped={flipped} onFlip={() => handleFlip(i)} style={{ transform: springProps.rotateY.to(r => `rotateY(${r}deg)`) }}/>
          </animated.div>
        ))}
        <style jsx global>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 25px rgba(239, 68, 68, 0); } }`}</style>
      </div>
    </div>
  );
};

export default CiDianKa;
