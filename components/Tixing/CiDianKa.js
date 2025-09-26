// components/Tixing/CiDianKa.js (V2 - 精致优化最终版)

import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCheck, FaTimes } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// --- 样式变量 (采纳建议) ---
const colors = {
  primary: '#3b82f6', danger: '#ef4444', success: '#22c55e', muted: '#64748b',
  bgCard: 'linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(240, 244, 255, 0.7) 100%)',
};

const styles = {
  wrapper: { position: 'relative', width: '100%', maxWidth: '480px', height: '75vh', minHeight: '550px', margin: 'auto', cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardContent: { width: '92%', height: '95%', background: colors.bgCard, borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)', padding: '24px', display: 'flex', flexDirection: 'column', color: '#1e2b3b', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.2)' },
  mainContent: { flexGrow: 1, display: 'flex', flexDirection: 'column', cursor: 'pointer' },
  header: { textAlign: 'center', flexShrink: 0, padding: '20px 0' },
  pinyin: { fontSize: '1.6rem', color: colors.muted, marginBottom: '8px' },
  word: { fontSize: '5rem', fontWeight: 'bold', lineHeight: '1.1' },
  practiceSection: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', paddingBottom: '20px' },
  micButton: { width: '80px', height: '80px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: 'white', fontSize: '2rem' },
  micIdle: { background: colors.primary, boxShadow: `0 0 20px ${colors.primary}` },
  micListening: { background: colors.danger, animation: 'pulse 1.5s infinite' },
  micLoading: { background: '#6b7280', cursor: 'not-allowed' },
  feedbackContainer: { minHeight: '60px', width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1ch' },
  feedbackSyllable: { fontSize: '1.5rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: '8px' },
  correct: { color: colors.success },
  incorrect: { color: colors.danger, textDecoration: 'line-through' },
  footer: { display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' },
  detailsButton: { background: 'rgba(226, 232, 240, 0.7)', color: '#475569', border: 'none', borderRadius: '20px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' },
  detailsPane: { background: 'rgba(255, 255, 255, 0.9)', padding: '20px', borderRadius: '16px', marginTop: '16px', border: '1px solid #e2e8f0' },
  meaning: { fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' },
  example: { fontSize: '1rem', color: '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' },
  exampleText: { flexGrow: 1 },
  ttsIconSmall: { cursor: 'pointer', color: colors.muted, fontSize: '1.2rem', flexShrink: 0 },
  explanation: { fontSize: '0.95rem', color: colors.muted, fontStyle: 'italic', borderLeft: `3px solid ${colors.primary}`, paddingLeft: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(5px)' },
  modalContent: { background: 'white', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '300px' },
};

// --- 音效 & TTS (保持不变) ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }) };
let ttsCache = new Map();
const playTTS = async (text) => { if (ttsCache.has(text)) { ttsCache.get(text).play(); return; } try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-25`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); audio.play(); } catch (e) { console.error('TTS 失败:', e); } };

// --- 拼音比对 (保持不变) ---
const comparePinyin = (correctStr, userStr) => {
  const correctPinyins = pinyinConverter(correctStr, { type: 'array' });
  const userPinyins = pinyinConverter(userStr, { type: 'array' });
  return correctPinyins.map((correctSyllable, i) => {
    const userSyllable = userPinyins[i];
    if (!userSyllable) return { syllable: correctSyllable, initial: 'incorrect', final: 'incorrect', tone: 'incorrect' };
    const correctParsed = parsePinyin(correctSyllable);
    const userParsed = parsePinyin(userSyllable);
    return { syllable: userSyllable, initial: correctParsed.initial === userParsed.initial ? 'correct' : 'incorrect', final: correctParsed.final === userParsed.final ? 'correct' : 'incorrect', tone: correctParsed.tone === userParsed.tone ? 'correct' : 'incorrect' };
  });
};

// --- 子组件 (已优化) ---
const HanziWriterModal = ({ character, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => { if (!writerRef.current) return; const writer = HanziWriter.create(writerRef.current, character, { width: 250, height: 250, padding: 20, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100 }); writer.animateCharacter(); return () => (writer.target.innerHTML = ''); }, [character]);
  return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={writerRef}></div></div>;
};

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
      setStatus('loading');
      const transcript = event.results[0][0].transcript.replace(/[.,。，]/g, '');
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
    <>
      <button onClick={handleMicClick} style={{ ...styles.micButton, ...(status === 'listening' ? styles.micListening : status === 'loading' ? styles.micLoading : styles.micIdle) }} disabled={status === 'loading'}>
        <FaMicrophone />
      </button>
      <div style={styles.feedbackContainer}>
        {status === 'feedback' && result.map((res, i) => {
            const isCorrect = res.initial === 'correct' && res.final === 'correct' && res.tone === 'correct';
            return (<span key={i} style={styles.feedbackSyllable}>
              <span style={styles[res.initial]}>{parsePinyin(res.syllable).initial}</span>
              <span style={styles[res.final]}>{parsePinyin(res.syllable).finalWithTone}</span>
              {isCorrect ? <FaCheckCircle style={styles.correct} /> : <FaTimesCircle style={styles.incorrect} />}
            </span>);
        })}
      </div>
    </>
  );
};

const CardView = forwardRef(({ cardData, ...props }, ref) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [showWriter, setShowWriter] = useState(false);
  
  // 自动朗读
  useEffect(() => { playTTS(word); }, [word]);

  const toggleDetails = (e) => {
    e.stopPropagation(); // 阻止事件冒泡到卡片滑动
    setIsDetailsVisible(v => !v);
  };

  return (
    <div style={styles.cardContent} ref={ref} {...props}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)} />}
      <div style={styles.mainContent} onClick={toggleDetails}>
        <header style={styles.header}>
          <div style={styles.pinyin}>{pinyin}</div>
          <div style={styles.word}>{word}</div>
        </header>
        <section style={styles.practiceSection}>
          <PronunciationPractice word={word} />
        </section>
      </div>

      {isDetailsVisible && (
        <animated.div style={styles.detailsPane}>
          <div style={styles.meaning}>{meaning}</div>
          <div style={styles.example}>
            <FaVolumeUp style={styles.ttsIconSmall} onClick={(e) => { e.stopPropagation(); playTTS(example); }} />
            <span style={styles.exampleText}>{example}</span>
          </div>
          {aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}
        </animated.div>
      )}

      <footer style={styles.footer}>
        <button style={styles.detailsButton} onClick={() => setShowWriter(true)}>
          <FaPenFancy /> 笔顺
        </button>
      </footer>
    </div>
  );
});
CardView.displayName = 'CardView';

const CiDianKa = ({ flashcards = [] }) => {
  const index = useRef(0);
  const [gone] = useState(() => new Set());
  const [props, api] = useSprings(flashcards.length, i => ({
    x: 0, y: 0, scale: 1, rot: 0
  }));

  const bind = useDrag(({ args: [idx], down, movement: [, my], direction: [, yDir], velocity: [, vy] }) => {
    const trigger = vy > 0.2;
    const dir = yDir < 0 ? -1 : 1;
    if (!down && trigger) {
        gone.add(idx);
        index.current = (index.current + 1) % flashcards.length;
    }

    api.start(i => {
      if (idx !== i) return;
      const isGone = gone.has(idx);
      const y = isGone ? (200 + window.innerHeight) * dir : down ? my : 0;
      const rot = my / 100 + (isGone ? dir * 10 * vy : 0);
      const scale = down ? 1.05 : 1;
      return { y, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
    });

    if (!down && gone.size === flashcards.length) {
      setTimeout(() => {
        gone.clear();
        api.start(i => ({ to: { x: 0, y: 0, scale: 1, rot: 0 }, delay: i * 50 }));
      }, 600);
    }
  });

  if (!flashcards || flashcards.length === 0) return <div>没有卡片数据。</div>;

  return (
    <div style={styles.wrapper}>
      {props.map((springProps, i) => (
        <animated.div key={i} style={{ ...styles.card, ...springProps }} {...bind(i)}>
          <CardView cardData={flashcards[i]} />
        </animated.div>
      ))}
      <style jsx global>{`
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 25px rgba(239, 68, 68, 0); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default CiDianKa;
