// components/HanziModal.js - 支持多字词语的最终修复版

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
    width: '90%', maxWidth: '600px', // 宽度可以适当增加以容纳多字
  },
  // 新增：用于横向排列多个汉字动画的容器
  writerContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
  },
  writerTarget: {
    width: '150px', // 每个字小一点，以容纳更多
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
  // 从 'char' 改为 'word'
  const writerRefs = useRef([]);
  const wordChars = word ? word.split('') : [];

  // 确保 refs 数组的长度与汉字数量一致
  useEffect(() => {
    writerRefs.current = writerRefs.current.slice(0, wordChars.length);
  }, [wordChars.length]);

  // 核心动画逻辑
  const runAnimation = useCallback(() => {
    if (!word) return;

    // 定义一个递归函数来依次播放动画
    const animateSequentially = (index) => {
      // 如果所有字都播放完毕，则结束
      if (index >= wordChars.length) return;

      const char = wordChars[index];
      const targetEl = writerRefs.current[index];

      if (targetEl) {
        // 清理上一次的渲染
        targetEl.innerHTML = '';
        const writer = HanziWriter.create(targetEl, char, {
          width: 150,
          height: 150,
          padding: 5,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 100,
        });

        // 播放当前汉字的动画
        writer.animateCharacter({
          // 当前动画播放完成后，调用自身来播放下一个汉字
          onComplete: () => {
            setTimeout(() => animateSequentially(index + 1), 300); // 稍作停顿后播放下一个
          }
        });
      }
    };

    // 从第一个字开始启动动画序列
    animateSequentially(0);
  }, [word, wordChars]);
  
  // 组件加载时自动播放一次
  useEffect(() => {
    // 增加延迟确保DOM元素完全准备好
    const timer = setTimeout(runAnimation, 200);
    return () => clearTimeout(timer);
  }, [runAnimation]);


  const handleReplay = (e) => {
    e.stopPropagation();
    runAnimation(); // 点击重播时，重新从第一个字开始播放
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>汉字笔顺: {word}</h3>
        <div style={styles.writerContainer}>
          {wordChars.map((char, index) => (
            <div
              key={`${char}-${index}`}
              // 使用 ref 回调函数来填充 refs 数组
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
