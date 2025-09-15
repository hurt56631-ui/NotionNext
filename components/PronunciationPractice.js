// components/PronunciationPractice.js

import React, { useState, useRef, useEffect } from 'react';
import { pinyin } from 'pinyin-pro'; // 导入 pinyin-pro 库

// 假设您的 NotionNext 有一个全局的 TTS 朗读函数
// 如果没有，您需要根据您的 TTS 实现来调整这里
// 例如，如果您的 TTS 是一个 hook 或 context，您需要相应导入
const speakText = (text) => {
  // 替换为您的 NotionNext 实际的 TTS 朗读逻辑
  // 这只是一个示例，假设您有一个函数可以直接朗读文本
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // 设置为中文
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("当前浏览器不支持 Web Speech API (TTS)。");
  }
};

const PronunciationPractice = ({ chineseWord = '你好世界' }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioRef = useRef(null);
  const recordedAudioRef = useRef(null);
  const [currentPinyin, setCurrentPinyin] = useState('');

  useEffect(() => {
    // 使用 pinyin-pro 获取拼音
    setCurrentPinyin(pinyin(chineseWord, { toneType: 'num' })); // 'num' 显示声调数字
  }, [chineseWord]);

  const startRecording = async () => {
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
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const playStandardAudio = () => {
    speakText(chineseWord);
  };

  const playRecordedAudio = () => {
    if (audioBlob && recordedAudioRef.current) {
      recordedAudioRef.current.src = URL.createObjectURL(audioBlob);
      recordedAudioRef.current.play();
    }
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      maxWidth: '600px',
      margin: '20px auto',
      textAlign: 'center'
    }}>
      <h2>中文发音练习</h2>

      <div style={{ margin: '20px 0' }}>
        <p style={{ fontSize: '3em', fontWeight: 'bold', margin: '0' }}>{chineseWord}</p>
        <p style={{ fontSize: '1.5em', color: '#666', margin: '5px 0 0 0' }}>{currentPinyin}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button
          onClick={playStandardAudio}
          style={{
            padding: '10px 20px',
            fontSize: '1em',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔊 听标准发音
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '10px 20px',
            fontSize: '1em',
            backgroundColor: isRecording ? '#f44336' : '#008CBA',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {isRecording ? '⏹️ 停止录音' : '🎤 开始录音'}
        </button>
      </div>

      {audioBlob && (
        <div style={{ marginTop: '20px' }}>
          <p>您的录音：</p>
          <audio ref={recordedAudioRef} controls style={{ width: '100%' }}></audio>
          <button
            onClick={playRecordedAudio}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: '#555',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            ▶️ 播放我的录音
          </button>
        </div>
      )}

      <audio ref={audioRef} style={{ display: 'none' }}></audio> {/* 用于内部播放控制，如果需要的话 */}
    </div>
  );
};

export default PronunciationPractice;
