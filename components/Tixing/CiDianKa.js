// components/Tixing/CiDianKa.js (V1 - 沉浸式语言学习引擎)

import React, { useState, useMemo, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaRegLightbulb, FaTimes, FaCheckCircle, FaTimesCircle, FaPenFancy } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziWriter from 'hanzi-writer';

// --- 样式定义 ---
const styles = {
  wrapper: { position: 'relative', width: '100%', maxWidth: '480px', height: '70vh', margin: 'auto', cursor: 'grab', touchAction: 'none' },
  card: { position: 'absolute', width: '100%', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardContent: {
    width: '90%', height: '95%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    padding: '24px', display: 'flex', flexDirection: 'column', color: '#1e2b3b',
  },
  header: { textAlign: 'center', marginBottom: '20px' },
  pinyin: { fontSize: '1.5rem', color: '#64748b', marginBottom: '8px' },
  word: { fontSize: '5rem', fontWeight: 'bold', lineHeight: '1.1' },
  practiceSection: { flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px' },
  micButton: { width: '80px', height: '80px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', color: 'white' },
  micIdle: { background: '#3b82f6', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.38)' },
  micListening: { background: '#ef4444', transform: 'scale(1.1)', animation: 'pulse 1.5s infinite' },
  micLoading: { background: '#6b7280', cursor: 'not-allowed' },
  feedbackContainer: { minHeight: '60px', width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '0.5ch' },
  feedbackSyllable: { fontSize: '1.5rem', fontWeight: '500' },
  correct: { color: '#22c55e' },
  incorrect: { color: '#ef4444', textDecoration: 'underline' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' },
  detailsButton: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' },
  detailsPane: { background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', marginTop: '16px', border: '1px solid #e2e8f0' },
  meaning: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' },
  example: { fontSize: '1rem', color: '#475569', marginBottom: '12px' },
  explanation: { fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic', borderLeft: '3px solid #f59e0b', paddingLeft: '12px' },
  modalBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalContent: { background: 'white', padding: '20px', borderRadius: '16px', width: '90%', maxWidth: '300px' },
};

// --- 音效 & TTS ---
let sounds = { click: new Howl({ src: ['/sounds/click.mp3'], volume: 0.7 }) };
let ttsCache = new Map();
const playSound = (name) => sounds[name]?.play();
const playTTS = async (text) => { if (ttsCache.has(text)) { ttsCache.get(text).play(); return; } try { const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-25`; const response = await fetch(url); if (!response.ok) throw new Error('API Error'); const blob = await response.blob(); const audio = new Audio(URL.createObjectURL(blob)); ttsCache.set(text, audio); audio.play(); } catch (e) { console.error("TTS 失败:", e); } };

// --- 智能拼音比对函数 ---
const comparePinyin = (correctStr, userStr) => {
  const correctPinyins = pinyinConverter(correctStr, { type: 'array' });
  const userPinyins = pinyinConverter(userStr, { type: 'array' });
  
  return correctPinyins.map((correctSyllable, i) => {
    const userSyllable = userPinyins[i];
    if (!userSyllable) return { syllable: correctSyllable, initial: 'incorrect', final: 'incorrect', tone: 'incorrect' };
    
    const correctParsed = parsePinyin(correctSyllable);
    const userParsed = parsePinyin(userSyllable);
    
    return {
      syllable: userSyllable,
      initial: correctParsed.initial === userParsed.initial ? 'correct' : 'incorrect',
      final: correctParsed.final === userParsed.final ? 'correct' : 'incorrect',
      tone: correctParsed.tone === userParsed.tone ? 'correct' : 'incorrect'
    };
  });
};

// --- 子组件 ---
const HanziWriterModal = ({ character, onClose }) => {
  const writerRef = useRef(null);
  useEffect(() => {
    if (!writerRef.current) return;
    const writer = HanziWriter.create(writerRef.current, character, {
      width: 250, height: 250, padding: 20,
      showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100
    });
    writer.animateCharacter();
    return () => writer.target.innerHTML = '';
  }, [character]);
  return <div style={styles.modalBackdrop} onClick={onClose}><div style={styles.modalContent} onClick={e => e.stopPropagation()} ref={writerRef}></div></div>;
};

const PronunciationPractice = ({ word, pinyin }) => {
  const [status, setStatus] = useState('idle'); // idle, listening, loading, feedback
  const [result, setResult] = useState([]);
  const recognitionRef = useRef(null);

  const handleMicClick = useCallback(() => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('您的浏览器不支持语音识别。'); return; }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    
    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event) => {
      setStatus('loading');
      const transcript = event.results[0][0].transcript.replace(/[.,。，]/g, ''); // 移除标点
      const comparison = comparePinyin(word, transcript);
      setResult(comparison);
      setStatus('feedback');
    };
    recognition.onerror = (event) => { console.error('语音识别错误:', event.error); setStatus('idle'); };
    recognition.onend = () => { if (status === 'listening') setStatus('idle'); };
    
    recognition.start();
    recognitionRef.current = recognition;
  }, [status, word]);
  
  return (
    <>
      <button onClick={handleMicClick} style={{...styles.micButton, ...(status === 'listening' ? styles.micListening : status === 'loading' ? styles.micLoading : styles.micIdle)}} disabled={status === 'loading'}>
        <FaMicrophone size={32} />
      </button>
      <div style={styles.feedbackContainer}>
        {status === 'feedback' && result.map((res, i) => (
          <span key={i} style={styles.feedbackSyllable}>
            <span style={styles[res.initial]}>{parsePinyin(res.syllable).initial}</span>
            <span style={styles[res.final]}>{parsePinyin(res.syllable).final}</span>
            <span style={styles[res.tone]}>{pinyinConverter(res.syllable, { toneType: 'mark' }).slice(-1)}</span>
          </span>
        ))}
      </div>
    </>
  );
};

const CardView = ({ cardData }) => {
  const { word, pinyin, meaning, example, aiExplanation } = cardData;
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [showWriter, setShowWriter] = useState(false);
  
  return (
    <div style={styles.cardContent}>
      {showWriter && <HanziWriterModal character={word} onClose={() => setShowWriter(false)}/>}
      <header style={styles.header}>
        <div style={styles.pinyin}>{pinyin}</div>
        <div style={styles.word}>{word}</div>
      </header>
      <section style={styles.practiceSection}>
        <PronunciationPractice word={word} pinyin={pinyin} />
      </section>
      
      {isDetailsVisible && (
         <animated.div style={styles.detailsPane}>
            <div style={styles.meaning}>{meaning}</div>
            <div style={styles.example} onClick={() => playTTS(example)}>
                <FaVolumeUp style={{ display: 'inline-block', marginRight: '8px', cursor: 'pointer' }}/>
                {example}
            </div>
            {aiExplanation && <div style={styles.explanation}>{aiExplanation}</div>}
         </animated.div>
      )}

      <footer style={styles.footer}>
        <button style={styles.detailsButton} onClick={() => setIsDetailsVisible(!isDetailsVisible)}>
          {isDetailsVisible ? '收起详情' : '查看详情'}
        </button>
        <button style={styles.detailsButton} onClick={() => setShowWriter(true)}>
          <FaPenFancy style={{ marginRight: '8px' }}/> 笔顺
        </button>
      </footer>
    </div>
  );
};

// 主组件，管理卡片堆栈
const CiDianKa = ({ flashcards = [] }) => {
  const [gone] = useState(() => new Set());
  const [props, api] = useSprings(flashcards.length, i => ({
    from: { x: 0, y: -1000, rot: -10, scale: 1.5 },
    to: { x: 0, y: i * -4, rot: -10 + i / 10, scale: 1 },
    delay: i * 100
  }));

  const bind = useDrag(({ args: [index], down, movement: [, my], direction: [, yDir], velocity }) => {
    const trigger = velocity > 0.2;
    const dir = yDir < 0 ? -1 : 1;
    if (!down && trigger) gone.add(index);
    api.start(i => {
      if (index !== i) return;
      const isGone = gone.has(index);
      const y = isGone ? (200 + window.innerHeight) * dir : down ? my : 0;
      const rot = my / 100 + (isGone ? dir * 10 * velocity : 0);
      const scale = down ? 1.1 : 1;
      return { y, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
    });
    if (!down && gone.size === flashcards.length) {
      setTimeout(() => {
        gone.clear();
        api.start(i => ({ to: { x: 0, y: i * -4, rot: -10 + i / 10, scale: 1 }, delay: i * 100 }));
      }, 600);
    }
  });

  if (!flashcards || flashcards.length === 0) {
      return <div>没有卡片数据。</div>
  }
  
  return (
    <div style={styles.wrapper}>
      {props.map((springProps, i) => (
        <animated.div key={i} style={{...styles.card, ...springProps}} {...bind(i)}>
          <CardView cardData={flashcards[i]} />
        </animated.div>
      ))}
       <style jsx global>{`
            @keyframes pulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
            }
        `}</style>
    </div>
  );
};

export default CiDianKa;
