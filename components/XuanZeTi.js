// /components/XuanZeTi.js (移除 HSK 标签，选项卡片颜色调整)
import React, { useState, useEffect, useRef } from 'react'
import TextToSpeechButton from './TextToSpeechButton'

const XuanZeTi = ({ question, options, correctAnswerIndex, explanation }) => { // 移除 hskLevel prop
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const correctAudioRef = useRef(null)
  const wrongAudioRef = useRef(null)
  
  const speechSynthesisUtteranceRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // 选项卡片颜色数组 (调整，使其在白色背景下更突出)
  const optionCardColors = [
    'bg-primary/[0.1] text-primary border-primary/[0.3]', // 使用主题 primary 的浅色
    'bg-secondary/[0.1] text-secondary border-secondary/[0.3]', // 使用主题 secondary 的浅色
    'bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 border-blue-400 dark:border-blue-700',
    'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 border-green-400 dark:border-green-700',
    'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 border-yellow-400 dark:border-yellow-700',
    'bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 border-purple-400 dark:border-purple-700',
    'bg-pink-200 dark:bg-pink-800 text-pink-900 dark:text-pink-100 border-pink-400 dark:border-pink-700',
    'bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 border-indigo-400 dark:border-indigo-700',
    'bg-teal-200 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border-teal-400 dark:border-teal-700',
    'bg-orange-200 dark:bg-orange-800 text-orange-900 dark:text-orange-100 border-orange-400 dark:border-orange-700',
    'bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100 border-cyan-400 dark:border-cyan-700',
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      correctAudioRef.current = new Audio('/sounds/correct.mp3') 
      wrongAudioRef.current = new Audio('/sounds/wrong.mp3')   
      
      speechSynthesisRef.current = window.speechSynthesis;
      speechSynthesisUtteranceRef.current = new SpeechSynthesisUtterance();
      speechSynthesisUtteranceRef.current.lang = 'zh-CN';
      speechSynthesisUtteranceRef.current.rate = 1;
      speechSynthesisUtteranceRef.current.pitch = 1;
    }

    return () => {
      if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, [])

  const playSound = (isCorrect) => {
    if (isCorrect && correctAudioRef.current) {
      correctAudioRef.current.currentTime = 0;
      correctAudioRef.current.play().catch(e => console.error("Error playing correct sound:", e))
    } else if (!isCorrect && wrongAudioRef.current) {
      wrongAudioRef.current.currentTime = 0;
      wrongAudioRef.current.play().catch(e => console.error("Error playing wrong sound:", e))
    }
  }

  const speakOptionText = (textToSpeak) => {
    if (speechSynthesisRef.current && textToSpeak) {
      if (speechSynthesisRef.current.speaking) {
        speechSynthesisRef.current.cancel();
      }
      speechSynthesisUtteranceRef.current.text = textToSpeak;
      speechSynthesisRef.current.speak(speechSynthesisUtteranceRef.current);
    }
  };

  const handleOptionClick = (index, optionText) => {
    if (isAnswered) return

    setSelectedOptionIndex(index)
    setIsAnswered(true)
    setShowFeedback(true)

    playSound(index === correctAnswerIndex)
    speakOptionText(optionText);
  }

  const handleReset = () => {
    setShowFeedback(false)
    if (speechSynthesisRef.current && speechSynthesisRef.current.speaking) {
      speechSynthesisRef.current.cancel();
    }
    setTimeout(() => {
      setSelectedOptionIndex(null)
      setIsAnswered(false)
    }, 300)
  }

  const getOptionClasses = (optionIndex) => {
    let classes = 'w-full text-left p-3 rounded-md border transition-all duration-200 flex items-center '
    const isCorrectOption = optionIndex === correctAnswerIndex
    const isSelectedOption = optionIndex === selectedOptionIndex

    // 基础颜色背景
    const baseColorClass = optionCardColors[optionIndex % optionCardColors.length];
    classes += baseColorClass + ' ';

    if (isAnswered) {
      if (isCorrectOption) {
        classes += 'bg-secondary/[0.1] border-secondary text-secondary font-medium shadow-md ';
      } else if (isSelectedOption && !isCorrectOption) {
        classes += 'bg-red-100 border-red-400 text-red-600 font-medium dark:bg-red-900 dark:border-red-700 dark:text-red-400 shadow-md ';
      } else {
        classes += 'opacity-80 shadow-sm ';
      }
      classes += 'pointer-events-none ';
    } else {
      classes += 'hover:bg-opacity-80 hover:shadow-md hover:scale-[1.01] ';
      if (isSelectedOption) {
        classes += 'ring-2 ring-offset-2 ring-primary shadow-xl scale-[1.03] ';
      } else {
        classes += 'shadow-sm ';
      }
    }
    return classes
  }

  return (
    <div className="max-w-xl mx-auto my-8 p-6 bg-day-DEFAULT dark:bg-night-DEFAULT rounded-xl shadow-2 border border-stroke dark:border-dark-3">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-dark-DEFAULT dark:text-gray-1 flex items-center">
          {question}
          <TextToSpeechButton text={question} lang="zh-CN" />
        </h3>
        {/* 移除 HSK 标签 */}
        {/* {hskLevel && (
          <span className={`px-3 py-1 text-sm font-bold rounded-full ml-3 ${getHskLevelColorClass(hskLevel)}`}>
            HSK {hskLevel}
            <TextToSpeechButton text={`HSK ${hskLevel} 级`} lang="zh-CN" />
          </span>
        )} */}
      </div>

      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleOptionClick(index, option)}
            disabled={isAnswered}
            className={getOptionClasses(index)}
          >
            <span className="text-lg font-semibold flex-1 flex items-center">
              {String.fromCharCode(65 + index)}. {option}
            </span>
          </button>
        ))}
      </div>

      {isAnswered && (
        <div className={`mt-8 ${showFeedback ? 'animate-fade-in-up-fast' : 'animate-fade-out-fast'}`}>
          <div className="flex items-center space-x-3 mb-4">
            {selectedOptionIndex === correctAnswerIndex ? (
              <span className="text-secondary font-bold text-xl">
                <i className="fas fa-check-circle mr-2"></i>回答正确！
              </span>
            ) : (
              <span className="text-red-600 font-bold text-xl dark:text-red-400">
                <i className="fas fa-times-circle mr-2"></i>回答错误！
              </span>
            )}
          </div>

          {explanation && (
            <div className="mt-4 p-4 bg-gray-1 dark:bg-dark-2 border-t-2 border-stroke dark:border-dark-3 rounded-b-xl text-body-color dark:text-dark-7 shadow-inner animate-fade-in-fast">
              <h4 className="font-bold text-lg mb-2 text-dark-DEFAULT dark:text-gray-1 flex items-center">
                <i className="fas fa-lightbulb mr-2 text-warning"></i>解释：
                <TextToSpeechButton text={explanation} lang="zh-CN" />
              </h4>
              <p>{explanation}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-dark-6 text-white font-medium rounded-lg shadow-md hover:bg-dark-5 focus:outline-none focus:ring-2 focus:ring-dark-7 focus:ring-offset-2 transition-colors duration-200"
            >
              重置
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default XuanZeTi
