// components/HanziModal.js - 独立的汉字笔顺动画组件

import React, { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

const styles = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  modal: {
    background: 'white', padding: '25px', borderRadius: '16px',
    textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '90%', maxWidth: '380px',
  },
  writerTarget: {
    width: '260px', height: '260px', margin: '0 auto', border: '1px solid #eee', borderRadius: '8px',
  },
  button: {
    background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 20px',
    borderRadius: '12px', cursor: 'pointer', fontWeight: '600', marginTop: '20px',
    marginRight: '10px'
  }
};

const HanziModal = ({ char, onClose }) => {
  const writerRef = useRef(null);
  const writerInstanceRef = useRef(null);

  useEffect(() => {
    if (!char) return;
    const initTimer = setTimeout(() => {
      if (writerRef.current) {
        writerRef.current.innerHTML = ''; 
        const writer = HanziWriter.create(writerRef.current, char, {
          width: 260, height: 260, padding: 5, showOutline: true,
          strokeAnimationSpeed: 1, delayBetweenStrokes: 100,
        });
        writerInstanceRef.current = writer;
        writer.animateCharacter();
      }
    }, 150); // 稍微增加延迟以确保DOM就绪

    return () => { clearTimeout(initTimer); writerInstanceRef.current = null; };
  }, [char]);

  const handleReplay = (e) => {
    e.stopPropagation(); 
    writerInstanceRef.current?.animateCharacter();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>汉字笔顺: {char}</h3>
        <div ref={writerRef} style={styles.writerTarget}></div>
        <div style={{display: 'flex', justifyContent: 'center', marginTop: '20px'}}>
            <button style={styles.button} onClick={handleReplay}>重播动画</button>
            <button style={styles.button} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default HanziModal;
