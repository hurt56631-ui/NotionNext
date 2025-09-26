// File: components/Tixing/CiDianKa.js (V17 - 修复 & 优化)

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'; import { useSprings, animated } from '@react-spring/web'; import { useDrag } from '@use-gesture/react'; import { Howl } from 'howler'; import { FaMicrophone, FaPenFancy, FaVolumeUp } from 'react-icons/fa'; import { pinyin as pinyinConverter } from 'pinyin-pro'; import HanziModal from '@/components/HanziModal';

const gradients = [ 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', ];

const styles = { fullScreen: { position: 'fixed', inset: 0, zIndex: 9999, background: '#e9eef3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }, container: { position: 'relative', width: '100%', height: '100%' }, deck: { position: 'absolute', width: '92%', maxWidth: '900px', height: '86%', maxHeight: '720px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, cardInner: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-in-out' }, face: { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: '20px', color: '#1a202c', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', padding: '28px' }, backFace: { transform: 'rotateY(180deg)', background: '#ffffff' }, mainContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', overflowY: 'auto' }, header: { textAlign: 'center' }, pinyin: { fontSize: '1.4rem', color: '#4a5568', marginBottom: 6 }, hanzi: { fontSize: '5.6rem', fontWeight: 800, lineHeight: 1.05 }, footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: 12, flexShrink: 0 }, button: { background: 'rgba(255, 255, 255, 0.5)', color: '#2d3748', border: '1px solid rgba(0, 0, 0, 0.05)', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', backdropFilter: 'blur(5px)' }, feedbackArea: { width: '100%', minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }, feedbackMessage: { color: '#4b5563', height: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }, feedbackPinyinRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10, gap: '8px' }, feedbackPinyinSyllable: { padding: '6px 12px', borderRadius: '8px', fontSize: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }, example: { background: 'rgba(240,244,255,0.7)', padding: '12px 16px', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center', width: '100%', maxWidth: '400px', textAlign: 'left' }, meaning: { fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 10 }, };

let _howlInstance = null; const playTTS = (text) => { if (!text) return; try { if (_howlInstance?.playing()) _howlInstance.stop(); } catch (e) {} _howlInstance = new Howl({ src: [https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoyouNeural&r=-15], html5: true }); _howlInstance.play(); };

const CiDianKa = ({ flashcards = [] }) => { const cards = Array.isArray(flashcards) && flashcards.length ? flashcards : [{ word: '示例', pinyin: 'shì lì', meaning: 'Example', example: '这是一个示例。' }];

const [gone] = useState(() => new Set()); const [isFlipped, setIsFlipped] = useState(false); const [writerChar, setWriterChar] = useState(null); const [speechResult, setSpeechResult] = useState({ msg: '', pinyin: [], transcript: '' }); const recognitionRef = useRef(null); const [recognitionStatus, setRecognitionStatus] = useState('idle');

const to = (i) => ({ x: 0, y: -i * 4, scale: 1, rot: -10 + Math.random() * 20, delay: i * 100 }); const from = () => ({ x: 0, rot: 0, scale: 1.5, y: -1000 }); const [props, api] = useSprings(cards.length, i => ({ ...to(i), from: from(i) }));

const handleListen = useCallback((e) => { e?.stopPropagation(); if (recognitionStatus === 'listening') { recognitionRef.current?.stop(); return; } const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition); if (!SpeechRecognition) { setSpeechResult({ msg: '浏览器不支持语音识别', pinyin: [], transcript: '' }); return; } const recognition = new SpeechRecognition(); recognitionRef.current = recognition; recognition.lang = 'zh-CN'; recognition.interimResults = false;

recognition.onstart = () => { setRecognitionStatus('listening'); setSpeechResult({ msg: '请说话...', pinyin: [], transcript: '' }); };
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript.trim().replace(/[.,。，]/g, '');
  const correctWord = cards[gone.size]?.word || '';
  const correctPinyinArr = (pinyinConverter(correctWord, { type: 'array' }) || []);
  const spokenPinyinArr = (pinyinConverter(transcript, { type: 'array' }) || []);
  const pinyinFeedback = correctPinyinArr.map((correct, i) => ({ correct, spoken: spokenPinyinArr[i] || '', status: correct === (spokenPinyinArr[i] || '') ? 'correct' : 'incorrect' }));
  setSpeechResult({ msg: pinyinFeedback.every(p => p.status === 'correct') ? '完全正确！' : '请看对比结果', pinyin: pinyinFeedback, transcript });
};
recognition.onerror = (err) => { setSpeechResult({ msg: `识别出错: ${err.error}`, pinyin: [], transcript: '' }); setRecognitionStatus('idle'); };
recognition.onend = () => setRecognitionStatus('idle');
recognition.start();

}, [recognitionStatus, cards, gone.size]);

const bind = useDrag(({ args: [index], down, movement: [mx], direction: [xDir], velocity: [vx], tap }) => { if (tap) { setIsFlipped(prev => !prev); return; } const trigger = vx > 0.2; const dir = xDir < 0 ? -1 : 1; if (!down && trigger) gone.add(index);

api.start(i => {
  if (index !== i) return;
  const isGone = gone.has(index);
  const x = isGone ? (200 + window.innerWidth) * dir : down ? mx : 0;
  const rot = mx / 100 + (isGone ? dir * 10 * vx : 0);
  const scale = down ? 1.1 : 1;
  return { x, rot, scale, delay: undefined, config: { friction: 50, tension: down ? 800 : isGone ? 200 : 500 } };
});

if (!down && gone.size === cards.length) {
  setTimeout(() => { gone.clear(); api.start(i => to(i)); }, 600);
}

});

useEffect(() => { const currentCard = cards[gone.size]; if (currentCard && !isFlipped) { const timer = setTimeout(() => playTTS(currentCard.word), 400); return () => clearTimeout(timer); } }, [gone.size, isFlipped, cards]);

return ( <div style={styles.fullScreen}> {writerChar && <HanziModal char={writerChar} onClose={() => setWriterChar(null)} />} <div style={styles.container}> {props.map(({ x, y, rot, scale }, i) => ( <animated.div style={{ ...styles.deck, x, y }} key={i}> <animated.div {...bind(i)} style={{ transform: scale.to(s => scale(${s}) rotateZ(${rot}deg)), width: '100%', height: '100%', cursor: 'grab' }}> <div style={{ ...styles.cardInner, transform: isFlipped && i === gone.size ? 'rotateY(180deg)' : 'rotateY(0deg)' }}> <div style={{ ...styles.face, background: gradients[i % gradients.length] }}> <div style={styles.mainContent}> <div style={styles.header}> <div style={styles.pinyin}>{cards[i].pinyin}</div> <div style={styles.hanzi}>{cards[i].word}</div> </div> <div style={styles.feedbackArea}> <div style={styles.feedbackMessage}> {speechResult.msg} {speechResult.transcript && <FaVolumeUp style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); playTTS(speechResult.transcript); }} />} </div> <div style={styles.feedbackPinyinRow}> {speechResult.pinyin.map((syl, idx) => ( <div key={idx} style={{ ...styles.feedbackPinyinSyllable, background: syl.status === 'correct' ? '#dcfce7' : '#fee2e2', color: syl.status === 'correct' ? '#166534' : '#991b1b' }}> <span>{syl.correct}</span> <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{syl.spoken}</span> </div> ))} </div> </div> </div> <div style={styles.footer}> <div style={{ display: 'flex', gap: '10px' }}> <button style={styles.button} onClick={handleListen}> <FaMicrophone /> {recognitionStatus === 'listening' ? '结束识别' : '发音练习'} </button> <button style={styles.button} onClick={(e) => { e.stopPropagation(); setWriterChar(cards[i].word); }}> <FaPenFancy /> 笔顺 </button> </div> <button style={styles.button} onClick={(e) => { e.stopPropagation(); playTTS(cards[i].word); }}><FaVolumeUp /></button> </div> </div> <div style={{ ...styles.face, ...styles.backFace }}> <div style={styles.mainContent}> <div style={{ ...styles.header, marginBottom: '20px' }}> <div style={styles.pinyin}>{cards[i].pinyin}</div> <div style={styles.hanzi}>{cards[i].word}</div> </div> <div style={styles.meaning}> {cards[i].meaning} <FaVolumeUp style={{ cursor: 'pointer', marginLeft: '10px' }} onClick={(e) => { e.stopPropagation(); playTTS(cards[i].meaning); }} /> </div> {cards[i].example && <div style={{ ...styles.example, marginTop: '20px' }}> <FaVolumeUp style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); playTTS(cards[i].example); }} /> {cards[i].example} </div>} </div> </div> </div> </animated.div> </animated.div> ))} </div> </div> ); };

