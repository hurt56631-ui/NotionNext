// components/PronunciationPractice.js

import React, { useState, useRef, useEffect, useCallback } from 'react';

// 注意：我们已经移除了顶层的 "import { pinyin } from 'pinyin-pro';"

// TTS 朗读函数（无需修改）
const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("当前环境不支持 Web Speech API (TTS)。");
  }
};

const PronunciationPractice = ({ title = '中文发音练习', quizData = [] }) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordedAudioRef = useRef(null);
  const [currentPinyin, setCurrentPinyin] = useState('...'); // 初始状态设为加载中

  const currentWord = quizData.length > 0 ? quizData[currentWordIndex].word : '你好';

  // 当 currentWord 改变时更新拼音
  useEffect(() => {
    // 关键修复：在这里动态导入 pinyin-pro，确保它只在客户端运行
    if (currentWord) {
      setCurrentPinyin('...'); // 切换单词时重置为加载状态
      import('pinyin-pro').then(({ pinyin }) => {
        // 成功导入后，再设置拼音
        setCurrentPinyin(pinyin(currentWord, { toneType: 'num' }));
      }).catch(error => {
        console.error("加载 pinyin-pro 失败:", error);
        setCurrentPinyin("拼音加载失败");
      });
    }
  }, [currentWord]);

  // --- 以下所有函数都无需修改 ---

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
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
      console.error('获取麦克风失败或录音开始失败:', error);
      alert('无法访问麦克风。请确保已授予权限。');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder, isRecording]);

  const playStandardAudio = useCallback(() => speakText(currentWord), [currentWord]);
  const playRecordedAudio = useCallback(() => {
    if (audioBlob && recordedAudioRef.current) {
      recordedAudioRef.current.src = URL.createObjectURL(audioBlob);
      recordedAudioRef.current.play();
    }
  }, [audioBlob]);

  const nextWord = useCallback(() => {
    setAudioBlob(null);
    setCurrentWordIndex((prevIndex) => (prevIndex + 1) % quizData.length);
  }, [quizData.length]);

  const prevWord = useCallback(() => {
    setAudioBlob(null);
    setCurrentWordIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : quizData.length - 1));
  }, [quizData.length]);


  if (quizData.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>请在 Notion 中配置发音练习数据。</div>;
  }

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      maxWidth: '600px',
      margin: '20px auto',
      textAlign: 'center',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ color: '#333' }}>{title}</h2>
      <div style={{ margin: '20px 0', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <p style={{ fontSize: '3.5em', fontWeight: 'bold', color: '#007bff', margin: '0' }}>{currentWord}</p>
        <p style={{ fontSize: '1.8em', color: '#666', margin: '5px 0 0 0' }}>{currentPinyin}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button
          onClick={playStandardAudio}
          style={{
            padding: '12px 25px', fontSize: '1.1em', backgroundColor: '#28a745',
            color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer',
          }}
        >
          🔊 听标准发音
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '12px 25px', fontSize: '1.1em', backgroundColor: isRecording ? '#dc3545' : '#007bff',
            color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer',
          }}
        >
          {isRecording ? '⏹️ 停止录音' : '🎤 开始录音'}
        </button>
      </div>
      {audioBlob && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ fontSize: '1.2em', color: '#333' }}>您的录音：</p>
          <audio ref={recordedAudioRef} controls style={{ width: '100%', maxWidth: '300px' }}></audio>
        </div>
      )}
      {quizData.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
          <button onClick={prevWord} style={{ padding: '10px 20px', fontSize: '1em' }}>
            ⬅️ 上一个
          </button>
          <button onClick={nextWord} style={{ padding: '10px 20px', fontSize: '1em' }}>
            下一个 ➡️
          </button>
        </div>
      )}
    </div>
  );
};

export default PronunciationPractice;
