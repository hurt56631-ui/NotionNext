// /components/TingYinShiCi.js

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// 文本清理函数 (可根据需要自行修改)
const cleanTextForSpeech = (text) => {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
};

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
  const [quizData, setQuizData] = useState([]);
  const [quizTitle, setQuizTitle] = useState('听音识词');
  const [numOptions, setNumOptions] = useState(4);
  const [isShuffle, setIsShuffle] = useState(false);
  const [error, setError] = useState(null);

  // =========================================================================
  // [核心修改] 模仿 BeiDanCi.js 的 props 解析逻辑
  // =========================================================================
  useEffect(() => {
    try {
        // NotionNext 的 !include ... {...} 语法会将整个 JSON 对象作为字符串放在 props.config 中
        let config = {};
        if (props.config && typeof props.config === 'string') {
            config = JSON.parse(props.config);
        } else {
            // 兼容 -G propName = `value` 格式
            config = props;
        }

        // 解析 quizData
        let data = [];
        const quizDataProp = config.quizData || config.flashcards; // 兼容 flashcards 字段
        if (typeof quizDataProp === 'string') {
            data = JSON.parse(quizDataProp);
        } else if (Array.isArray(quizDataProp)) {
            data = quizDataProp;
        }
        if (!Array.isArray(data) || data.length === 0) {
            setError('题库数据 (quizData) 为空或格式不正确。');
        }
        setQuizData(data);
        
        // 解析其他配置
        setQuizTitle(config.quizTitle || '听音识词');
        setNumOptions(parseInt(config.numOptions, 10) || 4);
        setIsShuffle(String(config.isShuffle) === 'true');

    } catch(e) {
        console.error("解析组件属性失败:", e);
        setError(`组件属性解析失败，请检查Notion代码块中的JSON格式。错误: ${e.message}`);
    }
  }, [props]);
  // =========================================================================

  const [quiz, setQuiz] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [options, setOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [quizState, setQuizState] = useState('playing');
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef(null);
  
  // 初始化或当配置改变时，重置quiz
  useEffect(() => {
    if (quizData.length > 0) {
      setQuiz(isShuffle ? shuffleArray(quizData) : quizData);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setQuizState('playing');
    }
  }, [quizData, isShuffle]);

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

  // TTS 朗读函数
  const speak = useCallback(async (textToSpeak) => {
    if (ttsLoading) return;
    const cleanedText = cleanTextForSpeech(textToSpeak);
    if (!cleanedText) return;

    setTtsLoading(true);
    if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
        }
    }
    
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(cleanedText)}&v=zh-CN-XiaochenMultilingualNeural&r=-20&p=0&o=audio-24khz-48kbitrate-mono-mp3`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`TTS API Error: ${response.statusText}`);
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setTtsLoading(false);
        if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => { setTtsLoading(false); if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl); };
      await audio.play();
    } catch (err) {
      setTtsLoading(false);
    }
  }, [ttsLoading]);
  
  // 生成选项并自动朗读
  useEffect(() => {
    if (quizState === 'playing' && quiz.length > 0 && currentQuestionIndex < quiz.length) {
      const currentQuestion = quiz[currentQuestionIndex];
      const otherWords = quiz.filter(item => item.word !== currentQuestion.word);
      const distractors = shuffleArray(otherWords).slice(0, numOptions - 1);
      const allOptions = shuffleArray([currentQuestion, ...distractors]);
      setOptions(allOptions);
      speak(currentQuestion.word);
    }
  }, [currentQuestionIndex, quiz, numOptions, speak, quizState]);

  // ... (所有 handle* 函数和 UI 渲染代码与上一版基本一致，这里省略部分以节约篇幅)
  const handleAnswerClick = (option) => { if (quizState !== 'answered') { const currentQuestion = quiz[currentQuestionIndex]; setSelectedAnswer(option.word); if (option.word === currentQuestion.word) { setIsCorrect(true); setScore(prev => prev + 1); } else { setIsCorrect(false); } setQuizState('answered'); }};
  const handleNextQuestion = () => { if (currentQuestionIndex < quiz.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setSelectedAnswer(null); setIsCorrect(null); setQuizState('playing'); } else { setQuizState('finished'); }};
  const handleRestart = () => { setQuiz(isShuffle ? shuffleArray(quizData) : quizData); setCurrentQuestionIndex(0); setScore(0); setSelectedAnswer(null); setIsCorrect(null); setQuizState('playing'); };
  const getButtonClass = (option) => { const base = 'w-full text-left p-4 my-2 rounded-lg border-2 transition-all duration-300'; if (quizState === 'answered') { const correctWord = quiz[currentQuestionIndex].word; if (option.word === correctWord) return `${base} bg-green-100 border-green-500`; if (option.word === selectedAnswer) return `${base} bg-red-100 border-red-500`; return `${base} bg-gray-100 border-gray-300 cursor-not-allowed`; } return `${base} bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500`; };

  if (error) { return <div className="w-full mx-auto my-8 p-6 bg-red-100 dark:bg-red-900/50 rounded-xl shadow-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300">{error}</div>; }
  if (quiz.length === 0) { return <div className="text-center p-8">正在加载或没有数据...</div>; }
  
  const currentQuestion = quiz[currentQuestionIndex];
  if (!currentQuestion) return null;

  if (quizState === 'finished') { return <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-lg text-center"><h2 className="text-3xl font-bold mb-4">挑战完成!</h2><p className="text-xl mb-6">得分: <span className="text-4xl font-extrabold text-blue-600">{score}</span> / {quiz.length}</p><button onClick={handleRestart} className="flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"><FaRedo className="mr-2"/>再来一次</button></div>; }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg font-sans">
      <div className="mb-6"><h1 className="text-2xl font-bold text-center text-gray-800 mb-2">{quizTitle}</h1><div className="flex justify-between text-sm text-gray-500"><span>进度: {currentQuestionIndex + 1} / {quiz.length}</span><span>得分: {score}</span></div><div className="w-full bg-gray-200 rounded-full h-2.5 mt-2"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div></div></div>
      <div className="text-center mb-6"><p className="text-gray-600 mb-3">请听发音，选择正确的词语：</p><button onClick={() => speak(currentQuestion.word)} disabled={ttsLoading} className="p-6 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 disabled:opacity-50">{ttsLoading ? (<svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg>) : (<FaVolumeUp size={40}/>)}</button></div>
      <div>{options.map((option, i) => <button key={i} onClick={() => handleAnswerClick(option)} className={getButtonClass(option)} disabled={quizState === 'answered'}>{option.word}</button>)}</div>
      {quizState === 'answered' && (<div className="mt-6 p-4 rounded-lg"><div className={`flex items-center p-4 rounded-lg ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isCorrect ? <FaCheckCircle className="mr-3 text-2xl"/> : <FaTimesCircle className="mr-3 text-2xl"/>}<div><p className="font-bold">{isCorrect ? '回答正确！' : '回答错误。'}</p><p className="text-sm">{isCorrect ? `${currentQuestion.pinyin} - ${currentQuestion.meaning}` : `正确答案是: ${currentQuestion.word}`}</p></div></div><button onClick={handleNextQuestion} className="w-full mt-4 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-gray-900">{currentQuestionIndex === quiz.length - 1 ? '查看结果' : '下一题'}</button></div>)}
    </div>
  );
};

export default TingYinShiCi;
