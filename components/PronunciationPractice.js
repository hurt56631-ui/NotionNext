// components/PronunciationPractice.js

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { pinyin } from 'pinyin-pro'; // 导入 pinyin-pro 库

// 假设您的 NotionNext 有一个全局的 TTS 朗读函数
// 如果没有，您需要根据您的 TTS 实现来调整这里
// 这是一个通用的 Web Speech API 实现
const speakText = (text) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // 设置为中文
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
  const [currentPinyin, setCurrentPinyin] = useState('');

  // 获取当前要练习的词语
  const currentWord = quizData.length > 0 ? quizData[currentWordIndex].word : '你好';

  // 当 currentWord 改变时更新拼音
  useEffect(() => {
    if (currentWord) {
      setCurrentPinyin(pinyin(currentWord, { toneType: 'num' }));
    }
  }, [currentWord]);

  // 开始录音函数
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      const audioChunks = [];
      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop()); // 停止媒体流
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('获取麦克风失败或录音开始失败:', error);
      alert('无法访问麦克风。请确保已授予权限。');
    }
  }, []);

  // 停止录音函数
  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder, isRecording]);

  // 播放标准音频
  const playStandardAudio = useCallback(() => {
    speakText(currentWord);
  }, [currentWord]);

  // 播放录制音频
  const playRecordedAudio = useCallback(() => {
    if (audioBlob && recordedAudioRef.current) {
      recordedAudioRef.current.src = URL.createObjectURL(audioBlob);
      recordedAudioRef.current.play();
    }
  }, [audioBlob]);

  // 切换到下一个词语
  const nextWord = useCallback(() => {
    setAudioBlob(null); // 清除上一个录音
    setCurrentWordIndex((prevIndex) => (prevIndex + 1) % quizData.length);
  }, [quizData.length]);

  // 切换到上一个词语
  const prevWord = useCallback(() => {
    setAudioBlob(null); // 清除上一个录音
    setCurrentWordIndex((prevIndex) => (prevIndex - 1 + quizData.length) % quizData.length);
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
            padding: '12px 25px',
            fontSize: '1.1em',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          🔊 听标准发音
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '12px 25px',
            fontSize: '1.1em',
            backgroundColor: isRecording ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease'
          }}
        >
          {isRecording ? '⏹️ 停止录音' : '🎤 开始录音'}
        </button>
      </div>

      {audioBlob && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <p style={{ fontSize: '1.2em', color: '#333' }}>您的录音：</p>
          <audio ref={recordedAudioRef} controls style={{ width: '100%', maxWidth: '300px' }}></audio>
          <button
            onClick={playRecordedAudio}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px',
              transition: 'background-color 0.3s ease'
            }}
          >
            ▶️ 播放我的录音
          </button>
        </div>
      )}

      {quizData.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
          <button
            onClick={prevWord}
            disabled={currentWordIndex === 0}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: '#f8f9fa',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer',
              opacity: currentWordIndex === 0 ? 0.6 : 1
            }}
          >
            ⬅️ 上一个
          </button>
          <button
            onClick={nextWord}
            disabled={currentWordIndex === quizData.length - 1}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: '#f8f9fa',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '5px',
              cursor: 'pointer',
              opacity: currentWordIndex === quizData.length - 1 ? 0.6 : 1
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
