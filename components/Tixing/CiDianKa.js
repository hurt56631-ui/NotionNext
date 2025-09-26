// components/Tixing/CiDianKa.js (V16 - 终极修复美化版)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaPlay } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';

// ... (样式和辅助函数)
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
  feedbackMessage: { color: '#4b5563', height: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '10px' },
  feedbackPinyinRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' },
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

// ===================== 语音识别与录音组件 =====================
const PronunciationPractice = ({ word, onResult }) => {
    const [status, setStatus] = useState('idle'); // idle | listening | processing
    const [feedback, setFeedback] = useState({ msg: '', pinyin: [], audioBlob: null });
    
    const recognitionRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const comparePinyin = (correctWord, spokenText) => {
        const correctPinyin = pinyinConverter(correctWord, { type: 'array' });
        const spokenPinyin = pinyinConverter(spokenText, { type: 'array' });
        return correctPinyin.map((correct, i) => {
            const spoken = spokenPinyin[i] || '';
            const cParsed = parsePinyin(correct);
            const sParsed = parsePinyin(spoken);
            return {
                correct,
                spoken,
                initialMatch: cParsed.initial === sParsed.initial,
                finalMatch: cParsed.final === sParsed.final,
                toneMatch: cParsed.tone === sParsed.tone,
            };
        });
    };

    const handleListen = useCallback(async (e) => {
        e.stopPropagation();
        if (status === 'listening') {
            mediaRecorderRef.current?.stop();
            recognitionRef.current?.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                onResult({ msg: '浏览器不支持语音识别', pinyin: [], audioBlob: null });
                return;
            }

            // --- Setup MediaRecorder for recording ---
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = event => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setFeedback(prev => ({ ...prev, audioBlob }));
                stream.getTracks().forEach(track => track.stop()); // Stop microphone access
            };

            // --- Setup SpeechRecognition ---
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.lang = 'zh-CN';
            recognition.onstart = () => { setStatus('listening'); onResult({ msg: '请说话...', pinyin: [], audioBlob: null }); };
            recognition.onresult = event => {
                const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
                const pinyinFeedback = comparePinyin(word, transcript);
                const allCorrect = pinyinFeedback.every(p => p.initialMatch && p.finalMatch && p.toneMatch);
                onResult({ msg: allCorrect ? '完全正确！' : '请看对比结果', pinyin: pinyinFeedback, audioBlob: feedback.audioBlob });
            };
            recognition.onerror = err => { onResult({ msg: `识别出错: ${err.error}`, pinyin: [], audioBlob: null }); setStatus('idle'); };
            recognition.onend = () => setStatus('idle');

            // Start both
            recognition.start();
            mediaRecorderRef.current.start();

        } catch (err) {
            console.error("Error accessing microphone:", err);
            onResult({ msg: '无法访问麦克风', pinyin: [], audioBlob: null });
        }
    }, [status, word, onResult]);

    return (
        <button style={styles.button} onClick={handleListen}>
            <FaMicrophone /> {status === 'listening' ? '结束识别' : '发音练习'}
        </button>
    );
};


// ===================== 主组件 CiDianKa =====================
const CiDianKa = ({ flashcards = [] }) => {
    // 自动生成拼音
    const processedCards = useMemo(() => 
        flashcards.map(card => ({
            ...card,
            pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
        })), 
    [flashcards]);

    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "Example" }];
    
    const [gone] = useState(() => new Set());
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [speechResult, setSpeechResult] = useState({ msg: '', pinyin: [], audioBlob: null });

    const to = (i) => ({ x: 0, y: -i * 4, scale: 1, rot: -10 + Math.random() * 20, delay: i * 100 });
    const from = (_i) => ({ x: 0, rot: 0, scale: 1.5, y: -1000 });
    const [props, api] = useSprings(cards.length, i => ({ ...to(i), from: from(i) }));
    
    const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
        if (tap) {
            setIsFlipped(prev => !prev);
            return;
        }
        if (isFlipped) return; // 背面不允许滑动

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

    useEffect(() => {
        const currentCard = cards[gone.size];
        if (currentCard && !isFlipped) {
            setSpeechResult({ msg: '', pinyin: [], audioBlob: null }); // 切换卡片时清空语音结果
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [gone.size, isFlipped, cards]);

    return (
        <div style={styles.fullScreen}>
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            <div style={styles.container}>
                {props.map(({ x, y, rot, scale }, i) => {
                    const cardData = cards[i];
                    return (
                        <animated.div style={{ ...styles.deck, x, y }} key={i}>
                            <animated.div {...bind(i)} style={{ transform: scale.to(s => `scale(${s}) rotateZ(${rot}deg)`), width: '100%', height: '100%', cursor: 'grab' }}>
                                <div style={{...styles.cardInner, transform: isFlipped && i === gone.size ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                    {/* 正面 */}
                                    <div style={{...styles.face, background: gradients[i % gradients.length]}}>
                                        <div style={styles.mainContent}>
                                            <div style={styles.header}>
                                                <div style={styles.pinyin}>{cardData.pinyin}</div>
                                                <div style={styles.hanzi}>{cardData.word}</div>
                                            </div>
                                            <div style={styles.feedbackArea}>
                                                <div style={styles.feedbackMessage}>
                                                    {speechResult.msg}
                                                    {speechResult.audioBlob && <FaPlay style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); new Audio(URL.createObjectURL(speechResult.audioBlob)).play()}}/>}
                                                </div>
                                                <div style={styles.feedbackPinyinRow}>
                                                    {speechResult.pinyin.map((syl, idx) => (
                                                        <div key={idx} style={{...styles.feedbackPinyinSyllable, background: syl.initialMatch && syl.finalMatch && syl.toneMatch ? '#dcfce7' : '#fee2e2', color: syl.initialMatch && syl.finalMatch && syl.toneMatch ? '#166534' : '#991b1b'}}>
                                                            <span>{syl.correct}</span><span style={{fontSize: '0.9rem', opacity: 0.7}}>{syl.spoken}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={styles.footer}>
                                            <PronunciationPractice word={cardData.word} onResult={setSpeechResult} />
                                            <button style={styles.button} onClick={(e)=>{e.stopPropagation(); setWriterChar(cardData.word)}}>
                                                <FaPenFancy /> 笔顺
                                            </button>
                                            <button style={styles.button} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.word)}}><FaVolumeUp /></button>
                                        </div>
                                    </div>
                                    {/* 背面 */}
                                    <div style={{...styles.face, ...styles.backFace}}>
                                        <div style={styles.mainContent}>
                                            <div style={{...styles.header, marginBottom: '20px'}}>
                                                <div style={styles.pinyin}>{cardData.pinyin}</div>
                                                <div style={styles.hanzi}>{cardData.word}</div>
                                            </div>
                                            <div style={{...styles.meaning}}>
                                                {cardData.meaning}
                                                <FaVolumeUp style={{cursor: 'pointer', marginLeft: '10px'}} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.meaning)}}/>
                                            </div>
                                            {cardData.example && <div style={{...styles.example, marginTop: '20px'}}>
                                                <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.example)}}/> {cardData.example}
                                            </div>}
                                        </div>
                                    </div>
                                </div>
                            </animated.div>
                        </animated.div>
                    )
                })}
            </div>
        </div>
    );
};

export default CiDianKa;
