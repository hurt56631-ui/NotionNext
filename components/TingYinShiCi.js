// /components/TingYinShiCi.js

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// [新增] 同步高级朗读规则
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

// 工具函数：洗牌数组
const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// =========================================================================
// [修改] 组件接收一个名为 `config` 的 JSON 字符串作为 Prop
// =========================================================================
const TingYinShiCi = ({ config }) => {
  const [quiz, setQuiz] = useState([])
  const [initialQuizData, setInitialQuizData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [options, setOptions] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [score, setScore] = useState(0)
  const [quizState, setQuizState] = useState('loading-data') // 'loading-data', 'playing', 'answered', 'finished'
  const [ttsLoading, setTtsLoading] = useState(false)
  const [error, setError] = useState(null)

  const audioRef = useRef(null);

  // 解析 config prop
  const parsedConfig = useMemo(() => {
    try {
      return JSON.parse(config);
    } catch (e) {
      console.error('Failed to parse config prop:', e);
      setError('组件配置数据格式错误，请检查 Notion 代码块中的 JSON。');
      return {};
    }
  }, [config]);

  // 从 config 中提取属性
  const quizTitle = parsedConfig.quizTitle || '听音识词';
  const dataPageId = parsedConfig.dataPageId;
  const isShuffle = parsedConfig.isShuffle === true || parsedConfig.isShuffle === 'true'; // 兼容布尔值和字符串
  const numOptions = parseInt(parsedConfig.numOptions, 10) || 4;


  // 从 Notion API 获取题库数据
  useEffect(() => {
    const fetchQuizData = async () => {
      if (!dataPageId) {
        setError('请提供一个 Notion 页面 ID (dataPageId) 来加载题库。');
        return;
      }
      setQuizState('loading-data');
      setError(null);

      try {
        const response = await fetch(`/api/get-page-data?pageId=${dataPageId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch Notion page data: ${response.statusText}`);
        }
        const data = await response.json();
        
        const codeBlock = data.block.find(
          block => block.type === 'code' && block.properties?.language?.[0]?.[0] === 'json'
        );

        if (!codeBlock || !codeBlock.properties?.title?.[0]?.[0]) {
          throw new Error('Notion 页面中未找到 JSON 格式的代码块。请确保将题库数据放在一个 JSON 代码块中。');
        }

        const jsonString = codeBlock.properties.title[0][0];
        const parsedData = JSON.parse(jsonString);

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          throw new Error('解析的题库数据不是有效的数组或为空。');
        }
        
        setInitialQuizData(parsedData);
        setQuiz(isShuffle ? shuffleArray(parsedData) : parsedData); // 使用 isShuffle 布尔值
        setQuizState('playing');

      } catch (e) {
        console.error('Failed to fetch or parse quiz data from Notion:', e);
        setError(`加载题库失败: ${e.message}`);
        setQuizState('finished');
      }
    };

    if (config && dataPageId) { // 确保 config 和 dataPageId 都存在才 fetchData
        fetchQuizData();
    } else if (!config) {
        setError('组件配置 (config) 为空或无效。');
    }
  }, [dataPageId, isShuffle, config]); // 依赖 config, dataPageId, isShuffle

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
    };
  }, []);

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
      audioRef.current = null;
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
        if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
        }
      };
      audio.onerror = (e) => {
        console.error('音频播放错误:', e);
        alert('音频播放失败，请稍后再试。');
        setTtsLoading(false);
        if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
        }
      };

      await audio.play();
    } catch (err) {
      console.error('TTS 朗读失败:', err);
      alert('无法连接到语音服务，请检查网络或稍后再试。');
      setTtsLoading(false);
    }
  }, [ttsLoading]);

  useEffect(() => {
    if (quizState === 'playing' && quiz.length > 0 && currentQuestionIndex < quiz.length) {
      const currentQuestion = quiz[currentQuestionIndex]
      
      const otherWords = quiz.filter(item => item.word !== currentQuestion.word)
      const distractors = shuffleArray(otherWords).slice(0, numOptions - 1) // 使用 numOptions 变量
      
      const allOptions = shuffleArray([currentQuestion, ...distractors])
      setOptions(allOptions)
      
      speak(currentQuestion.word)
    }
  }, [currentQuestionIndex, quiz, speak, quizState, numOptions]) // numOptions 作为依赖

  const handleAnswerClick = (option) => {
    if (quizState === 'answered' || quizState === 'loading-data') return;

    const currentQuestion = quiz[currentQuestionIndex]
    setSelectedAnswer(option.word)
    
    if (option.word === currentQuestion.word) {
      setIsCorrect(true)
      setScore(prevScore => prevScore + 1)
    } else {
      setIsCorrect(false)
    }
    setQuizState('answered')

    if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
        setTtsLoading(false);
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setQuizState('playing')
    } else {
      setQuizState('finished')
    }
  }
  
  const handleRestart = () => {
    if (!initialQuizData) {
        setError('无法重新开始，原始题库数据丢失。');
        return;
    }
    setQuiz(isShuffle ? shuffleArray(initialQuizData) : initialQuizData); // 使用 isShuffle 布尔值
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setScore(0)
    setQuizState('playing')
  }

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

  if (error) {
    return <div className="max-w-2xl mx-auto p-6 bg-red-100 text-red-700 rounded-lg shadow-md">{error}</div>
  }
  
  if (quizState === 'loading-data' || quiz.length === 0) {
    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md text-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">正在从 Notion 加载题库...</p>
        </div>
    );
  }

  const currentQuestion = quiz[currentQuestionIndex]

  if (quizState === 'finished') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-lg text-center transition-all duration-500">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">挑战完成!</h2>
        <p className="text-xl text-gray-600 mb-6">
          你的得分是：<span className="text-4xl font-extrabold text-blue-600">{score}</span> / {quiz.length}
        </p>
        <button
          onClick={handleRestart}
          className="flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
        >
          <FaRedo className="mr-2" />
          再来一次
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg font-sans">
      {/* 标题和进度 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">{quizTitle}</h1>
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>进度: {currentQuestionIndex + 1} / {quiz.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* 听力播放区 */}
      <div className="text-center mb-6">
        <p className="text-gray-600 mb-3">请听发音，选择正确的词语：</p>
        <button
          onClick={() => speak(currentQuestion.word)}
          disabled={ttsLoading}
          className="p-6 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="重播发音"
        >
          {ttsLoading ? (
            <svg className="animate-spin h-7 w-7 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <FaVolumeUp size={40} />
          )}
        </button>
      </div>

      {/* 选项区 */}
      <div>
        {options.map((option, index) => (
          <button key={index} onClick={() => handleAnswerClick(option)} className={getButtonClass(option)} disabled={quizState === 'answered' || quizState === 'loading-data'}>
            <span className="text-lg font-medium">{option.word}</span>
          </button>
        ))}
      </div>

      {/* 反馈和下一题按钮 */}
      {quizState === 'answered' && (
        <div className="mt-6 p-4 rounded-lg bg-opacity-80 animate-fade-in">
          {isCorrect ? (
            <div className="flex items-center text-green-700 bg-green-100 p-4 rounded-lg">
              <FaCheckCircle className="mr-3 text-2xl" />
              <div>
                <p className="font-bold">回答正确！</p>
                <p className="text-sm">{currentQuestion.pinyin} - {currentQuestion.meaning}</p>
                {/* 详情卡片，可点击朗读例句 */}
                <div className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2">
                  <p className="font-semibold">例句1:</p>
                  <div className="flex items-center justify-between">
                    <span>{currentQuestion.example1}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); speak(currentQuestion.example1); }}
                      disabled={ttsLoading}
                      className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="朗读例句1"
                    >
                       {ttsLoading ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <FaVolumeUp size={16} />
                        )}
                    </button>
                  </div>
                  <p className="text-gray-500">{currentQuestion.example1Translation}</p>
                  {currentQuestion.example2 && (
                    <>
                      <p className="font-semibold mt-1">例句2:</p>
                      <div className="flex items-center justify-between">
                        <span>{currentQuestion.example2}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); speak(currentQuestion.example2); }}
                          disabled={ttsLoading}
                          className="ml-2 p-1 rounded-full text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="朗读例句2"
                        >
                          {ttsLoading ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <FaVolumeUp size={16} />
                        )}
                        </button>
                      </div>
                      <p className="text-gray-500">{currentQuestion.example2Translation}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center text-red-700 bg-red-100 p-4 rounded-lg">
              <FaTimesCircle className="mr-3 text-2xl" />
              <div>
                <p className="font-bold">回答错误。</p>
                <p className="text-sm">正确答案是: {currentQuestion.word} ({currentQuestion.pinyin})</p>
              </div>
            </div>
          )}
          <button
            onClick={handleNextQuestion}
            className="w-full mt-4 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
          >
            {currentQuestionIndex === quiz.length - 1 ? '查看结果' : '下一题'}
          </button>
        </div>
      )}
    </div>
  )
}

export default TingYinShiCi
