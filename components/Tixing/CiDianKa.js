// components/Tixing/CiDianKa.js (V15 - 终极修复美化版)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// ===================== 美化：渐变色背景 =====================
const gradients = [
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
];

// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deck: { position: 'absolute', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' },
  cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 20px))' },
  backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto' },
  header: { textAlign: 'center' },
  pinyin: { fontSize: '1.4rem', color: '#4a5568', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: 12, flexShrink: 0 },
  button: { background: 'rgba(255, 255, 255, 0.5)', color: '#2d3748', border: '1px solid rgba(0, 0, 0, 0.05)', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', backdropFilter: 'blur(5px)' },
  feedbackArea: { width: '100%', minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  feedbackMessage: { color: '#4b5563', height: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' },
  feedbackPinyinRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10, gap: '8px' },
  feedbackPinyinSyllable: { padding: '6px 12px', borderRadius: '8px', fontSize: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  example: { background: 'rgba(240,244,255,0.7)', padding: '12px 16px', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', width: '100%', maxWidth: '400px', textAlign: 'left' },
  meaning: { fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 10 },
};

// ===================== TTS 管理 =====================
let _howlInstance = null;
const playTTS = (text) => {
  if (!text) return;
  try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {}
  _howlInstance = new Howl({ src: [`https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15`], html5: true });
  _howlInstance.play();
};

// ===================== 主组件 CiDianKa (完全重构) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: "示例", pinyin: "shì lì", meaning: "Example", example: "这是一个示例。" }];
    
    // 状态管理
    const [gone] = useState(() => new Set());
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [speechResult, setSpeechResult] = useState({ msg: '', pinyin: [], transcript: '' });
    const recognitionRef = useRef(null);
    const [recognitionStatus, setRecognitionStatus] = useState('idle');

    // 动画配置
    const to = (i) => ({ x: 0, y: -i * 4, scale: 1, rot: -10 + Math.random() * 20, delay: i * 100 });
    const from = (_i) => ({ x: 0, rot: 0, scale: 1.5, y: -1000 });
    const [props, api] = useSprings(cards.length, i => ({ ...to(i), from: from(i) }));
    
    // 语音识别逻辑
    const handleListen = useCallback((e) => {
        e.stopPropagation(); // 关键修复：阻止事件冒泡
        if (recognitionStatus === 'listening') {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechResult({ msg: '浏览器不支持语音识别', pinyin: [], transcript: '' });
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;

        recognition.onstart = () => { setRecognitionStatus('listening'); setSpeechResult({ msg: '请说话...', pinyin: [], transcript: '' }); };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
            const correctWord = cards[gone.size]?.word;
            const pinyinFeedback = (pinyinConverter(correctWord, { type: 'array' }) || []).map((correct, i) => {
                const spoken = (pinyinConverter(transcript, { type: 'array' }) || [])[i] || '';
                return { correct, spoken, status: correct === spoken ? 'correct' : 'incorrect' };
            });
            setSpeechResult({ msg: pinyinFeedback.every(p => p.status === 'correct') ? '完全正确！' : '请看对比结果', pinyin: pinyinFeedback, transcript });
        };
        recognition.onerror = (err) => { setSpeechResult({ msg: `识别出错: ${err.error}`, pinyin: [], transcript: '' }); setRecognitionStatus('idle'); };
        recognition.onend = () => setRecognitionStatus('idle');
        recognition.start();
    }, [recognitionStatus, cards, gone.size]);
    
    // 手势绑定
    const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        const trigger = vx > 0.2;
        const dir = xDir < 0 ? -1 : 1;
        if (!down && trigger) gone.add(index);
        
        api.start(i => {
            if (index !== i) return;
            const isGone = gone.has(index);
            const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
            const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
            const scale = down ? 1.1 : 1;
            return { x, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
        });

        if (!down && gone.size === cards.length) {
            setTimeout(() => {
                gone.clear();
                api.start(i => to(i));
            }, 600);
        }
    });

    // 播放当前卡片语音
    useEffect(() => {
        const currentCard = cards[gone.size];
        if (currentCard && !isFlipped) {
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [gone.size, isFlipped, cards]);

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />}
            <div style={styles.container}>
                {props.map(({ x, y, rot, scale }, i) => (
                    <animated.div style={{ ...styles.deck, x, y }} key={i}>
                        <animated.div {...bind(i)} style={{ transform: scale.to(s => `scale(${s}) rotateZ(${rot}deg)`), width: '100%', height: '100%', cursor: 'grab' }}>
                            <div style={{...styles.cardInner, transform: isFlipped && i === gone.size ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                {/* 正面 */}
                                <div style={{...styles.face, background: gradients[i % gradients.length]}}>
                                    <div style={styles.mainContent}>
                                        <div style={styles.header}>
                                            <div style={styles.pinyin}>{cards[i].pinyin}</div>
                                            <div style={styles.hanzi}>{cards[i].word}</div>
                                        </div>
                                        <div style={styles.feedbackArea}>
                                            <div style={styles.feedbackMessage}>
                                                {speechResult.msg}
                                                {speechResult.transcript && <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(speechResult.transcript)}}/>}
                                            </div>
                                            <div style={styles.feedbackPinyinRow}>
                                                {speechResult.pinyin.map((syl, idx) => (
                                                    <div key={idx} style={{...styles.feedbackPinyinSyllable, background: syl.status === 'correct' ? '#dcfce7' : '#fee2e2', color: syl.status === 'correct' ? '#166534' : '#991b1b'}}>
                                                        <span>{syl.correct}</span><span style={{fontSize: '0.9rem', opacity: 0.7}}>{syl.spoken}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.footer}>
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <button style={styles.button} onClick={handleListen}>
                                                <FaMicrophone /> {recognitionStatus === 'listening' ? '结束识别' : '发音练习'}
                                            </button>
                                            <button style={styles.button} onClick={(e)=>{e.stopPropagation(); setWriterChar(cards[i].word)}}>
                                                <FaPenFancy /> 笔顺
                                            </button>
                                        </div>
                                        <button style={styles.button} onClick={(e)=>{e.stopPropagation(); playTTS(cards[i].word)}}><FaVolumeUp /></button>
                                    </div>
                                </div>
                                {/* 背面 */}
                                <div style={{...styles.face, ...styles.backFace}}>
                                    <div style={styles.mainContent}>
                                        <div style={{...styles.header, marginBottom: '20px'}}>
                                            <div style={styles.pinyin}>{cards[i].pinyin}</div>
                                            <div style={styles.hanzi}>{cards[i].word}</div>
                                        </div>
                                        <div style={{...styles.meaning}}>
                                            {cards[i].meaning}
                                            <FaVolumeUp style={{cursor: 'pointer', marginLeft: '10px'}} onClick={(e)=>{e.stopPropagation(); playTTS(cards[i].meaning)}}/>
                                        </div>
                                        {cards[i].example && <div style={{...styles.example, marginTop: '20px'}}>
                                            <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(cards[i].example)}}/> {cards[i].example}
                                        </div>}
                                    </div>
                                </div>
                            </div>
                        </animated.div>
                    </animated.div>
                ))}
            </div>
        </div>
    );
};

export default CiDianKa;
