// /components/TingYinShiCi.js (最终正确版 - 听音识词逻辑)

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// --- TTS 功能模块开始 ---
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
  cleaned = cleaned.replace(/\b[a-zA-ZüÜ]+[1-5]\b\s*/g, '');
  cleaned = cleaned.replace(/\*\*/g, '').replace(/#{1,6}\s/g, '').replace(/[-*]\s/g, '');
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  cleaned = cleaned.replace(emojiRegex, '');
  cleaned = cleaned.replace(/[()]/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
};

const TTSButton = ({ textToSpeak, autoPlay = false, onPlaybackEnd }) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);
  const autoPlayRef = useRef(autoPlay);

  useEffect(() => {
    return () => { if (audioRef.current) { audioRef.current.pause(); if (audioRef.current.src?.startsWith('blob:')) { URL.revokeObjectURL(audioRef.current.src); } } };
  }, []);

  const playAudio = useCallback(async (text) => {
    const cleanedText = cleanTextForSpeech(text);
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
      audio.onended = () => { setPlaybackState('idle'); if (onPlaybackEnd) onPlaybackEnd(); };
      audio.onerror = () => { setPlaybackState('idle'); };
      await audio.play();
    } catch (err) {
      setPlaybackState('idle');
    }
  }, [playbackState, onPlaybackEnd]);

  useEffect(() => {
    if (autoPlayRef.current && textToSpeak) {
        playAudio(textToSpeak);
        autoPlayRef.current = false; // 只自动播放一次
    }
  }, [textToSpeak, playAudio]);

  const handleTogglePlayback = useCallback((e) => {
    e.stopPropagation();
    if (playbackState === 'playing') { audioRef.current?.pause(); return; }
    if (playbackState === 'paused') { audioRef.current?.play(); return; }
    playAudio(textToSpeak);
  }, [playbackState, textToSpeak, playAudio]);
  
  const renderIcon = () => {
    switch (playbackState) {
      case 'loading': return <i className="fas fa-spinner fa-spin text-4xl"></i>;
      case 'playing': return <i className="fas fa-pause text-4xl"></i>;
      default: return <i className="fas fa-volume-up text-4xl"></i>;
    }
  };

  return <button onClick={handleTogglePlayback} className={`p-6 rounded-full transition-all duration-200 transform active:scale-90 ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'text-primary hover:bg-primary/10'}`}>{renderIcon()}</button>;
};
// --- TTS 功能模块结束 ---

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[newArray[i], newArray[j]] = [newArray[j], newArray[i]]; }
  return newArray;
};

