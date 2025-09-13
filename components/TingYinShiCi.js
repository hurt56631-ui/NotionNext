// /components/TingYinShiCi.js

'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// 文本清理函数
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  let cleaned = text;
  // ... (您的清理规则)
  return cleaned.replace(/\s+/g, ' ').trim();
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
  // =========================================================================
  // [核心修改] 智能解析两种不同的 props 格式
  // =========================================================================
  const { quizTitle, numOptions, isShuffle, quizData, error: parseError } = useMemo(() => {
    try {
      // 检查是否是单行 JSON 格式: !include ... {"config": "{...}"} or !include ... {"prop":"value"}
      // NotionNext 会把整个 {...} 作为名为 'config' 的 prop 传入
      if (props.config) {
        const parsedConfig = JSON.parse(props.config);
        // 在单行JSON格式中，quizData/flashcards 本身也是一个字符串，需要再次解析
        const data = JSON.parse(parsedConfig.quizData || parsedConfig.flashcards || '[]');
        return {
          quizTitle: parsedConfig.quizTitle || '听音识词',
          numOptions: parseInt(parsedConfig.numOptions, 10) || 4,
          isShuffle: parsedConfig.isShuffle === 'true' || parsedConfig.isShuffle === true,
          quizData: data
        };
      }
      
      // 检查是否是多行 G-Prop 格式: !include- ... -G prop=`value`
      if (props.quizData) {
        const data = JSON.parse(props.quizData);
        return {
          quizTitle: props.quizTitle || '听音识词',
          numOptions: parseInt(props.numOptions, 10) || 4,
          isShuffle: props.isShuffle === 'true',
          quizData: data
        };
      }
      
      // 如果两种格式都没有，则返回错误
      return { error: '未提供题库数据 (quizData) 或组件配置 (config)。' };

    } catch (e) {
      console.error('解析组件属性失败:', e);
      return { error: `组件属性解析失败，请检查Notion代码块中的JSON格式。错误: ${e.message}` };
    }
  }, [props]);
  // =========================================================================


  const [quiz, setQuiz] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [options, setOptions] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [score, setScore] = useState(0)
  const [quizState, setQuizState] = useState('playing') // 'playing', 'answered', 'finished'
  const [ttsLoading, setTtsLoading] = useState(false)

  const audioRef = useRef(null);

  // 初始化数据
  useEffect(() => {
    if (quizData && quizData.length > 0) {
      setQuiz(isShuffle ? shuffleArray(quizData) : quizData);
      setQuizState('playing');
    }
  }, [quizData, isShuffle]);


  // 组件卸载时清理音频资源
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
      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
        setTtsLoading(false);
        if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS 朗读失败:', err);
      setTtsLoading(false);
    }
  }, [ttsLoading]);
  
  // 生成选项并自动朗读
  useEffect(() => {
    if (quiz.length > 0 && currentQuestionIndex < quiz.length) {
      const currentQuestion = quiz[currentQuestionIndex];
      const otherWords = quiz.filter(item => item.word !== currentQuestion.word);
      const distractors = shuffleArray(otherWords).slice(0, numOptions - 1);
      const allOptions = shuffleArray([currentQuestion, ...distractors]);
      setOptions(allOptions);
      speak(currentQuestion.word);
    }
  }, [currentQuestionIndex, quiz, numOptions, speak]);


  const handleAnswerClick = (option) => {
    if (quizState === 'answered') return;
    const currentQuestion = quiz[currentQuestionIndex];
    setSelectedAnswer(option.word);
    if (option.word === currentQuestion.word) {
      setIsCorrect(true);
      setScore(prevScore => prevScore + 1);
    } else {
      setIsCorrect(false);
    }
    setQuizState('answered');
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setQuizState('playing');
    } else {
      setQuizState('finished');
    }
  };
  
  const handleRestart = () => {
    setQuiz(isShuffle ? shuffleArray(quizData) : quizData);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setQuizState('playing');
  };
  
  // ... (剩余的UI渲染部分代码保持不变) ...
  // getButtonClass 函数, 返回的 JSX 结构等
  
  const getButtonClass = (option) => {
    const baseClass = 'w-full text-left p-4 my-2 rounded-lg border-2 transition-all duration-300 transform hover:scale-105'
    if (quizState === 'answered') {
      const currentQuestion = quiz[currentQuestionIndex]
      if (option.word === currentQuestion.word) {
        return `${baseClass} bg-green-100 border-green-500 text-green-800`
      }
      if (option.word === selectedAnswer && !isCorrect) {
        return `${baseClass} bg-red-100 border-red-500 text-red-800`
      }
      return `${baseClass} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed`
    }
    return `${baseClass} bg-white border-gray-300 hover:bg-blue-50 hover:border-blue-500`
  }

  if (parseError) {
    return <div className="max-w-2xl mx-auto p-6 bg-red-100 text-red-700 rounded-lg shadow-md">{parseError}</div>
  }
  if (!quizData || quiz.length === 0) {
    return <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md text-center">正在加载题库...</div>
  }
  const currentQuestion = quiz[currentQuestionIndex];
  if (!currentQuestion) return null; // 防止在数据切换时出现瞬间的 undefined 错误

  if (quizState === 'finished') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-lg text-center transition-all duration-500">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">挑战完成!</h2>
        <p className="text-xl text-gray-600 mb-6">你的得分是：<span className="text-4xl font-extrabold text-blue-600">{score}</span> / {quiz.length}</p>
        <button onClick={handleRestart} className="flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"><FaRedo className="mr-2" />再来一次</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg font-sans">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">{quizTitle}</h1>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>进度: {currentQuestionIndex + 1} / {quiz.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2"><div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div></div>
      </div>
      <div className="text-center mb-6">
        <p className="text-gray-600 mb-3">请听发音，选择正确的词语：</p>
        <button onClick={() => speak(currentQuestion.word)} disabled={ttsLoading} className="p-6 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110 disabled:opacity-50">
          {ttsLoading ? (<svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<FaVolumeUp size={40} />)}
        </button>
      </div>
      <div>{options.map((option, index) => (<button key={index} onClick={() => handleAnswerClick(option)} className={getButtonClass(option)} disabled={quizState === 'answered'}>{option.word}</button>))}</div>
      {quizState === 'answered' && (
        <div className="mt-6 p-4 rounded-lg animate-fade-in">
          {isCorrect ? (
            <div className="flex items-center text-green-700 bg-green-100 p-4 rounded-lg">
              <FaCheckCircle className="mr-3 text-2xl" />
              <div>
                <p className="font-bold">回答正确！</p>
                <p className="text-sm">{currentQuestion.pinyin} - {currentQuestion.meaning}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center text-red-700 bg-red-100 p-4 rounded-lg">
              <FaTimesCircle className="mr-3 text-2xl" />
              <div>
                <p className="font-bold">回答错误。</p>
                <p className="text-sm">正确答案是: {currentQuestion.word}</p>
              </div>
            </div>
          )}
          <button onClick={handleNextQuestion} className="w-full mt-4 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-gray-900">{currentQuestionIndex === quiz.length - 1 ? '查看结果' : '下一题'}</button>
        </div>
      )}
    </div>
  )
};

export default TingYinShiCi;
