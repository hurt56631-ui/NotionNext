// components/PronunciationPractice.js

import React, { useState, useRef, useEffect, useCallback } from 'react';

// TTS 朗读函数
const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // 停止上一个可能正在进行的朗读
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("当前环境不支持 Web Speech API (TTS)。");
  }
};

const PronunciationPractice = ({ title = '中文发音练习课', quizData = [] }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentPinyin, setCurrentPinyin] = useState('...');
  
  // 用于语音识别和结果反馈的状态
  const [isChecking, setIsChecking] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null); // 'correct', 'incorrect', or null

  const currentWord = quizData.length > 0 ? quizData[currentWordIndex].word : '你好';

  // 当 currentWord 改变时，重置状态并更新拼音
  useEffect(() => {
    // 切换单词时，重置所有反馈状态
    setRecognizedText('');
    setComparisonResult(null);
    setIsChecking(false);

    if (currentWord) {
      setCurrentPinyin('...'); // 显示加载中
      import('pinyin-pro').then(({ pinyin }) => {
        // 设置为带声调符号的拼音
        setCurrentPinyin(pinyin(currentWord, { toneType: 'symbol' }));
      }).catch(error => {
        console.error("加载 pinyin-pro 失败:", error);
        setCurrentPinyin("拼音加载失败");
      });
    }
  }, [currentWord]);

  // 检查发音的函数
  const checkPronunciation = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('抱歉，您的浏览器不支持语音识别功能。请尝试使用 Chrome 或 Safari 浏览器。');
      return;
    }

    setIsChecking(true);
    setRecognizedText('请开始说话...');
    setComparisonResult(null);

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN'; // 设置识别语言为中文
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript.replace(/[，。？！,!?\s]/g, ''); // 去除所有标点和空格
      setRecognizedText(`识别结果: "${speechResult}"`);
      if (speechResult === currentWord) {
        setComparisonResult('correct');
      } else {
        setComparisonResult('incorrect');
      }
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      if (event.error === 'no-speech') {
        setRecognizedText('未检测到语音，请重试。');
      } else if (event.error === 'not-allowed') {
        setRecognizedText('麦克风权限被拒绝。');
      } else {
        setRecognizedText('识别失败，请重试。');
      }
      setComparisonResult(null);
    };

    recognition.onend = () => {
      setIsChecking(false);
    };

  }, [currentWord]);

  const playStandardAudio = useCallback(() => speakText(currentWord), [currentWord]);

  const nextWord = useCallback(() => {
    setCurrentWordIndex((prevIndex) => (prevIndex + 1) % quizData.length);
  }, [quizData.length]);

  const prevWord = useCallback(() => {
    setCurrentWordIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : quizData.length - 1));
  }, [quizData.length]);

  if (quizData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>请在 Notion 中配置发音练习数据。</div>;
  }

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      padding: '20px',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      maxWidth: '480px',
      margin: '20px auto',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{ color: '#2d3748', fontWeight: '600' }}>{title}</h2>
      
      <div style={{ margin: '25px 0', borderBottom: '1px solid #edf2f7', paddingBottom: '25px' }}>
        <p style={{ fontSize: '4em', fontWeight: 'bold', color: '#2b6cb0', margin: '0', letterSpacing: '0.05em' }}>{currentWord}</p>
        <p style={{ fontSize: '2em', color: '#4a5568', margin: '8px 0 0 0', letterSpacing: '0.05em' }}>{currentPinyin}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button 
          onClick={playStandardAudio} 
          style={{
            padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#38a169',
            color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontWeight: '500', transition: 'background-color 0.2s'
          }}
        >
          🔊 听标准发音
        </button>
        <button 
          onClick={checkPronunciation} 
          disabled={isChecking} 
          style={{
            padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#3182ce',
            color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontWeight: '500', transition: 'background-color 0.2s',
            opacity: isChecking ? 0.7 : 1
          }}
        >
          {isChecking ? '正在识别...' : '🎤 开始评测'}
        </button>
      </div>
      
      <div style={{ marginTop: '20px', minHeight: '80px', padding: '10px', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
        <p style={{ fontSize: '1.1em', color: '#4a5568', margin: '0' }}>{recognizedText || '点击"开始评测"后请说话'}</p>
        {comparisonResult === 'correct' && (
          <p style={{ fontSize: '1.4em', color: '#38a169', fontWeight: 'bold', marginTop: '8px' }}>✔️ 非常棒，发音正确！</p>
        )}
        {comparisonResult === 'incorrect' && (
          <p style={{ fontSize: '1.4em', color: '#e53e3e', fontWeight: 'bold', marginTop: '8px' }}>❌ 加油，再试一次！</p>
        )}
      </div>

      {quizData.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
           <button 
             onClick={prevWord}
             style={{
               padding: '10px 20px', fontSize: '1em', backgroundColor: 'white', color: '#4a5568',
               border: '1px solid #cbd5e0', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
             }}
           >
             ⬅️ 上一个
           </button>
           <button 
             onClick={nextWord}
             style={{
               padding: '10px 20px', fontSize: '1em', backgroundColor: 'white', color: '#4a5568',
               border: '1px solid #cbd5e0', borderRadius: '8px', cursor: 'pointer', fontWeight: '500'
             }}
           >
             下一个 ➡️
           </button>
        </div>
      )}
    </div>
  );
};

export default PronunciationPractice;
