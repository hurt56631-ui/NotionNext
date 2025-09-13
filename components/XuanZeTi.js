// /components/XuanZeTi.js (最终版 - 内置TTS功能，完全独立)

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

// --- TTS 功能模块开始 (从 TextToSpeechButton.js 提取并集成) ---

// 1. 文本清理函数
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  // 移除括号和其中的内容，移除Markdown标记，移除拼音，移除表情符号等
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
  cleaned = cleaned.replace(/\b[a-zA-ZüÜ]+[1-5]\b\s*/g, '');
  cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');
  cleaned = cleaned.replace(/[()]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
};

// 2. 独立的 TTS 按钮子组件 (UI 和逻辑)
const TTSButton = ({ textToSpeak }) => {
  const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
  const audioRef = useRef(null);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
    };
  }, []);

  const handleTogglePlayback = useCallback(async (e) => {
    e.stopPropagation(); // 阻止事件冒泡到父级按钮

    if (playbackState === 'playing') {
      audioRef.current?.pause();
      return;
    }
    if (playbackState === 'paused') {
      audioRef.current?.play();
      return;
    }

    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText || playbackState === 'loading') return;

    setPlaybackState('loading');
    const encodedText = encodeURIComponent(cleanedText);
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaochenMultilingualNeural&r=-20&p=0&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('API 请求失败');
      
      const audioBlob = await response.blob();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setPlaybackState('playing');
      audio.onpause = () => setPlaybackState('paused');
      audio.onended = () => setPlaybackState('idle');
      audio.onerror = () => { setPlaybackState('idle'); };

      await audio.play();
    } catch (err) {
      setPlaybackState('idle');
    }
  }, [playbackState, textToSpeak]);
  
  const renderIcon = () => {
    switch (playbackState) {
      case 'loading':
        return <i className="fas fa-spinner fa-spin w-5 h-5 flex items-center justify-center"></i>;
      case 'playing':
        return <i className="fas fa-pause w-5 h-5 flex items-center justify-center"></i>;
      case 'paused':
      case 'idle':
      default:
        return <i className="fas fa-volume-up w-5 h-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <span
      onClick={handleTogglePlayback}
      className={`inline-flex items-center justify-center p-2 rounded-full transition-all duration-200 transform active:scale-90 ml-2 
        ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'text-sky-600 hover:bg-sky-600/10'}`}
      aria-label={`朗读: ${textToSpeak}`}
    >
      {renderIcon()}
    </span>
  );
};

// --- TTS 功能模块结束 ---


const XuanZeTi = ({ question, options = [], correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3')
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')
    }
  }, [])

  const playSound = (isCorrect) => {
    const audio = isCorrect ? correctAudioRef.current : wrongAudioRef.current
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(e => console.error("音频播放失败:", e))
    }
  }

  const handleOptionClick = (index) => {
    if (isAnswered) return
    setSelectedOptionIndex(index)
    setIsAnswered(true)
    setShowFeedback(true)
    playSound(index === correctAnswerIndex)
  }

  const handleReset = () => {
    setShowFeedback(false)
    setTimeout(() => {
      setSelectedOptionIndex(null)
      setIsAnswered(false)
    }, 300)
  }

  const getOptionClasses = (index) => {
    let baseClasses = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-300 flex items-center justify-between font-medium shadow-sm'
    
    if (isAnswered) {
      const isCorrectOption = index === correctAnswerIndex
      const isSelectedOption = index === selectedOptionIndex

      if (isCorrectOption) return `${baseClasses} bg-secondary/10 border-secondary text-secondary ring-2 ring-secondary scale-105 shadow-lg`
      if (isSelectedOption) return `${baseClasses} bg-red-100 border-red-400 text-red-600 dark:bg-red-900/50 dark:border-red-700 dark:text-red-400 animate-shake`
      return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 opacity-70 dark:bg-dark-2 dark:border-dark-3 dark:text-dark-7 pointer-events-none`
    }
    
    return `${baseClasses} bg-white dark:bg-dark-2 border-gray-300 dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer`
  }

  const FeedbackIcon = ({ isCorrect }) => {
    if (isCorrect) return <span className="text-secondary font-bold text-xl flex items-center"><i className="fas fa-check-circle mr-2"></i>回答正确！</span>
    return <span className="text-red-600 dark:text-red-400 font-bold text-xl flex items-center"><i className="fas fa-times-circle mr-2"></i>回答错误！</span>
  }

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1 flex items-center">
          {question}
          <TTSButton textToSpeak={question} />
        </h3>
      </div>
      <div className="space-y-4">
        {options.map((option, index) => (
          <button key={index} onClick={() => handleOptionClick(index)} disabled={isAnswered} className={getOptionClasses(index)}>
            <span className="text-lg flex items-center">
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
              {/* 为每个选项添加TTS按钮 */}
              <TTSButton textToSpeak={option} />
            </span>
            {isAnswered && index === correctAnswerIndex && <i className="fas fa-check text-secondary"></i>}
            {isAnswered && index === selectedOptionIndex && index !== correctAnswerIndex && <i className="fas fa-times text-red-500"></i>}
          </button>
        ))}
      </div>
      {isAnswered && (
        <div className={`mt-8 ${showFeedback ? 'animate-fade-in-up' : 'animate-fade-out'}`}>
          <div className="p-5 bg-gray-1 dark:bg-dark-2 border-t-4 border-primary rounded-b-lg shadow-inner">
            <div className="flex items-center space-x-3 mb-4">
               <FeedbackIcon isCorrect={selectedOptionIndex === correctAnswerIndex} />
            </div>
            {explanation && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
                  <i className="fas fa-lightbulb mr-2 text-yellow-500"></i>
                  解析
                  <TTSButton textToSpeak={explanation} />
                </h4>
                <p className="text-body-color dark:text-dark-7">{explanation}</p>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleReset} className="px-8 py-3 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200">
              再试一次
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default XuanZeTi
