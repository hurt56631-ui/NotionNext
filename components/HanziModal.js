// components/HanziModal.js - 支持多字词语的最终修复版 (已修复 useCallback 错误)

import React, { useEffect, useRef, useCallback } from 'react'; // <<<< 关键修复：在这里添加了 useCallback
import HanziWriter from 'hanzi-writer';

const styles = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  modal: {
    background: 'white', padding: '25px', borderRadius: '16px',
    textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '90%', maxWidth: '600px',
  },
  writerContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
  },
  writerTarget: {
    width: '150px',
    height: '150px',
    border: '1px solid #eee',
    borderRadius: '8px',
  },
  button: {
    background: '#eef2ff', color: '#0f172a', border: 'none', padding: '10px 20px',
    borderRadius: '12px', cursor: 'pointer', fontWeight: '600', marginTop: '20px',
    marginRight: '10px'
  }
};

const HanziModal = ({ word, onClose }) => {
  const writerRefs = useRef([]);
  const wordChars = word ? word.split('') : [];

  useEffect(() => {
    writerRefs.current = writerRefs.current.slice(0, wordChars.length);
  }, [wordChars.length]);

  const runAnimation = useCallback(() => {
    if (!word) return;
    const animateSequentially = (index) => {
      if (index >= wordChars.length) return;
      const char = wordChars[index];
      const targetEl = writerRefs.current[index];
      if (targetEl) {
        targetEl.innerHTML = '';
        const writer = HanziWriter.create(targetEl, char, {
          width: 150,
          height: 150,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 100,
        });
        writer.animateCharacter({
          onComplete: () => {
            setTimeout(() => animateSequentially(index + 1), 300);
          }
        });
      }
    };
    animateSequentially(0);
  }, [word, wordChars]);
  
  useEffect(() => {
    const timer = setTimeout(runAnimation, 200);
    return () => clearTimeout(timer);
  }, [runAnimation]);

  const handleReplay = (e) => {
    e.stopPropagation();
    runAnimation();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>汉字笔顺: {word}</h3>
        <div style={styles.writerContainer}>
          {wordChars.map((char, index) => (
            <div
              key={`${char}-${index}`}
              ref={el => writerRefs.current[index] = el}
              style={styles.writerTarget}
            ></div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button style={styles.button} onClick={handleReplay}>重播动画</button>
          <button style={styles.button} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default HanziModal;