const TingYinShiCi = ({ title = '听音识词', numOptions = 4, isShuffle = 'false', quizData }) => {
  const [wordList, setWordList] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(Date.now()); // 用于强制重新渲染TTSButton

  useEffect(() => {
    try {
      let parsedData = Array.isArray(quizData) ? quizData : JSON.parse(quizData);
      if (!Array.isArray(parsedData) || parsedData.length === 0) { setError('题库数据 (quizData) 为空或格式不正确。'); return; }
      const formattedData = parsedData.map(item => typeof item === 'string' ? { word: item, pinyin: '' } : item);
      setWordList(String(isShuffle) === 'true' ? shuffleArray(formattedData) : formattedData);
      setCurrentWordIndex(0); setScore(0); setSelectedOption(null); setIsAnswered(false); setError(null); setKey(Date.now());
    } catch (e) { setError(`题库数据解析失败: ${e.message}`); }
  }, [quizData, isShuffle]);

  useEffect(() => {
    if (wordList.length > 0 && currentWordIndex < wordList.length) {
      const currentWord = wordList[currentWordIndex];
      const distractors = wordList.filter(w => w.word !== currentWord.word);
      const numDistractors = Math.max(0, numOptions - 1);
      const selectedDistractors = shuffleArray(distractors).slice(0, numDistractors);
      setOptions(shuffleArray([currentWord, ...selectedDistractors]));
    }
  }, [wordList, currentWordIndex, numOptions]);

  const handleOptionClick = (option) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);
    if (option.word === wordList[currentWordIndex].word) setScore(s => s + 1);
  };

  const handleNextWord = () => {
    if (currentWordIndex < wordList.length - 1) {
      setCurrentWordIndex(i => i + 1);
      setIsAnswered(false);
      setSelectedOption(null);
      setKey(Date.now()); // 更新key以触发TTSButton的自动播放
    } else {
      alert(`挑战完成！你的得分是: ${score + (selectedOption.word === wordList[currentWordIndex].word ? 1 : 0)} / ${wordList.length}`);
    }
  };
  
  const handleRestart = () => {
    const parsedData = Array.isArray(quizData) ? quizData : JSON.parse(quizData);
    const formattedData = parsedData.map(item => typeof item === 'string' ? { word: item, pinyin: '' } : item);
    setWordList(String(isShuffle) === 'true' ? shuffleArray(formattedData) : formattedData);
    setCurrentWordIndex(0); setScore(0); setSelectedOption(null); setIsAnswered(false); setKey(Date.now());
  };

  if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
  if (wordList.length === 0) return <div className="p-4 text-center text-gray-500">正在加载词库...</div>;

  const currentWord = wordList[currentWordIndex];
  const isCorrect = isAnswered && selectedOption.word === currentWord.word;

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-center mb-2 text-dark-DEFAULT dark:text-gray-1">{title}</h1>
        <div className="flex justify-between text-sm text-body-color dark:text-dark-7">
          <span>词语: {currentWordIndex + 1} / {wordList.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-2 dark:bg-dark-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${((currentWordIndex + 1) / wordList.length) * 100}%` }}></div>
        </div>
      </div>
      <div className="text-center my-8">
        <TTSButton key={key} textToSpeak={currentWord.word} autoPlay={true} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, i) => {
          let classes = 'w-full text-center p-4 rounded-lg border-2 transition-all duration-300 font-semibold ';
          if (isAnswered) {
            if (option.word === currentWord.word) classes += 'bg-secondary/10 border-secondary text-secondary ring-2 ring-secondary';
            else if (option.word === selectedOption.word) classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900/50 dark:border-red-700 dark:text-red-400 animate-shake';
            else classes += 'bg-gray-100 border-gray-300 text-gray-500 opacity-60 dark:bg-dark-2 dark:border-dark-3 dark:text-dark-7';
            classes += ' pointer-events-none';
          } else {
            classes += 'bg-white dark:bg-dark-2 border-gray-300 dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 hover:border-primary hover:text-primary hover:shadow-md';
          }
          return <button key={i} onClick={() => handleOptionClick(option)} disabled={isAnswered} className={classes}>{option.word}</button>;
        })}
      </div>
      {isAnswered && (
        <div className="mt-6 animate-fade-in-up">
          <div className="p-4 rounded-lg bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 shadow-inner">
            <div className={`flex items-center mb-3 font-bold ${isCorrect ? 'text-secondary' : 'text-red-600 dark:text-red-400'}`}>
              {isCorrect ? <i className="fas fa-check-circle mr-2"></i> : <i className="fas fa-times-circle mr-2"></i>}
              {isCorrect ? '回答正确！' : '回答错误。'}
            </div>
            <p className="text-body-color dark:text-dark-7 text-lg"><strong>正确答案：</strong> {currentWord.word} {currentWord.pinyin && `(${currentWord.pinyin})`}</p>
          </div>
          <div className="mt-4 flex justify-end space-x-4">
             <button onClick={handleRestart} className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg shadow-md hover:bg-gray-600">
                <i className="fas fa-redo-alt inline-block"></i> 重来
             </button>
             <button onClick={handleNextWord} className="px-6 py-2 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark">
                {currentWordIndex < wordList.length - 1 ? '下一题' : '查看结果'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TingYinShiCi;
