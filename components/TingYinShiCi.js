// /components/TingYinShiCi.js (视觉升级版 - 柔和UI + 人物朗读)

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// --- 可配置项 ---
// 在这里替换成您喜欢的人物图片URL，建议使用透明背景的PNG图片
const DEFAULT_CHARACTER_IMAGE = '/images/character-speaker.png'; 

// --- 核心功能模块 ---
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

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[newArray[i], newArray[j]] = [newArray[j], newArray[i]]; }
  return newArray;
};


// --- 子组件：人物朗读模块 ---
const CharacterSpeaker = ({ textToSpeak, autoPlay = false, characterImage, onPlaybackEnd }) => {
  const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
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
    const url = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaoyouNeural&r=0&p=0&o=audio-24khz-48kbitrate-mono-mp3`; // 使用更自然的声音
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
        autoPlayRef.current = false;
    }
  }, [textToSpeak, playAudio]);

  const handleTogglePlayback = useCallback((e) => {
    e.stopPropagation();
    if (playbackState === 'playing') { audioRef.current?.pause(); return; }
    if (playbackState === 'paused') { audioRef.current?.play(); return; }
    playAudio(textToSpeak);
  }, [playbackState, textToSpeak, playAudio]);

  return (
    <div className="flex flex-col items-center justify-center cursor-pointer group" onClick={handleTogglePlayback}>
      <div className="relative">
        <img src={characterImage || DEFAULT_CHARACTER_IMAGE} alt="朗读助手" className="w-28 h-28 rounded-full object-cover shadow-lg transition-transform duration-300 group-hover:scale-105" />
        {/* 声波动画 */}
        {playbackState === 'playing' && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75"></div>
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-50" style={{animationDelay: '0.5s'}}></div>
          </>
        )}
        {/* 加载状态 */}
        {playbackState === 'loading' && (
          <div className="absolute inset-0 bg-white/50 rounded-full flex items-center justify-center">
            <i className="fas fa-spinner fa-spin text-primary text-2xl"></i>
          </div>
        )}
        {/* 播放/暂停图标 */}
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-md">
           {playbackState === 'playing' ? <i className="fas fa-pause text-primary"></i> : <i className="fas fa-volume-up text-primary"></i>}
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 font-medium">点击人物重新朗读</p>
    </div>
  );
};


// --- 主组件：听音识词 ---
const TingYinShiCi = ({ title = '听音识词', numOptions = 4, isShuffle = 'false', quizData, characterImage }) => {
  const [wordList, setWordList] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);
  const [key, setKey] = useState(Date.now());

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
      setKey(Date.now());
    } else {
      alert(`挑战完成！你的得分是: ${score + (isAnswered && selectedOption.word === wordList[currentWordIndex].word ? 1 : 0)} / ${wordList.length}`);
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

  const getOptionClasses = (option) => {
    let base = 'w-full text-center p-4 rounded-xl transition-all duration-300 font-semibold text-lg flex items-center justify-center transform focus:outline-none';
    if (isAnswered) {
      if (option.word === currentWord.word) return `${base} bg-green-500 text-white shadow-lg scale-105`;
      if (option.word === selectedOption.word) return `${base} bg-red-500 text-white shadow-md`;
      return `${base} bg-gray-200 text-gray-400 dark:bg-dark-2 dark:text-dark-7 pointer-events-none`;
    }
    return `${base} bg-white dark:bg-dark-3 text-dark-DEFAULT dark:text-gray-1 shadow-neumorphic-light dark:shadow-neumorphic-dark hover:shadow-neumorphic-light-inset dark:hover:shadow-neumorphic-dark-inset active:scale-95`;
  };

  return (
    <div className="max-w-xl mx-auto my-8 p-8 bg-gray-100 dark:bg-dark-1 rounded-2xl shadow-neumorphic-light dark:shadow-neumorphic-dark font-sans">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-700 dark:text-gray-200">{title}</h1>
        <div className="mt-2 text-sm text-gray-500 dark:text-dark-7">
          <span>词语: {currentWordIndex + 1} / {wordList.length}</span> | <span>得分: {score}</span>
        </div>
      </div>
      
      <div className="my-10">
        <CharacterSpeaker key={key} textToSpeak={currentWord.word} autoPlay={true} characterImage={characterImage} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {options.map((option, i) => (
          <button key={i} onClick={() => handleOptionClick(option)} disabled={isAnswered} className={getOptionClasses(option)}>
            {option.word}
          </button>
        ))}
      </div>
      
      {isAnswered && (
        <div className="mt-8 animate-fade-in-up">
          <div className="p-4 text-center rounded-xl bg-gray-200 dark:bg-dark-2">
            <h3 className={`text-xl font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {isCorrect ? <><i className="fas fa-check-circle mr-2"></i>正确</> : <><i className="fas fa-times-circle mr-2"></i>错误</>}
            </h3>
            <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">
              答案是：<span className="font-bold">{currentWord.word}</span> {currentWord.pinyin && `(${currentWord.pinyin})`}
            </p>
          </div>
          <div className="mt-6 flex justify-center space-x-4">
             <button onClick={handleRestart} className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg shadow-md hover:bg-gray-600 transition-colors">
                <i className="fas fa-redo-alt mr-2"></i>重来
             </button>
             <button onClick={handleNextWord} className="px-6 py-2 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark transition-colors">
                {currentWordIndex < wordList.length - 1 ? '下一题' : '完成'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TingYinShiCi;
