// /components/TingYinShiCi.js

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// 工具函数：洗牌数组
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const TingYinShiCi = (props) => {
  // ----------------------------------------------------------------------
  // 1. 状态管理 State Management
  // ----------------------------------------------------------------------
  const [quiz, setQuiz] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [quizState, setQuizState] = useState('playing'); // playing, answered, finished
  const [ttsLoading, setTtsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  
  // ----------------------------------------------------------------------
  // 2. Props 解析 (完全模仿 BeiDanCi.js 的模式)
  // ----------------------------------------------------------------------
  useEffect(() => {
    try {
      // NotionNext 的 !include ... {...} 语法会将整个 JSON 对象作为字符串放在 props.config 中
      let effectiveProps = props;
      if (props.config && typeof props.config === 'string') {
        effectiveProps = JSON.parse(props.config);
      }

      const dataProp = effectiveProps.quizData || effectiveProps.flashcards; // 兼容 flashcards
      let parsedData = [];

      if (typeof dataProp === 'string') {
        parsedData = JSON.parse(dataProp);
      } else if (Array.isArray(dataProp)) {
        parsedData = dataProp;
      }
      
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        setError('题库数据 (quizData) 为空或格式不正确。');
        setQuiz([]);
        return;
      }

      const shuffle = String(effectiveProps.isShuffle) === 'true';
      setQuiz(shuffle ? shuffleArray(parsedData) : parsedData);
      
      // 重置状态
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setQuizState('playing');
      setError(null);

    } catch (e) {
      console.error("解析组件属性失败:", e);
      setError(`组件属性解析失败: ${e.message}`);
      setQuiz([]);
    }
  }, [props]); // 依赖整个 props 对象，当 Notion 代码块变化时重新初始化

  // ----------------------------------------------------------------------
  // 3. 核心功能 Logic
  // ----------------------------------------------------------------------
  const speak = useCallback(async (text) => {
    if (!text || ttsLoading) return;
    setTtsLoading(true);
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural&r=-20`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('TTS API request failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setTtsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => setTtsLoading(false);
      audio.play();
      
    } catch (e) {
      console.error("TTS Error:", e);
      setTtsLoading(false);
    }
  }, [ttsLoading]);

  // 生成选项并自动朗读
  useEffect(() => {
    if (quizState === 'playing' && quiz.length > 0) {
      const currentQuestion = quiz[currentQuestionIndex];
      const { questionTitle = '听音识词', numOptions = 4 } = props;

      const otherWords = quiz.filter(item => item.word !== currentQuestion.word);
      const distractors = shuffleArray(otherWords).slice(0, numOptions - 1);
      const allOptions = shuffleArray([currentQuestion, ...distractors]);
      
      setOptions(allOptions);
      speak(currentQuestion.word);
    }
  }, [quiz, currentQuestionIndex, quizState, props, speak]);

  const handleAnswerClick = (option) => {
    if (quizState === 'answered') return;
    const currentQuestion = quiz[currentQuestionIndex];
    setSelectedAnswer(option.word);
    if (option.word === currentQuestion.word) {
      setIsCorrect(true);
      setScore(s => s + 1);
    } else {
      setIsCorrect(false);
    }
    setQuizState('answered');
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      setQuizState('playing');
    } else {
      setQuizState('finished');
    }
    setSelectedAnswer(null);
    setIsCorrect(null);
  };

  const handleRestart = () => {
    // 重新解析 props 来重置
    const event = new Event('reset');
    window.dispatchEvent(event);
    // 这是一个技巧，通过改变 props 的引用来触发 useEffect 重新运行
    const newProps = {...props};
    // 实际上，我们只需要在 useEffect 中处理重置逻辑
    const shuffle = String(props.isShuffle) === 'true';
    const parsedData = JSON.parse(props.quizData);
    setQuiz(shuffle ? shuffleArray(parsedData) : parsedData);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setQuizState('playing');
  };

  // ----------------------------------------------------------------------
  // 4. 渲染 UI (Rendering)
  // ----------------------------------------------------------------------
  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
  }
  if (quiz.length === 0) {
    return <div className="p-4 text-center text-gray-500">正在加载题库或题库为空...</div>;
  }

  const currentQuestion = quiz[currentQuestionIndex];
  if (!currentQuestion) return null;

  const { questionTitle = '听音识词' } = props;

  if (quizState === 'finished') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg text-center">
        <h2 className="text-2xl font-bold mb-4">挑战完成!</h2>
        <p className="text-lg mb-6">你的得分: <span className="font-bold text-3xl text-blue-600">{score}</span> / {quiz.length}</p>
        <button onClick={handleRestart} className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center">
          <FaRedo className="mr-2"/>再来一次
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-center mb-2">{questionTitle}</h1>
        <div className="flex justify-between text-sm text-gray-500">
          <span>{currentQuestionIndex + 1} / {quiz.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-1">
          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div>
        </div>
      </div>
      
      <div className="text-center my-6">
        <button onClick={() => speak(currentQuestion.word)} disabled={ttsLoading} className="p-5 bg-blue-500 text-white rounded-full shadow-lg disabled:opacity-50">
          {ttsLoading ? '...' : <FaVolumeUp size={30}/>}
        </button>
      </div>
      
      <div>
        {options.map((opt, i) => (
          <button 
            key={i} 
            onClick={() => handleAnswerClick(opt)} 
            className={`w-full text-left p-4 my-2 rounded-lg border-2 transition-colors ${quizState === 'answered' ? (opt.word === currentQuestion.word ? 'bg-green-100 border-green-500' : (opt.word === selectedAnswer ? 'bg-red-100 border-red-500' : 'bg-gray-100 border-gray-300')) : 'bg-white border-gray-300 hover:bg-blue-50'}`}
            disabled={quizState === 'answered'}
          >
            {opt.word}
          </button>
        ))}
      </div>
      
      {quizState === 'answered' && (
        <div className="mt-4">
          <div className={`p-3 rounded-lg flex items-center ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
            {isCorrect ? <FaCheckCircle className="text-green-500 mr-2"/> : <FaTimesCircle className="text-red-500 mr-2"/>}
            {isCorrect ? `正确！${currentQuestion.pinyin}` : `错误。正确答案是 ${currentQuestion.word}`}
          </div>
          <button onClick={handleNextQuestion} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg">
            {currentQuestionIndex < quiz.length - 1 ? '下一题' : '完成'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TingYinShiCi;
