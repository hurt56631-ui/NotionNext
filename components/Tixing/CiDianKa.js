// components/Tixing/CiDianKa.js (V11 - 动画、交互与功能完全重构修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import HanziWriter from 'hanzi-writer';

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    perspective: '1500px',
  },
  cardInner: {
    position: 'relative', width: '100%', height: '100%',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.6s ease-in-out',
  },
  face: {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px',
    background: 'linear-gradient(180deg,#ffffff,#eef6ff)', boxShadow: '0 30px 60px rgba(10,30,80,0.12)',
    display: 'flex', flexDirection: 'column', padding: '28px',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))',
  },
  backFace: { transform: 'rotateY(180deg)' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' },
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.4rem', color: '#5b6b82', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: '#102035' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12, flexShrink: 0 },
  button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  interactionGrid: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
    zIndex: 10, display: 'grid', gridTemplateColumns: '1fr 3fr 1fr',
  },
  interactionZone: { cursor: 'pointer', height: '100%' },
  modalBackdrop: { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 10000 },
  modalBox: { background: '#fff', padding: 18, borderRadius: 12, width: '92%', maxWidth: 380 },
  example: { background: 'rgba(240,244,255,0.9)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' },
  meaning: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  explanation: { marginTop: 10, fontStyle: 'italic', color: '#415161', borderLeft: '3px solid #3b82f6', paddingLeft: 10 },
  feedbackMessage: { marginTop: 12, color: '#4b5563', height: '24px' },
};

// ===================== TTS & Hanzi Modal & Speech Recognition =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

const HanziModal = ({ char, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    let writer = null;
    // 关键修复：延迟执行确保DOM元素已准备好
    const tid = setTimeout(() => {
      if (!ref.current) return;
      ref.current.innerHTML = ''; // 清理旧的实例
      writer = HanziWriter.create(ref.current, char, { width: 260, height: 260, padding: 10, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 100 });
      writer.animateCharacter();
    }, 100);
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

const PronunciationPractice = ({ word }) => {
    const [status, setStatus] = useState('idle'); // idle | listening | processing
    const [feedbackMsg, setFeedbackMsg] = useState('点击麦克风开始发音');
    const recognitionRef = useRef(null);

    const handleListen = useCallback(() => {
        if (status === 'listening') {
            recognitionRef.current?.stop();
            setStatus('idle');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setFeedbackMsg('浏览器不支持语音识别');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;

        recognition.onstart = () => {
            setStatus('listening');
            setFeedbackMsg('请说话...');
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
            if (transcript === word) {
                setFeedbackMsg('太棒了，完全正确！');
            } else {
                setFeedbackMsg(`听起来像: "${transcript}"，再试试？`);
            }
        };
        recognition.onerror = (event) => setFeedbackMsg(`错误: ${event.error}`);
        recognition.onend = () => setStatus('idle');

        recognition.start();
        recognitionRef.current = recognition;
    }, [status, word]);
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <button
                onClick={handleListen}
                style={{ ...styles.button, background: status === 'listening' ? '#fecaca' : '#eef2ff' }}
            >
                <FaMicrophone /> {status === 'listening' ? '正在识别...' : '发音练习'}
            </button>
            <p style={styles.feedbackMessage}>{feedbackMsg}</p>
        </div>
    );
};

// ===================== 主组件 CiDianKa =====================
const CiDianKa = ({ flashcards = [] }) => {
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: "示例", pinyin: "shì lì", meaning: "Example", example: "这是一个示例。" }];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    if (!cards.length) return;
    const cardWord = cards[currentIndex]?.word;
    if (cardWord && !isFlipped) {
      const timer = setTimeout(() => playTTS(cardWord), 400); // 动画后播放
      return () => clearTimeout(timer);
    }
  }, [currentIndex, isFlipped, cards]);

  const changeCard = (direction) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    setIsFlipped(false); // 切换时总是回到正面
    const newIndex = (currentIndex + direction + cards.length) % cards.length;
    setCurrentIndex(newIndex);
    
    // 动画时长，防止快速点击
    setTimeout(() => { isAnimating.current = false; }, 500);
  };
  
  const handleFlip = useCallback(() => setIsFlipped(prev => !prev), []);

  const transitions = useTransition(currentIndex, {
    key: currentIndex,
    from: { opacity: 0, transform: `translateX(50%) scale(0.8) rotateY(-45deg)` },
    enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
    leave: { opacity: 0, transform: `translateX(-50%) scale(0.8) rotateY(45deg)` },
    config: { tension: 280, friction: 30 },
  });

  return (
    <div style={styles.fullScreen}>
      {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}
      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          return (
            <animated.div style={{ ...styles.animatedCardShell, ...style }}>
              <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* 正面 */}
                <div style={styles.face}>
                  <div style={styles.mainContent}>
                    {/* 交互层现在只在mainContent上 */}
                    <div style={styles.interactionGrid}>
                      <div style={styles.interactionZone} onClick={() => changeCard(-1)}></div>
                      <div style={styles.interactionZone} onClick={handleFlip}></div>
                      <div style={styles.interactionZone} onClick={() => changeCard(1)}></div>
                    </div>
                    <div style={styles.header}>
                      <div style={styles.pinyin}>{cardData.pinyin}</div>
                      <div style={styles.hanzi}>{cardData.word}</div>
                    </div>
                    <PronunciationPractice word={cardData.word} />
                  </div>
                  <div style={styles.footer}>
                    <button style={styles.button} onClick={() => alert("“发音练习”功能已集成在卡片中部。")}><FaMicrophone /> 功能说明</button>
                    <button style={styles.button} onClick={() => setWriterChar(cardData.word)}><FaPenFancy /> 笔顺</button>
                    <button style={styles.button} onClick={() => playTTS(cardData.word)}><FaVolumeUp /></button>
                  </div>
                </div>
                {/* 背面 */}
                <div style={{ ...styles.face, ...styles.backFace }} onClick={handleFlip}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <div style={styles.meaning}>{cardData.meaning}</div>
                    {cardData.example && (
                      <div style={styles.example}>
                        <div onClick={(e) => { e.stopPropagation(); playTTS(cardData.example); }} style={{cursor: 'pointer'}}>
                           <FaVolumeUp />
                        </div>
                        <div style={{marginLeft: '8px'}}>{cardData.example}</div>
                      </div>
                    )}
                    {cardData.aiExplanation && <div style={styles.explanation}>{cardData.aiExplanation}</div>}
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
