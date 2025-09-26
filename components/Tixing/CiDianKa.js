// components/Tixing/CiDianKa.js (V12 - 最终交互与功能修复版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
// 引入新的独立 HanziModal 组件
import HanziModal from '@/components/HanziModal'; 

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#f5f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  container: { position: 'relative', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px' },
  animatedCardShell: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '1500px' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', background: 'linear-gradient(180deg,#ffffff,#eef6ff)', boxShadow: '0 30px 60px rgba(10,30,80,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))' },
  backFace: { transform: 'rotateY(180deg)' },
  // 主要内容区域，点击它来翻转卡片
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative' },
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.4rem', color: '#5b6b82', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: '#102035' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: 12, flexShrink: 0 },
  button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  // 左右导航按钮样式
  navButton: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '50%', width: '44px', height: '44px', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  // 语音识别反馈消息样式
  feedbackMessage: { marginTop: 12, color: '#4b5563', height: '24px' },
  example: { background: 'rgba(240,244,255,0.9)', padding: 12, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' },
  meaning: { fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  explanation: { marginTop: 10, fontStyle: 'italic', color: '#415161', borderLeft: '3px solid #3b82f6', paddingLeft: 10 },
};

// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

// ===================== 语音识别组件 =====================
const PronunciationPractice = ({ word }) => {
    const [status, setStatus] = useState('idle'); // idle | listening | processing
    const [feedbackMsg, setFeedbackMsg] = useState('点击麦克风开始发音');
    const recognitionRef = useRef(null);

    const handleListen = useCallback((e) => {
        e.stopPropagation(); // 阻止事件冒泡，防止触发卡片翻转

        if (status === 'listening') {
            recognitionRef.current?.stop(); // 手动停止识别
            setStatus('idle');
            setFeedbackMsg('识别已停止。');
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
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setFeedbackMsg(`识别出错: ${event.error}`);
            setStatus('idle');
        };
        recognition.onend = () => {
            if (status === 'listening') { // 如果不是由onerror结束的
                setStatus('idle');
            }
        };

        recognition.start();
        recognitionRef.current = recognition;
    }, [status, word]);
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <button
                onClick={handleListen} // 按钮点击事件
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
  const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: "示例", pinyin: "shì lì", meaning: "Example", example: "这是一个示例。", aiExplanation: "这是一个AI解释。" }];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writerChar, setWriterChar] = useState(null);
  const isAnimating = useRef(false); // 用于防止快速点击

  useEffect(() => {
    if (cards[currentIndex]?.word && !isFlipped) {
      const timer = setTimeout(() => playTTS(cards[currentIndex].word), 400); // 动画后播放
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
  
  const handleFlip = useCallback(() => {
    // if (isAnimating.current) return; // 翻转不应受切换动画影响
    setIsFlipped(prev => !prev);
  }, []);

  const transitions = useTransition(currentIndex, {
    key: currentIndex, // 确保 key 是 index，这样 useTransition 才能跟踪每个卡片
    from: { opacity: 0, transform: `translateX(100%) scale(0.8) rotateY(-30deg)` }, // 从右侧飞入并旋转
    enter: { opacity: 1, transform: `translateX(0%) scale(1) rotateY(0deg)` },
    leave: { opacity: 0, transform: `translateX(-100%) scale(0.8) rotateY(30deg)` }, // 向左侧飞出并旋转
    config: { tension: 280, friction: 30 },
  });

  return (
    <div style={styles.fullScreen}>
      {/* 左右切换按钮 - 不受卡片点击事件影响 */}
      <button style={{ ...styles.navButton, left: '10px' }} onClick={() => changeCard(-1)}><FaArrowLeft /></button>
      <button style={{ ...styles.navButton, right: '10px' }} onClick={() => changeCard(1)}><FaArrowRight /></button>
      
      {/* 笔顺Modal */}
      {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}

      <div style={styles.container}>
        {transitions((style, i) => {
          const cardData = cards[i];
          return (
            <animated.div style={{ ...styles.animatedCardShell, ...style }}>
              {/* 卡片翻转的核心容器 */}
              <div style={{ ...styles.cardInner, transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                {/* 卡片正面 */}
                <div style={styles.face}>
                   {/* mainContent 现在是翻转的点击区域 */}
                  <div style={styles.mainContent} onClick={handleFlip}>
                    <div style={styles.header}>
                      <div style={styles.pinyin}>{cardData.pinyin}</div>
                      <div style={styles.hanzi}>{cardData.word}</div>
                    </div>
                    {/* 语音识别组件现在可以被正常点击 */}
                    <PronunciationPractice word={cardData.word} />
                  </div>
                  <div style={styles.footer}>
                    {/* 底部按钮，都有独立的 onClick 事件，且不会触发翻转 */}
                    <button style={styles.button} onClick={(e) => { e.stopPropagation(); alert("点击卡片中间区域进行发音练习。"); }}><FaMicrophone /> 功能说明</button>
                    <button style={styles.button} onClick={(e) => { e.stopPropagation(); setWriterChar(cardData.word); }}><FaPenFancy /> 笔顺</button>
                    <button style={styles.button} onClick={(e) => { e.stopPropagation(); playTTS(cardData.word); }}><FaVolumeUp /> 朗读</button>
                  </div>
                </div>
                {/* 卡片背面 */}
                <div style={{ ...styles.face, ...styles.backFace }}>
                  {/* 背面主体内容，点击它也可以翻转回去 */}
                  <div style={styles.mainContent} onClick={handleFlip}>
                    <div style={styles.meaning}>{cardData.meaning}</div>
                    {cardData.example && (
                      <div style={styles.example}>
                         {/* 背面朗读按钮，阻止冒泡，只触发朗读 */}
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
