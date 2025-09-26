// components/Tixing/CiDianKa.js (V18.1 - 终极修复版：修复编译错误)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'; // <<<< 关键修复：在这里添加了 useCallback
import { useSprings, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Howl } from 'howler';
import { FaMicrophone, FaPenFancy, FaVolumeUp, FaCog, FaImages, FaPlay } from 'react-icons/fa';
import { pinyin as pinyinConverter, parse as parsePinyin } from 'pinyin-pro';
import HanziModal from '@/components/HanziModal';
import AdComponent from '@/components/AdComponent';

// ===================== 美化：渐变色背景 =====================
const gradients = [
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
];
// ===================== 样式 =====================
const styles = {
  fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' },
  container: { position: 'relative', width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deck: { position: 'absolute', width: '92%', maxWidth: '900px', height: '100%', willChange: 'transform', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' },
  cardContainer: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.12)' },
  cardInner: { position: 'relative', width: '100%', height: '100%', flex: 1, transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' },
  face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', color: '#1a202c', display: 'flex', flexDirection: 'column', padding: '28px', backgroundSize: 'cover', backgroundPosition: 'center' },
  backFace: { transform: 'rotateY(180deg)', background: '#ffffff' },
  mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto', cursor: 'grab' },
  header: { textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  pinyin: { fontSize: '1.4rem', color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05, color: 'white' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', paddingTop: 12, flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '12px 28px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' },
  button: { background: 'rgba(0,0,0,0.1)', color: '#4a5568', border: 'none', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' },
  settingsModal: { position: 'absolute', bottom: '110px', right: '20px', background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 100 },
  feedbackArea: { width: '100%', minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  feedbackMessage: { color: 'white', height: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', marginBottom: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.2)' },
  feedbackPinyinRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' },
  feedbackPinyinSyllable: { padding: '6px 12px', borderRadius: '8px', fontSize: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.8)' },
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
    const [status, setStatus] = useState('idle');
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
            return { correct, spoken, initialMatch: cParsed.initial === sParsed.initial, finalMatch: cParsed.final === sParsed.final, toneMatch: cParsed.tone === sParsed.tone };
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
            if (!SpeechRecognition) { onResult({ msg: '浏览器不支持语音识别', pinyin: [], audioBlob: null }); return; }
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = event => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                onResult(prev => ({ ...prev, audioBlob }));
                stream.getTracks().forEach(track => track.stop());
            };

            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.lang = 'zh-CN';
            recognition.onstart = () => { setStatus('listening'); onResult({ msg: '请说话...', pinyin: [], audioBlob: null }); };
            recognition.onresult = event => {
                const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
                const pinyinFeedback = comparePinyin(word, transcript);
                const allCorrect = pinyinFeedback.every(p => p.initialMatch && p.finalMatch && p.toneMatch);
                onResult(prev => ({ ...prev, msg: allCorrect ? '完全正确！' : '请看对比结果', pinyin: pinyinFeedback }));
            };
            recognition.onerror = err => { onResult({ msg: `识别出错: ${err.error}`, pinyin: [], audioBlob: null }); setStatus('idle'); };
            recognition.onend = () => setStatus('idle');

            recognition.start();
            mediaRecorderRef.current.start();

        } catch (err) { onResult({ msg: '无法访问麦克风', pinyin: [], audioBlob: null }); }
    }, [status, word, onResult]);

    return ( <button style={{...styles.button, background: 'rgba(255,255,255,0.2)'}} onClick={handleListen}> <FaMicrophone /> {status === 'listening' ? '结束识别' : '发音练习'} </button> );
};

// ===================== 主组件 CiDianKa (V18 重构版) =====================
const CiDianKa = ({ flashcards = [] }) => {
    const processedCards = useMemo(() => flashcards.map(card => ({
        ...card, pinyin: card.pinyin || pinyinConverter(card.word, { toneType: 'mark', separator: ' ' })
    })), [flashcards]);
    const cards = processedCards.length > 0 ? processedCards : [{ word: "示例", pinyin: "shì lì", meaning: "Example" }];
    
    const [gone] = useState(() => new Set());
    const [isFlipped, setIsFlipped] = useState(false);
    const [writerChar, setWriterChar] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [customBgs, setCustomBgs] = useState([]);
    const fileInputRef = useRef(null);
    const [adKey, setAdKey] = useState(0);
    const [speechResult, setSpeechResult] = useState({ msg: '', pinyin: [], audioBlob: null });

    const to = (i) => ({ x: 0, y: -i * 4, scale: 1 - i * 0.05, rot: 0, zIndex: i });
    const from = (_i) => ({ x: 0, rot: 0, scale: 1.5, y: -1000, zIndex: 0 });
    const [props, api] = useSprings(cards.length, i => ({ ...to(i), from: from(i) }));
    
    const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => {
        if (tap) { setIsFlipped(prev => !prev); return; }
        if (isFlipped) return;

        const trigger = vx > 0.2;
        const dir = xDir < 0 ? -1 : 1;
        if (!down && trigger) gone.add(index);
        
        api.start(i => {
            if (index !== i) return;
            const isGone = gone.has(index);
            if (isGone) setIsFlipped(false);
            const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
            const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
            const scale = down ? 1.05 : 1;
            return { x, rot, scale, zIndex: down ? cards.length : i, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
        });

        if (!down && gone.size === cards.length) {
            setTimeout(() => { gone.clear(); api.start(i => to(i)); }, 600);
        }
    });

    useEffect(() => {
        const currentCard = cards[gone.size];
        if (currentCard && !isFlipped) {
            setSpeechResult({ msg: '', pinyin: [], audioBlob: null });
            const timer = setTimeout(() => playTTS(currentCard.word), 400);
            return () => clearTimeout(timer);
        }
    }, [gone.size, isFlipped, cards]);
    
    useEffect(() => { setAdKey(k => k + 1); }, [gone.size, isFlipped]);

    const handleBgUpload = (event) => {
        const files = Array.from(event.target.files);
        const imageUrls = files.map(file => URL.createObjectURL(file));
        setCustomBgs(imageUrls);
        setShowSettings(false);
    };

    return (
        <div style={styles.fullScreen}>
            <AdComponent key={adKey} />
            {writerChar && <HanziModal word={writerChar} onClose={() => setWriterChar(null)} />}
            <div style={styles.container}>
                {props.map(({ x, y, rot, scale, zIndex }, i) => {
                    if (i < gone.size - 2 || i > gone.size + 3) return null;
                    const cardData = cards[i];
                    const isCurrent = i === gone.size;
                    const backgroundStyle = { backgroundImage: customBgs.length > 0 ? `url(${customBgs[i % customBgs.length]})` : gradients[i % gradients.length], boxShadow: customBgs.length > 0 ? 'inset 0 0 0 2000px rgba(0,0,0,0.3)' : '' };

                    return (
                        <animated.div style={{ ...styles.deck, x, y, zIndex }} key={i}>
                            <div style={styles.cardContainer}>
                                <animated.div {...(isCurrent ? bind(i) : {})} style={{ transform: scale.to(s => `scale(${s}) rotateZ(${rot}deg)`), flex: 1 }}>
                                    <div style={{...styles.cardInner, transform: isFlipped && isCurrent ? 'rotateY(180deg)' : 'rotateY(0deg)'}}>
                                        <div style={{...styles.face, ...backgroundStyle}}>
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
                                                        {speechResult.pinyin.map((syl, idx) => (<div key={idx} style={{...styles.feedbackPinyinSyllable}}><span style={{color: syl.initialMatch ? 'green' : 'red'}}>{parsePinyin(syl.correct).initial}</span><span style={{color: syl.finalMatch ? 'green' : 'red'}}>{parsePinyin(syl.correct).final}</span><span style={{color: syl.toneMatch ? 'green' : 'red'}}>{parsePinyin(syl.correct).tone}</span><span style={{fontSize: '0.8rem', opacity: 0.7}}>{syl.spoken}</span></div>))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{...styles.face, ...styles.backFace}} onClick={() => isFlipped && setIsFlipped(false)}>
                                            <div style={styles.mainContent}>
                                                <div style={{...styles.meaning, color: '#2d3748'}}>{cardData.meaning} <FaVolumeUp style={{cursor: 'pointer'}} onClick={(e)=>{e.stopPropagation(); playTTS(cardData.meaning)}}/></div>
                                            </div>
                                        </div>
                                    </div>
                                </animated.div>
                                {isCurrent && (
                                    <div style={styles.footer}>
                                        <PronunciationPractice word={cardData.word} onResult={setSpeechResult} />
                                        <button style={styles.button} onClick={() => setWriterChar(cardData.word)}><FaPenFancy /></button>
                                        <button style={styles.button} onClick={() => playTTS(cardData.word)}><FaVolumeUp /></button>
                                        <button style={styles.button} onClick={() => setShowSettings(s => !s)}><FaCog /></button>
                                    </div>
                                )}
                            </div>
                        </animated.div>
                    )
                })}
            </div>
            {showSettings && (
                <div style={styles.settingsModal}>
                    <input type="file" ref={fileInputRef} onChange={handleBgUpload} multiple accept="image/*" style={{display: 'none'}} />
                    <button style={{...styles.button, background: '#e2e8f0', color: '#2d3748'}} onClick={() => fileInputRef.current.click()}> <FaImages /> 上传背景图 </button>
                </div>
            )}
        </div>
    );
};

export default CiDianKa;
