// components/Tixing/GaiCuoTi.js
import React, { useState, useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { FaCheck, FaRedo, FaVolumeUp } from 'react-icons/fa'

const GaiCuoTi = ({
  title = "请改正下列句子的错误：",
  question = "他昨天去学校了了。",
  correctAnswer = "他昨天去学校了。",
  lang = "zh"
}) => {
  const [userInput, setUserInput] = useState("")
  const [showAnswer, setShowAnswer] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const soundRef = useRef(null)

  // 自动朗读标题（加载即播，延迟极低）
  useEffect(() => {
    const speakTitle = () => {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        title
      )}&tl=zh&client=tw-ob`
      if (soundRef.current) soundRef.current.stop()
      soundRef.current = new Howl({
        src: [url],
        html5: true,
        onplay: () => setIsPlaying(true),
        onend: () => setIsPlaying(false)
      })
      soundRef.current.play()
    }
    speakTitle()
  }, [title])

  // 播放题目音频
  const handlePlay = () => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      question
    )}&tl=${lang}&client=tw-ob`
    const sound = new Howl({
      src: [url],
      html5: true,
      onplay: () => setIsPlaying(true),
      onend: () => setIsPlaying(false)
    })
    sound.play()
  }

  // 检查答案
  const handleCheck = () => setShowAnswer(true)
  const handleRetry = () => {
    setShowAnswer(false)
    setUserInput("")
  }

  return (
    <div className="min-h-[60vh] flex flex-col justify-center items-center p-4 bg-gradient-to-br from-pink-50 to-yellow-100 rounded-3xl shadow-xl">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">{title}</h2>

      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md text-center relative">
        <p className="text-xl font-medium text-gray-700 mb-4">{question}</p>
        <button
          onClick={handlePlay}
          className="absolute top-5 right-5 text-pink-500 hover:text-pink-700 transition"
          title="播放题目"
        >
          <FaVolumeUp size={22} />
        </button>

        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="请在这里输入你改正后的句子..."
          className="w-full border border-gray-300 rounded-xl p-3 text-lg focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
          rows={3}
        />

        {!showAnswer ? (
          <button
            onClick={handleCheck}
            className="mt-4 bg-pink-500 text-white px-6 py-2 rounded-full text-lg font-semibold hover:bg-pink-600 transition flex items-center justify-center gap-2 mx-auto"
          >
            <FaCheck /> 检查
          </button>
        ) : (
          <>
            {userInput.trim() === correctAnswer.trim() ? (
              <div className="mt-4 bg-green-50 border border-green-300 rounded-xl p-3 text-green-800 text-lg animate-bounce">
                ✅ 太棒了！你答对了！
              </div>
            ) : (
              <div className="mt-4 bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-yellow-800 text-lg">
                正确答案：{correctAnswer}
              </div>
            )}
            <button
              onClick={handleRetry}
              className="mt-3 bg-gray-400 text-white px-5 py-2 rounded-full flex items-center justify-center gap-2 mx-auto hover:bg-gray-500 transition"
            >
              <FaRedo /> 再试一次
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default GaiCuoTi
