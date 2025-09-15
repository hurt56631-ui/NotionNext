// components/HanziWriterPractice.js

import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

const HanziWriterPractice = ({ character = '我', size = 300 }) => {
  const targetRef = useRef(null); // 用来引用要渲染汉字的 DOM 元素
  const [writer, setWriter] = useState(null); // 用来存储 HanziWriter 实例

  useEffect(() => {
    if (targetRef.current) {
      // 创建 HanziWriter 实例
      const writerInstance = HanziWriter.create(targetRef.current, character, {
        width: size,
        height: size,
        padding: 20,
        showOutline: true,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 100,
        strokeColor: '#3182ce', // 笔画颜色
        radicalColor: '#e53e3e', // 部首颜色（如果数据支持）
      });
      setWriter(writerInstance);
    }

    // 组件卸载时清理资源，防止内存泄漏
    return () => {
      if (writer) {
        writer.cleanup();
      }
    };
  }, [character, size]); // 当 character 或 size 变化时，重新创建实例

  const handleAnimate = () => {
    writer && writer.animateCharacter();
  };

  const handleQuiz = () => {
    writer && writer.quiz({
        onCorrectStroke: (data) => console.log('写的很棒！', data),
        onMistake: (data) => console.log('笔顺错了哦！', data),
    });
  };

  const handleReset = () => {
      // 简单地重新加载组件以重置
      // 这是一个简单的技巧，更复杂的应用可以用 writer.hideCharacter() 等
      const currentTarget = targetRef.current;
      if (currentTarget) {
          currentTarget.innerHTML = '';
          const newWriter = HanziWriter.create(currentTarget, character, {
            width: size, height: size, padding: 20, showOutline: true,
            strokeAnimationSpeed: 1, delayBetweenStrokes: 100,
            strokeColor: '#3182ce', radicalColor: '#e53e3e',
          });
          setWriter(newWriter);
      }
  }


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem',
      border: '1px solid #e2e8f0',
      borderRadius: '1rem',
      margin: '2rem auto',
      maxWidth: '450px',
      backgroundColor: '#f7fafc',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#2d3748' }}>汉字笔顺练习</h3>
      
      {/* 这是 Hanzi Writer 渲染汉字的目标区域 */}
      <div ref={targetRef} style={{ border: '2px dashed #cbd5e0', borderRadius: '8px' }} />

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleAnimate} style={buttonStyle}>▶️ 播放动画</button>
        <button onClick={handleQuiz} style={{...buttonStyle, backgroundColor: '#38a169'}}>✍️ 开始练习</button>
        <button onClick={handleReset} style={{...buttonStyle, backgroundColor: '#718096'}}>🔄 重置</button>
      </div>
      <p style={{color: '#a0aec0', fontSize: '0.9rem', marginTop: '1rem'}}>点击“开始练习”后，用手指或鼠标在方框内书写</p>
    </div>
  );
};

// 按钮样式
const buttonStyle = {
  padding: '0.6rem 1.2rem',
  fontSize: '1rem',
  backgroundColor: '#3182ce',
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: '500',
  transition: 'background-color 0.2s',
};

export default HanziWriterPractice;
