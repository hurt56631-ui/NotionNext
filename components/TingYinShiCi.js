// /components/TingYinShiCi.js (全新重构版，基于 XuanZeTi.js 模板)

'use client' // 确保是客户端组件

import React, { useState, useEffect, useCallback } from 'react'
import { FaVolumeUp, FaCheckCircle, FaTimesCircle, FaRedo } from 'react-icons/fa' // 使用图标库
import TextToSpeechButton from './TextToSpeechButton' // 保持和您项目一致的依赖

// 工具函数：洗牌数组
const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// 1. Props 解构：完全模仿您的组件风格
const TingYinShiCi = ({ title = '听音诗词', isShuffle = 'false', quizData }) => {
  // 2. 状态管理：保持简洁
  const [quiz, setQuiz] = useState([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [options, setOptions] = useState([])
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [error, setError] = useState(null)

  // 3. 初始化 useEffect：只在数据源变化时运行
  useEffect(() => {
    try {
      let parsedData = []
      // 支持字符串或原生数组
      if (typeof quizData === 'string') {
        parsedData = JSON.parse(quizData)
      } else if (Array.isArray(quizData)) {
        parsedData = quizData
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        setError('题库数据 (quizData) 为空或格式不正确。')
        return
      }

      const shuffle = String(isShuffle) === 'true'
      setQuiz(shuffle ? shuffleArray(parsedData) : parsedData)
      
      // 重置状态
      setCurrentQuestionIndex(0)
      setScore(0)
      setSelectedAnswer(null)
      setIsAnswered(false)
      setError(null)
    } catch (e) {
      setError(`题库数据解析失败: ${e.message}`)
    }
  }, [quizData, isShuffle])

  // 4. 生成选项的 useEffect：在题目切换时运行
  useEffect(() => {
    if (quiz.length > 0 && currentQuestionIndex < quiz.length) {
      const currentQuestion = quiz[currentQuestionIndex]
      const allOptions = shuffleArray([
        currentQuestion.answer,
        ...currentQuestion.distractors
      ])
      setOptions(allOptions)
    }
  }, [quiz, currentQuestionIndex])

  const handleAnswerClick = (option) => {
    if (isAnswered) return
    
    const currentQuestion = quiz[currentQuestionIndex]
    setSelectedAnswer(option)
    setIsAnswered(true)

    if (option === currentQuestion.answer) {
      setScore(s => s + 1)
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(i => i + 1)
      setIsAnswered(false)
      setSelectedAnswer(null)
    } else {
      // 最后一题，显示结果（可以添加一个结束页面，这里先简单处理）
      alert(`挑战完成！你的得分是: ${score + (selectedAnswer === quiz[currentQuestionIndex].answer ? 1 : 0)} / ${quiz.length}`)
    }
  }

  const handleRestart = () => {
      // 简单地触发重渲染
      const shuffle = String(isShuffle) === 'true'
      setQuiz(shuffle ? shuffleArray(JSON.parse(quizData)) : JSON.parse(quizData))
      setCurrentQuestionIndex(0)
      setScore(0)
      setSelectedAnswer(null)
      setIsAnswered(false)
  }

  // 错误或加载状态
  if (error) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
  }
  if (quiz.length === 0) {
    return <div className="p-4 text-center text-gray-500">正在加载题库...</div>
  }

  const currentQuestion = quiz[currentQuestionIndex]
  const isCorrect = selectedAnswer === currentQuestion.answer
  
  // 5. UI渲染：完全采用您项目的样式类名
  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      {/* 顶部信息 */}
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

      {/* 题目区域 */}
      <div className="whitespace-pre-wrap text-center text-xl p-4 my-6 bg-gray-1 dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 flex items-center justify-center">
        {currentQuestion.question}
        <TextToSpeechButton text={currentQuestion.audio} lang="zh-CN" />
      </div>

      {/* 选项按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, i) => {
          let buttonClasses = 'w-full text-center p-4 rounded-lg border-2 transition-all duration-300 font-semibold ';
          
          if (isAnswered) {
              if (option === currentQuestion.answer) {
                  buttonClasses += 'bg-secondary/[0.1] border-secondary text-secondary ring-2 ring-secondary';
              } else if (option === selectedAnswer) {
                  buttonClasses += 'bg-red-100 border-red-400 text-red-600 dark:bg-red-900 dark:border-red-700 dark:text-red-400';
              } else {
                  buttonClasses += 'bg-gray-100 border-gray-300 text-gray-500 opacity-60 dark:bg-dark-2 dark:border-dark-3 dark:text-dark-7';
              }
              buttonClasses += ' pointer-events-none';
          } else {
              buttonClasses += 'bg-white dark:bg-dark-2 border-gray-300 dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 hover:border-primary hover:text-primary hover:shadow-md';
          }

          return (
            <button key={i} onClick={() => handleAnswerClick(option)} disabled={isAnswered} className={buttonClasses}>
              {option}
            </button>
          )
        })}
      </div>

      {/* 反馈和下一题按钮 */}
      {isAnswered && (
        <div className="mt-6 animate-fade-in-up-fast">
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
