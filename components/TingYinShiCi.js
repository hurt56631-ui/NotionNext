// /components/TingYinShiCi.js (最终成功版 - 基于 XuanZeTi.js 模板)

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// --- TTS 功能模块开始 (和成功的 XuanZeTi.js 保持一致) ---

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

const TTSButton = ({ textToSpeak }) => {
  const [playbackState, setPlaybackState] = useState('idle');
  const audioRef = useRef(null);

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
    e.stopPropagation();
    if (playbackState === 'playing') { audioRef.current?.pause(); return; }
    if (playbackState === 'paused') { audioRef.current?.play(); return; }

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
      case 'loading': return <i className="fas fa-spinner fa-spin w-5 h-5 flex items-center justify-center"></i>;
      case 'playing': return <i className="fas fa-pause w-5 h-5 flex items-center justify-center"></i>;
      default: return <i className="fas fa-volume-up w-5 h-5 flex items-center justify-center"></i>;
    }
  };

  return (
    <span onClick={handleTogglePlayback} className={`inline-flex items-center justify-center p-2 rounded-full transition-all duration-200 transform active:scale-90 ml-2 ${playbackState === 'loading' ? 'text-gray-400 cursor-not-allowed' : 'text-sky-600 hover:bg-sky-600/10'}`}>
      {renderIcon()}
    </span>
  );
};

// --- TTS 功能模块结束 ---

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const TingYinShiCi = ({ title = '听音诗词', isShuffle = 'false', quizData }) => {
  const [quiz, setQuiz] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      let parsedData = Array.isArray(quizData) ? quizData : JSON.parse(quizData);
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        setError('题库数据 (quizData) 为空或格式不正确。'); return;
      }
      setQuiz(String(isShuffle) === 'true' ? shuffleArray(parsedData) : parsedData);
      setCurrentQuestionIndex(0); setScore(0); setSelectedAnswer(null); setIsAnswered(false); setError(null);
    } catch (e) { setError(`题库数据解析失败: ${e.message}`); }
  }, [quizData, isShuffle]);

  useEffect(() => {
    if (quiz.length > 0 && currentQuestionIndex < quiz.length) {
      const currentQuestion = quiz[currentQuestionIndex];
      setOptions(shuffleArray([currentQuestion.answer, ...currentQuestion.distractors]));
    }
  }, [quiz, currentQuestionIndex]);

  const handleAnswerClick = (option) => {
    if (isAnswered) return;
    setSelectedAnswer(option);
    setIsAnswered(true);
    if (option === quiz[currentQuestionIndex].answer) setScore(s => s + 1);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
    } else {
      alert(`挑战完成！你的得分是: ${score + (selectedAnswer === quiz[currentQuestionIndex].answer ? 1 : 0)} / ${quiz.length}`);
    }
  };
  
  const handleRestart = () => {
      const parsedData = Array.isArray(quizData) ? quizData : JSON.parse(quizData);
      setQuiz(String(isShuffle) === 'true' ? shuffleArray(parsedData) : parsedData);
      setCurrentQuestionIndex(0); setScore(0); setSelectedAnswer(null); setIsAnswered(false);
  }

  if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
  if (quiz.length === 0) return <div className="p-4 text-center text-gray-500">正在加载题库...</div>;

  const currentQuestion = quiz[currentQuestionIndex];
  const isCorrect = selectedAnswer === currentQuestion.answer;

  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-center mb-2 text-dark-DEFAULT dark:text-gray-1">{title}</h1>
        <div className="flex justify-between text-sm text-body-color dark:text-dark-7">
          <span>题目: {currentQuestionIndex + 1} / {quiz.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-2 dark:bg-dark-2">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div>
        </div>
      </div>
      <div className="whitespace-pre-wrap text-center text-xl p-4 my-6 bg-gray-1 dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 flex items-center justify-center">
        {currentQuestion.question}
        <TTSButton textToSpeak={currentQuestion.audio} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, i) => {
          let classes = 'w-full text-center p-4 rounded-lg border-2 transition-all duration-300 font-semibold ';
          if (isAnswered) {
            if (option === currentQuestion.answer) classes += 'bg-secondary/10 border-secondary text-secondary ring-2 ring-secondary';
            else if (option === selectedAnswer) classes += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900/50 dark:border-red-700 dark:text-red-400 animate-shake';
            else classes += 'bg-gray-100 border-gray-300 text-gray-500 opacity-60 dark:bg-dark-2 dark:border-dark-3 dark:text-dark-7';
            classes += ' pointer-events-none';
          } else {
            classes += 'bg-white dark:bg-dark-2 border-gray-300 dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 hover:border-primary hover:text-primary hover:shadow-md';
          }
          return <button key={i} onClick={() => handleAnswerClick(option)} disabled={isAnswered} className={classes}>{option}</button>;
        })}
      </div>
      {isAnswered && (
        <div className="mt-6 animate-fade-in-up">
          <div className="p-4 rounded-lg bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 shadow-inner">
            <div className={`flex items-center mb-3 font-bold ${isCorrect ? 'text-secondary' : 'text-red-600 dark:text-red-400'}`}>
              {isCorrect ? <FaCheckCircle className="mr-2"/> : <FaTimesCircle className="mr-2"/>}
              {isCorrect ? '回答正确！' : `回答错误。正确答案是: ${currentQuestion.answer}`}
            </div>
            {currentQuestion.pinyin && <p className="text-body-color dark:text-dark-7"><strong>拼音：</strong> {currentQuestion.pinyin}</p>}
            {currentQuestion.explanation && <p className="text-body-color dark:text-dark-7 mt-1"><strong>解析：</strong> {currentQuestion.explanation}</p>}
          </div>
          <div className="mt-4 flex justify-end space-x-4">
             <button onClick={handleRestart} className="px-6 py-2 bg-gray-500 text-white font-medium rounded-lg shadow-md hover:bg-gray-600">
                <FaRedo className="inline-block"/> 重来
             </button>
             <button onClick={handleNextQuestion} className="px-6 py-2 bg-primary text-white font-medium rounded-lg shadow-md hover:bg-blue-dark">
                {currentQuestionIndex < quiz.length - 1 ? '下一题' : '查看结果'}
             </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TingYinShiCi
