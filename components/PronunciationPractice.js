// components/PronunciationPractice.js

import React, { useState, useRef, useEffect, useCallback } from 'react';

// 注意：我们依然在 useEffect 中动态导入 pinyin-pro
// const { pinyin } = require('pinyin-pro'); // 不在顶层导入

const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // 停止上一个朗读
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("当前环境不支持 Web Speech API (TTS)。");
  }
};

const PronunciationPractice = ({ title = '中文发音练习课', quizData = [] }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const [currentPinyin, setCurrentPinyin] = useState('...');
  
  // 新增状态：用于语音识别和结果反馈
  const [isChecking, setIsChecking] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null); // 'correct', 'incorrect', or null

  const currentWord = quizData.length > 0 ? quizData[currentWordIndex].word : '你好';

  // 1. 修改 useEffect 以使用 'symbol' 声调
  useEffect(() => {
    setRecognizedText('');
    setComparisonResult(null);
    setAudioBlob(null);

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


  const startRecording = useCallback(async () => {
    // 开始录音前重置状态
    setAudioBlob(null);
    setRecognizedText('');
    setComparisonResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('您的浏览器不支持录音功能。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const audioChunks = [];
      recorder.ondataavailable = (event) => audioChunks.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('获取麦克风失败:', error);
      alert('无法访问麦克风。请确保已授予权限。');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // 2. 新增：检查发音的函数
  const checkPronunciation = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别功能。');
      return;
    }

    setIsChecking(true);
    setRecognizedText('正在识别...');
    setComparisonResult(null);

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN'; // 设置识别语言为中文
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.start();

    // 播放录音以供识别 (可选，但通常识别API直接用麦克风)
    // 这里我们直接让用户对着麦克风说话，并在录音停止后点击检查
    // 为了更好的体验，我们应该在录音时就进行识别
    // 让我们简化一下：点击“检查发音”时，让用户再说一遍
    alert("请在提示后，清晰地说出上面的词语。");

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript.replace(/，|。| /g, ''); // 去除标点和空格
      setRecognizedText(`识别结果: "${speechResult}"`);
      if (speechResult === currentWord) {
        setComparisonResult('correct');
      } else {
        setComparisonResult('incorrect');
      }
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      setRecognizedText('识别失败，请重试。');
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

  return (
    <div style={{...}}> {/* 保持外层 div 样式不变 */}
      <h2 style={{ color: '#333' }}>{title}</h2>
      <div style={{...}}> {/* 保持单词和拼音 div 样式不变 */}
        <p style={{...}}>{currentWord}</p>
        <p style={{...}}>{currentPinyin}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button onClick={playStandardAudio} style={{...}}>🔊 听标准发音</button>
        {/* 这里我们简化流程，直接用一个按钮进行识别 */}
        <button onClick={checkPronunciation} disabled={isChecking} style={{...}}>
          {isChecking ? '正在识别...' : '🎤 开始评测'}
        </button>
      </div>

      {/* 3. 新增：显示识别结果和反馈 */}
      <div style={{ marginTop: '20px', minHeight: '80px' }}>
        <p style={{ fontSize: '1.2em', color: '#333' }}>{recognizedText}</p>
        {comparisonResult === 'correct' && (
          <p style={{ fontSize: '1.5em', color: 'green', fontWeight: 'bold' }}>✔️ 非常棒，发音正确！</p>
        )}
        {comparisonResult === 'incorrect' && (
          <p style={{ fontSize: '1.5em', color: 'red', fontWeight: 'bold' }}>❌ 加油，再试一次！</p>
        )}
      </div>

      {quizData.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
           <button onClick={prevWord}>⬅️ 上一个</button>
           <button onClick={nextWord}>下一个 ➡️</button>
        </div>
      )}
    </div>
  );
};

export default PronunciationPractice;
