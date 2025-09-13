// /components/XuanZeTi.js (全新优化版)

'use client'

import React, 'useState', 'useEffect', 'useRef } from 'react'

// 假设您的项目中有一个 TTS 按钮组件，如果没有，可以先注释掉下面这行和相关的组件使用
// import TextToSpeechButton from './TextToSpeechButton'

// 一个临时的 TTS 按钮替代品，如果您的项目中没有 TextToSpeechButton
const FallbackTextToSpeechButton = ({ text, lang }) => {
  const speak = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang || 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
  };
  return (
    <button onClick={speak} className="ml-2 text-gray-500 hover:text-primary transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.314-.217zM14.5 8a1 1 0 011.5 0v4a1 1 0 11-1.5 0V8z" clipRule="evenodd" />
        <path d="M12.5 6a1 1 0 011.5 0v8a1 1 0 11-1.5 0V6z" />
      </svg>
    </button>
  );
};


const XuanZeTi = ({ question, options = [], correctAnswerIndex, explanation }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)

  // 初始化音效，确保在客户端执行
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 推荐将音频文件放在 /public/sounds/ 目录下
      correctAudioRef.current = new Audio('/sounds/correct.mp3')
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')
    }
  }, [])

  // 播放音效的函数
  const playSound = (isCorrect) => {
    const audio = isCorrect ? correctAudioRef.current : wrongAudioRef.current
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(e => console.error("音频播放失败:", e))
    }
  }

  // 点击选项的处理函数
  const handleOptionClick = (index) => {
    if (isAnswered) return

    setSelectedOptionIndex(index)
    setIsAnswered(true)
    setShowFeedback(true)
    playSound(index === correctAnswerIndex)
  }

  // 重置组件状态的函数
  const handleReset = () => {
    setShowFeedback(false)
    // 动画结束后再重置状态
    setTimeout(() => {
      setSelectedOptionIndex(null)
      setIsAnswered(false)
    }, 300) // 动画时长
  }

  // 根据状态动态生成选项按钮的样式
  const getOptionClasses = (index) => {
    let baseClasses = 'w-full text-left p-4 rounded-lg border-2 transition-all duration-300 flex items-center justify-between font-medium shadow-sm'
    
    if (isAnswered) {
      const isCorrectOption = index === correctAnswerIndex
      const isSelectedOption = index === selectedOptionIndex

      if (isCorrectOption) {
        return `${baseClasses} bg-secondary/10 border-secondary text-secondary ring-2 ring-secondary scale-105 shadow-lg`
      }
      if (isSelectedOption) {
        return `${baseClasses} bg-red-100 border-red-400 text-red-600 dark:bg-red-900/50 dark:border-red-700 dark:text-red-400 animate-shake`
      }
      return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 opacity-70 dark:bg-dark-2 dark:border-dark-3 dark:text-dark-7 pointer-events-none`
    }
    
    return `${baseClasses} bg-white dark:bg-dark-2 border-gray-300 dark:border-dark-3 text-dark-DEFAULT dark:text-gray-1 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer`
  }

  // 对错图标
  const FeedbackIcon = ({ isCorrect }) => {
      if (isCorrect) {
          return <span className="text-secondary font-bold text-xl flex items-center"><i className="fas fa-check-circle mr-2"></i>回答正确！</span>
      }
      return <span className="text-red-600 dark:text-red-400 font-bold text-xl flex items-center"><i className="fas fa-times-circle mr-2"></i>回答错误！</span>
  }


  return (
    <div className="max-w-2xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      {/* 题目区域 */}
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1 flex items-center">
          {question}
          {/* 使用您的 TTS 按钮，如果 TextToSpeechButton 存在的话 */}
          {/* <TextToSpeechButton text={question} /> */}
          {/* 否则使用备用方案 */}
           <FallbackTextToSpeechButton text={question} />
        </h3>
      </div>

      {/* 选项列表 */}
      <div className="space-y-4">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index)}
            disabled={isAnswered}
            className={getOptionClasses(index)}
          >
            <span className="text-lg">
              <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
              {option}
            </span>
            {isAnswered && index === correctAnswerIndex && <i className="fas fa-check text-secondary"></i>}
            {isAnswered && index === selectedOptionIndex && index !== correctAnswerIndex && <i className="fas fa-times text-red-500"></i>}
          </button>
        ))}
      </div>

      {/* 反馈区域 */}
      {isAnswered && (
        <div className={`mt-8 ${showFeedback ? 'animate-fade-in-up' : 'animate-fade-out'}`}>
          <div className="p-5 bg-gray-1 dark:bg-dark-2 border-t-4 border-primary rounded-b-lg shadow-inner">
            <div className="flex items-center space-x-3 mb-4">
               <FeedbackIcon isCorrect={selectedOptionIndex === correctAnswerIndex} />
            </div>

            {explanation && (
              <div>
                <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
                  <i className="fas fa-lightbulb mr-2 text-yellow-500"></i>
                  解析
                  {/* <TextToSpeechButton text={explanation} /> */}
                   <FallbackTextToSpeechButton text={explanation} />
                </h4>
                <p className="text-body-color dark:text-dark-7">{explanation}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleReset}
              className="px-8 py-3 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
            >
              再试一次
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default XuanZeTi
