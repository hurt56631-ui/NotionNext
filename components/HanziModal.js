
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
