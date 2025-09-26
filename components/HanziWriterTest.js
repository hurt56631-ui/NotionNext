import React, { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: 'white',
    padding: '25px',
    borderRadius: '16px',
    textAlign: 'center',
  },
  writerTarget: {
    width: '250px',
    height: '250px',
    margin: '0 auto',
  },
  button: {
    background: '#eef2ff',
    color: '#0f172a',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    marginTop: '20px',
    marginRight: '10px'
  }
};

const HanziWriterTest = ({ char, onClose }) => {
  const writerRef = useRef(null);
  const writerInstanceRef = useRef(null);

  // 核心逻辑：确保在DOM元素渲染后才初始化
  useEffect(() => {
    if (!char) return;

    // 给予100毫秒的延迟，确保DOM完全准备就绪
    const initTimer = setTimeout(() => {
      if (writerRef.current) {
        writerRef.current.innerHTML = ''; // 清空上一个实例
        const writer = HanziWriter.create(writerRef.current, char, {
          width: 250,
          height: 250,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 100,
        });
        writerInstanceRef.current = writer; // 保存实例
        writer.animateCharacter();
      }
    }, 100);

    return () => clearTimeout(initTimer);
  }, [char]);

  const handleReplay = () => {
    writerInstanceRef.current?.animateCharacter();
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>笔顺动画测试</h3>
        <div ref={writerRef} style={styles.writerTarget}></div>
        <button style={styles.button} onClick={handleReplay}>重播</button>
        <button style={styles.button} onClick={onClose}>关闭</button>
      </div>
    </div>
  );
};

export default HanziWriterTest;
