// components/PronunciationPractice.js

import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- 辅助函数 ---

// TTS 朗读函数
const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  }
};

// 拼音对比函数，生成带对错状态的数组
const comparePinyin = (correct, recognized) => {
  if (!recognized) return null;
  const result = [];
  const maxLength = Math.max(correct.length, recognized.length);

  for (let i = 0; i < maxLength; i++) {
    const correctChar = correct[i];
    const recognizedChar = recognized[i];

    if (recognizedChar) {
      result.push({
        char: recognizedChar,
        status: correctChar === recognizedChar ? 'correct' : 'incorrect',
      });
    }
  }
  return result;
};


// --- 主组件 ---

const PronunciationPractice = ({ title = '中文发音练习课', quizData = [] }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentPinyin, setCurrentPinyin] = useState('...');
  
  // 语音识别相关状态
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [pinyinComparison, setPinyinComparison] = useState(null); // 用于存储拼音对比结果数组
  const recognitionRef = useRef(null); // 用于持有 recognition 实例

  const currentWord = quizData.length > 0 ? quizData[currentWordIndex].word : '你好';

  // 当单词切换时，重置所有状态并获取新拼音
  useEffect(() => {
    setIsRecognizing(false);
    setRecognizedText('');
    setPinyinComparison(null);
    if (recognitionRef.current) {
        recognitionRef.current.abort(); // 确保旧的识别实例被终止
    }

    if (currentWord) {
      setCurrentPinyin('...');
      import('pinyin-pro').then(({ pinyin }) => {
        setCurrentPinyin(pinyin(currentWord, { toneType: 'symbol' }));
      }).catch(error => {
        console.error("加载 pinyin-pro 失败:", error);
        setCurrentPinyin("拼音加载失败");
      });
    }
  }, [currentWord]);

  // 开始语音识别
  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('抱歉，您的浏览器不支持语音识别功能。');
      return;
    }

    setRecognizedText('');
    setPinyinComparison(null);
    setIsRecognizing(true);

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true; // 持续识别
    recognition.interimResults = true; // 获取中间结果

    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            // isFinal 事件触发后，我们不再需要手动停止
            stopRecognition(); 
        }
        interimTranscript += event.results[i][0].transcript;
      }
      setRecognizedText(interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      setRecognizedText(`识别出错: ${event.error}`);
    };

    recognition.onend = () => {
      setIsRecognizing(false);
      // 在识别结束后进行对比
      import('pinyin-pro').then(({ pinyin }) => {
        const recognizedPinyin = pinyin(recognizedText.replace(/[，。？！,!?\s]/g, ''), { toneType: 'symbol' });
        setPinyinComparison(comparePinyin(currentPinyin.replace(/\s/g, ''), recognizedPinyin.replace(/\s/g, '')));
      });
    };

    recognition.start();
  }, [currentPinyin, recognizedText]);

  // 手动停止语音识别
  const stopRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false); // 立即更新UI状态
    }
  }, [isRecognizing]);


  const playStandardAudio = useCallback(() => speakText(currentWord), [currentWord]);
  const nextWord = useCallback(() => setCurrentWordIndex(prev => (prev + 1) % quizData.length), [quizData.length]);
  const prevWord = useCallback(() => setCurrentWordIndex(prev => (prev > 0 ? prev - 1 : quizData.length - 1)), [quizData.length]);

  if (quizData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>请在 Notion 中配置发音练习数据。</div>;
  }

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '2.5rem 2rem', // 增加内边距
      border: '1px solid #e2e8f0',
      borderRadius: '1rem', // 更大的圆角
      maxWidth: '560px', // 卡片更宽
      margin: '2.5rem auto',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    }}>
      <h2 style={{ color: '#2d3748', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '2.5rem' }}>{title}</h2>
      
      <div style={{ marginBottom: '2.5rem' }}>
        <p style={{ fontSize: '2.25rem', color: '#4a5568', margin: '0 0 0.5rem 0', letterSpacing: '0.05em' }}>{currentPinyin}</p>
        <p style={{ fontSize: '6rem', fontWeight: 'bold', color: '#2b6cb0', margin: '0', letterSpacing: '0.05em', lineHeight: '1' }}>{currentWord}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={playStandardAudio}
          style={{...buttonStyle, backgroundColor: '#38a169'}}
        >
          🔊 听标准发音
        </button>
        <button 
          onClick={isRecognizing ? stopRecognition : startRecognition}
          style={{...buttonStyle, backgroundColor: isRecognizing ? '#dd6b20' : '#3182ce' }}
        >
          {isRecognizing ? '⏹️ 停止识别' : '🎤 开始评测'}
        </button>
      </div>
      
      <div style={{ minHeight: '6rem', padding: '1rem', backgroundColor: '#f7fafc', borderRadius: '0.5rem' }}>
        <p style={{ fontSize: '1.1rem', color: '#718096', margin: '0 0 0.5rem 0', fontWeight: '500' }}>识别结果</p>
        {!pinyinComparison && <p style={{ color: '#a0aec0' }}>{recognizedText || '点击“开始评测”，然后请说话'}</p>}
        {pinyinComparison && (
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
            {pinyinComparison.map((item, index) => (
              <span key={index} style={{ color: item.status === 'correct' ? '#38a169' : '#e53e3e' }}>
                {item.char}
              </span>
            ))}
          </div>
        )}
      </div>

      {quizData.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
           <button onClick={prevWord} style={navButtonStyle}>⬅️ 上一个</button>
           <button onClick={nextWord} style={navButtonStyle}>下一个 ➡️</button>
        </div>
      )}
    </div>
  );
};

// 按钮通用样式，避免重复
const buttonStyle = {
  padding: '0.75rem 1.75rem',
  fontSize: '1.125rem',
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: '600',
  transition: 'all 0.2s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const navButtonStyle = {
  padding: '0.5rem 1rem',
  fontSize: '1rem',
  backgroundColor: 'white',
  color: '#4a5568',
  border: '1px solid #cbd5e0',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: '500',
  transition: 'all 0.2s ease-in-out',
};


export default PronunciationPractice;
