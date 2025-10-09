'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import { motion, AnimatePresence } from 'framer-motion'
import { HiChatBubbleOvalLeftEllipsis, HiUserCircle, HiCog8Tooth } from 'react-icons/hi2'
import { FaBars } from 'react-icons/fa6'

/**
 * HEO 主题旗舰版 v3
 * - 浅色毛玻璃风格
 * - Telegram风格侧边栏（支持拖动）
 * - 手势与iframe区域完美兼容
 * - 社区流式主页 + 底部导航
 */

export default function LayoutIndexFinal() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // --- 跟手手势逻辑 ---
  const handlers = useSwipeable({
    onSwiping: (e) => {
      // 从屏幕左边 25% 区域开始可拖动
      if (e.initial[0] < window.innerWidth * 0.25 && e.deltaX > 0) {
        setIsDragging(true)
        setDragX(Math.min(e.deltaX, window.innerWidth * 0.66))
      }
    },
    onSwipedRight: (e) => {
      if (e.deltaX > 100) setIsSidebarOpen(true)
      setIsDragging(false)
      setDragX(0)
    },
    onSwipedLeft: () => {
      setIsSidebarOpen(false)
      setIsDragging(false)
      setDragX(0)
    },
    preventDefaultTouchmoveEvent: false,
    trackMouse: true
  })

  // --- 内容滚动区（社区贴子流） ---
  const contentRef = useRef(null)

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0 })
    }
  }, [])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f8f9fb] text-gray-900 select-none">

      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 w-full h-14 flex items-center justify-between px-4 bg-white/70 backdrop-blur-xl shadow-sm z-30">
        <button onClick={() => setIsSidebarOpen(true)} className="text-gray-700">
          <FaBars size={20} />
        </button>
        <h1 className="text-lg font-semibold tracking-wide">社区</h1>
        <div className="w-6" />
      </header>

      {/* 侧边栏 + 背景遮罩 */}
      <AnimatePresence>
        {(isSidebarOpen || isDragging) && (
          <>
            {/* 遮罩层 */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{
                opacity: isDragging
                  ? Math.min((dragX / (window.innerWidth * 0.66)) * 0.4, 0.4)
                  : 0.4
              }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
            />
            {/* 侧边栏 */}
            <motion.div
              className="fixed top-0 left-0 h-full w-2/3 max-w-xs bg-white/80 backdrop-blur-2xl shadow-2xl rounded-r-2xl border-r border-gray-200 z-50 p-6 flex flex-col justify-between"
              style={{
                transform: isDragging
                  ? `translateX(${dragX - window.innerWidth * 0.66}px)`
                  : undefined
              }}
              initial={{ x: '-100%' }}
              animate={isSidebarOpen ? { x: 0 } : { x: '-100%' }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div>
                <h2 className="text-xl font-bold mb-6">菜单</h2>
                <ul className="space-y-4">
                  <li className="flex items-center space-x-3 text-gray-800 hover:text-blue-600">
                    <HiChatBubbleOvalLeftEllipsis size={22} />
                    <span>消息</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-800 hover:text-blue-600">
                    <HiUserCircle size={22} />
                    <span>我的</span>
                  </li>
                  <li className="flex items-center space-x-3 text-gray-800 hover:text-blue-600">
                    <HiCog8Tooth size={22} />
                    <span>设置</span>
                  </li>
                </ul>
              </div>
              <div className="text-sm text-gray-400">HEO v3 ©2025</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 主内容区域 */}
      <main
        ref={contentRef}
        {...handlers}
        className="absolute top-14 bottom-16 left-0 right-0 overflow-y-auto custom-scrollbar z-10 px-3 pt-2"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {/* 模拟社区贴子流 */}
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md p-4 mb-4 border border-gray-100"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
              <span className="ml-2 font-medium text-gray-800">用户 {i + 1}</span>
            </div>
            <p className="text-gray-700 text-sm">
              这是社区动态示例贴子内容。你可以在这里显示学习心得、视频、帖子等。
            </p>
            <div className="mt-2 bg-gray-100 rounded-xl h-40 flex items-center justify-center text-gray-400 text-sm">
              帖子图片 / 视频区
            </div>
          </motion.div>
        ))}
      </main>

      {/* 底部导航栏 */}
      <footer className="fixed bottom-0 left-0 w-full h-16 bg-white/70 backdrop-blur-xl border-t border-gray-200 flex justify-around items-center z-20">
        <button className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <HiChatBubbleOvalLeftEllipsis size={22} />
          <span className="text-xs mt-1">消息</span>
        </button>
        <button className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <HiUserCircle size={22} />
          <span className="text-xs mt-1">我的</span>
        </button>
        <button className="flex flex-col items-center text-gray-600 hover:text-blue-600">
          <HiCog8Tooth size={22} />
          <span className="text-xs mt-1">设置</span>
        </button>
      </footer>
    </div>
  )
}