export default CiDianKa;

// File: components/HanziModal.js (V2 - 支持多字 & 动态导入，修复笔顺不生效问题)

'use client'

import React, { useEffect, useRef, useState } from 'react';

const styles = { backdrop: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }, modal: { background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '92%', maxWidth: '420px' }, writerTarget: { width: '300px', height: '300px', margin: '8px auto', border: '1px solid #eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, controls: { display: 'flex', gap: '8px', marginTop: '14px' }, button: { background: '#eef2ff', color: '#0f172a', border: 'none', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' } };

const isChineseChar = (c) => /[\u4e00-\u9fff]/.test(c);

const HanziModal = ({ char = '', onClose }) => { const writerRef = useRef(null); const writerInstanceRef = useRef(null); const [currentIndex, setCurrentIndex] = useState(0); const [charList, setCharList] = useState([]);

useEffect(() => { // 构建仅包含汉字的字符数组；若没有汉字则使用原始字符串第一个字符 const arr = Array.from(String(char)).filter(isChineseChar); setCharList(arr.length ? arr : [String(char).charAt(0) || '']); setCurrentIndex(0); }, [char]);

useEffect(() => { let cancelled = false; if (!charList.length) return; if (!writerRef.current) return;

// 清空旧的 DOM
writerRef.current.innerHTML = '';
writerInstanceRef.current = null;

const charToShow = charList[currentIndex];

(async () => {
  try {
    const mod = await import('hanzi-writer');
    const HanziWriter = mod?.default || mod;
    if (cancelled) return;
    // safety check
    if (!writerRef.current) return;
    // create writer
    const writer = HanziWriter.create(writerRef.current, charToShow, {
      width: 300,
      height: 300,
      padding: 5,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 100,
      showCharacter: true,
    });
    writerInstanceRef.current = writer;
    // small timeout to ensure render
    setTimeout(() => { try { writer.animateCharacter(); } catch (e) { console.error('animateCharacter error', e); } }, 50);
  } catch (err) {
    console.error('HanziWriter import or init failed:', err);
  }
})();

return () => {
  cancelled = true;
  try { if (writerRef.current) writerRef.current.innerHTML = ''; } catch (e) {}
  writerInstanceRef.current = null;
};

}, [charList, currentIndex]);

const handleReplay = (e) => { e?.stopPropagation(); writerInstanceRef.current?.animateCharacter(); }; const handlePrev = (e) => { e?.stopPropagation(); setCurrentIndex(i => Math.max(0, i - 1)); }; const handleNext = (e) => { e?.stopPropagation(); setCurrentIndex(i => Math.min(charList.length - 1, i + 1)); };

return ( <div style={styles.backdrop} onClick={onClose}> <div style={styles.modal} onClick={(e) => e.stopPropagation()}> <h3 style={{ margin: 0 }}>汉字笔顺: {charList[currentIndex] || ''}</h3> <div ref={writerRef} style={styles.writerTarget} /> <div style={{ marginTop: 8 }}>第 {currentIndex + 1} / {charList.length}</div> <div style={styles.controls}> <button style={styles.button} onClick={handlePrev} disabled={currentIndex === 0}>上一个</button> <button style={styles.button} onClick={handleReplay}>重播</button> <button style={styles.button} onClick={handleNext} disabled={currentIndex === charList.length - 1}>下一个</button> <button style={styles.button} onClick={(e) => { e.stopPropagation(); onClose?.(); }}>关闭</button> </div> </div> </div> ); };

export default HanziModal;

