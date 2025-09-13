// /components/TingYinShiCi.js (最终修正版)

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa'

// 工具函数：洗牌数组 (无需修改)
const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// CHANGE 1: 修改组件签名，直接解构 props，和你的 LianXianTi.js 保持一致
const TingYinShiCi = ({ title = '听音诗词', isShuffle = 'false', quizData }) => {
  // 状态管理 (无需修改)
  const [quiz, setQuiz] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [options, setOptions] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isCorrect, setIsCorrect] = useState(null)
  const [score, setScore] = useState(0)
  const [quizState, setQuizState] = useState('playing') // playing, answered, finished
  const [ttsLoading, setTtsLoading] = useState(false)
  const [error, setError] = useState(null)

  // CHANGE 2: 重写 useEffect，使其直接处理解构后的 props，不再依赖 props.config
  useEffect(() => {
    try {
      let parsedData = []
      if (typeof quizData === 'string') {
        parsedData = JSON.parse(quizData)
      } else if (Array.isArray(quizData)) {
        parsedData = quizData // 也支持直接传入数组
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        setError('题库数据 (quizData) 为空或格式不正确。')
        setQuiz([])
        return
      }

      const shuffle = String(isShuffle) === 'true'
      setQuiz(shuffle ? shuffleArray(parsedData) : parsedData)

      // 重置状态
      setCurrentQuestionIndex(0)
      setScore(0)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setQuizState('playing')
      setError(null)
    } catch (e) {
      console.error('解析组件属性失败:', e)
      setError(`题库数据 (quizData) 解析失败: ${e.message}`)
      setQuiz([])
    }
    // 依赖于 props 的具体值
  }, [quizData, isShuffle])

  // TTS 朗读功能 (无需修改)
  const speak = useCallback(async (text) => {
    if (!text || ttsLoading) return
    setTtsLoading(true)
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaochenMultilingualNeural&r=-20`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('TTS API request failed')
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        setTtsLoading(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => setTtsLoading(false)
      audio.play()
    } catch (e) {
      console.error('TTS Error:', e)
      setTtsLoading(false)
    }
  }, [ttsLoading])

  // 其他核心逻辑 (基本无需修改)
  useEffect(() => {
    if (quizState === 'playing' && quiz.length > 0 && quiz[currentQuestionIndex]) {
      const currentQuestion = quiz[currentQuestionIndex]
      if (!currentQuestion || !currentQuestion.answer || !currentQuestion.distractors) {
        setError(`第 ${currentQuestionIndex + 1} 题数据格式错误，缺少 answer 或 distractors 字段。`)
        return
      }
      const allOptions = shuffleArray([
        currentQuestion.answer,
        ...currentQuestion.distractors
      ])
      setOptions(allOptions)
      if (currentQuestion.audio) {
        speak(currentQuestion.audio)
      }
    }
  }, [quiz, currentQuestionIndex, quizState, speak])

  const handleAnswerClick = (option) => {
    if (quizState === 'answered') return
    const currentQuestion = quiz[currentQuestionIndex]
    setSelectedAnswer(option)
    if (option === currentQuestion.answer) {
      setIsCorrect(true)
      setScore(s => s + 1)
    } else {
      setIsCorrect(false)
    }
    setQuizState('answered')
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(i => i + 1)
      setQuizState('playing')
    } else {
      setQuizState('finished')
    }
    setSelectedAnswer(null)
    setIsCorrect(null)
  }
  
  const handleRestart = () => {
     try {
      let parsedData = []
       if (typeof quizData === 'string') {
        parsedData = JSON.parse(quizData)
      } else if (Array.isArray(quizData)) {
        parsedData = quizData
      }
      const shuffle = String(isShuffle) === 'true'
      setQuiz(shuffle ? shuffleArray(parsedData) : parsedData)
      setCurrentQuestionIndex(0)
      setScore(0)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setQuizState('playing')
    } catch(e) {
      setError('重置失败，请刷新页面。')
    }
  }

  // 渲染 UI (大部分无需修改)
  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
  }
  if (quiz.length === 0) {
    return <div className="p-4 text-center text-gray-500">正在加载题库...</div>
  }

  const currentQuestion = quiz[currentQuestionIndex]
  if (!currentQuestion) return null

  if (quizState === 'finished') {
    return (
      <div className="max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg text-center">
        <h2 className="text-2xl font-bold mb-4">挑战完成!</h2>
        <p className="text-lg mb-6">你的得分: <span className="font-bold text-3xl text-blue-600">{score}</span> / {quiz.length}</p>
        <button onClick={handleRestart} className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center">
          <FaRedo className="mr-2"/>再来一次
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-50 rounded-2xl shadow-lg">
      <div className="mb-4">
        {/* CHANGE 3: 直接使用解构后的 `title` prop */}
        <h1 className="text-xl font-bold text-center mb-2">{title}</h1>
        <div className="flex justify-between text-sm text-gray-500">
          <span>{currentQuestionIndex + 1} / {quiz.length}</span>
          <span>得分: {score}</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-1">
          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}></div>
        </div>
      </div>
      <div className="whitespace-pre-wrap text-center text-lg p-4 my-4 bg-white rounded-lg border">
        {currentQuestion.question}
      </div>
      <div className="text-center my-6">
        <button onClick={() => speak(currentQuestion.audio)} disabled={ttsLoading} className="p-5 bg-blue-500 text-white rounded-full shadow-lg disabled:opacity-50 transition-transform transform hover:scale-110">
          {ttsLoading ? '...' : <FaVolumeUp size={30}/>}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleAnswerClick(opt)}
            className={`w-full text-center p-4 my-1 rounded-lg border-2 transition-all duration-300 transform hover:-translate-y-1
              ${quizState === 'answered'
                ? (opt === currentQuestion.answer
                    ? 'bg-green-100 border-green-500 ring-2 ring-green-500'
                    : (opt === selectedAnswer
                        ? 'bg-red-100 border-red-500'
                        : 'bg-gray-100 border-gray-300 opacity-70'))
                : 'bg-white border-gray-300 hover:border-blue-500 hover:shadow-md'}`}
            disabled={quizState === 'answered'}
          >
            {opt}
          </button>
        ))}
      </div>
      {quizState === 'answered' && (
        <div className="mt-6 p-4 rounded-lg bg-gray-100 border">
          <div className={`flex items-center mb-3 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
            {isCorrect ? <FaCheckCircle className="mr-2"/> : <FaTimesCircle className="mr-2"/>}
            <span className="font-bold">
              {isCorrect ? '回答正确！' : `回答错误。正确答案是：${currentQuestion.answer}`}
            </span>
          </div>
          {currentQuestion.pinyin && <p className="text-gray-700"><strong>拼音：</strong> {currentQuestion.pinyin}</p>}
          {currentQuestion.explanation && <p className="text-gray-600 mt-1"><strong>解析：</strong> {currentQuestion.explanation}</p>}

          <button onClick={handleNextQuestion} className="w-full mt-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
            {currentQuestionIndex < quiz.length - 1 ? '下一题' : '查看结果'}
          </button>
        </div>
      )}
    </div>
  )
}

export default TingYinShiCi
