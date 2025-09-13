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

// =========================================================================
// [核心] 模仿 BeiDanCi.js 的 props 解析模式
// 组件直接接收所有 props，然后在 useEffect 中处理它们
// =========================================================================
const TingYinShiCi = (props) => {
  // 从 props 中解构，并提供默认值
  const {
    quizData: quizDataProp,
    questionTitle: questionTitleProp = '听音识词',
    numOptions: numOptionsProp = 4,
    isShuffle: isShuffleProp = false
  } = props;

  const [displayData, setDisplayData] = useState([]);
  const [quizTitle, setQuizTitle] = useState(questionTitleProp);
  const [numOptions, setNumOptions] = useState(numOptionsProp);
  const [isShuffle, setIsShuffle] = useState(isShuffleProp);
  const [error, setError] = useState(null);
  
  // 使用 useEffect 来安全地解析 props，这与 BeiDanCi.js 的模式完全相同
  useEffect(() => {
    try {
      // 兼容单行JSON模式，整个JSON对象会被NotionNext放入一个名为 'config' 的 prop
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
        return;
      }
      
      setDisplayData(parsedData);
      setQuizTitle(effectiveProps.questionTitle || '听音识词');
      setNumOptions(parseInt(effectiveProps.numOptions, 10) || 4);
      setIsShuffle(String(effectiveProps.isShuffle) === 'true');
      setError(null); // 如果成功，清除之前的错误

    } catch (e) {
      console.error("解析组件属性失败:", e);
      setError(`组件属性解析失败，请检查Notion代码块中的JSON格式。错误: ${e.message}`);
    }
  }, [props]); // 每当 props 变化时重新解析


  // --- 以下是组件的内部状态和逻辑 ---
  const [quiz, setQuiz] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [quizState, setQuizState] = useState('playing');
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (displayData.length > 0) {
      const initialQuiz = isShuffle ? shuffleArray(displayData) : displayData;
      setQuiz(initialQuiz);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setQuizState('playing');
    }
  }, [displayData, isShuffle]);
  
  useEffect(() => { return () => { if (audioRef.current) audioRef.current.pause(); }; }, []);

  const speak = useCallback(async (text) => {
    if (!text || ttsLoading) return;
    setTtsLoading(true);
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural&r=-20`;
    try {
      const response = await fetch(url);
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) audioRef.current.src = audioUrl;
      else audioRef.current = new Audio(audioUrl);
      
      audioRef.current.onended = () => {
        setTtsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audioRef.current.play();
    } catch (e) {
      setTtsLoading(false);
    }
  }, [ttsLoading]);

  useEffect(() => {
    if (quizState === 'playing' && quiz.length > 0) {
      const currentQuestion = quiz[currentQuestionIndex];
      const otherWords = quiz.filter(item => item.word !== currentQuestion.word);
      const distractors = shuffleArray(otherWords).slice(0, numOptions - 1);
      const allOptions = shuffleArray([currentQuestion, ...distractors]);
      setOptions(allOptions);
      speak(currentQuestion.word);
    }
  }, [quiz, currentQuestionIndex, quizState, numOptions, speak]);
  
  // ... (剩余的UI渲染和事件处理函数)
  const handleAnswerClick = (option) => { if (quizState === 'answered') return; const q = quiz[currentQuestionIndex]; setSelectedAnswer(option.word); if (option.word === q.word) { setIsCorrect(true); setScore(s => s + 1); } else { setIsCorrect(false); } setQuizState('answered'); };
  const handleNextQuestion = () => { if (currentQuestionIndex < quiz.length - 1) { setCurrentQuestionIndex(i => i + 1); } else { setQuizState('finished'); } setSelectedAnswer(null); setIsCorrect(null); setQuizState('playing'); };
  const handleRestart = () => { setQuiz(isShuffle ? shuffleArray(displayData) : displayData); setCurrentQuestionIndex(0); setScore(0); setQuizState('playing'); };
  
  const getButtonClass = (option) => {
    const base = 'w-full text-left p-4 my-2 rounded-lg border-2 transition-colors';
    if (quizState === 'answered') {
      const isCorrectAnswer = option.word === quiz[currentQuestionIndex].word;
      const isSelectedWrong = option.word === selectedAnswer && !isCorrect;
      if (isCorrectAnswer) return `${base} bg-green-100 border-green-500`;
      if (isSelectedWrong) return `${base} bg-red-100 border-red-500`;
      return `${base} bg-gray-100 border-gray-300 text-gray-400`;
    }
    return `${base} bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500`;
  };

  if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;
  if (quiz.length === 0) return <div className="p-4 text-center">正在加载...</div>;

  const currentQuestion = quiz[currentQuestionIndex];
  if (!currentQuestion) return null;
  
  if (quizState === 'finished') { return <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg text-center"><h2 className="text-2xl font-bold mb-4">挑战完成!</h2><p className="text-lg mb-6">你的得分: <span className="font-bold text-3xl text-blue-600">{score}</span> / {quiz.length}</p><button onClick={handleRestart} className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"><FaRedo className="mr-2"/>再来一次</button></div>; }
  
  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-center mb-2">{quizTitle}</h1>
        <div className="flex justify-between text-sm text-gray-500"><span>{currentQuestionIndex + 1} / {quiz.length}</span><span>得分: {score}</span></div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-1"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div></div>
      </div>
      <div className="text-center my-6"><button onClick={() => speak(currentQuestion.word)} disabled={ttsLoading} className="p-5 bg-blue-500 text-white rounded-full shadow-lg disabled:opacity-50">{ttsLoading ? '...' : <FaVolumeUp size={30}/>}</button></div>
      <div>{options.map((opt, i) => <button key={i} onClick={() => handleAnswerClick(opt)} className={getButtonClass(opt)} disabled={quizState === 'answered'}>{opt.word}</button>)}</div>
      {quizState === 'answered' && (<div className="mt-4"><div className={`p-3 rounded-lg flex items-center ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>{isCorrect ? <FaCheckCircle className="text-green-500 mr-2"/> : <FaTimesCircle className="text-red-500 mr-2"/>}{isCorrect ? `正确！${currentQuestion.pinyin}` : `错误。正确答案是 ${currentQuestion.word}`}</div><button onClick={handleNextQuestion} className="w-full mt-2 py-2 bg-gray-800 text-white rounded-lg">{currentQuestionIndex < quiz.length - 1 ? '下一题' : '完成'}</button></div>)}
    </div>
  );
};

export default TingYinShiCi;
