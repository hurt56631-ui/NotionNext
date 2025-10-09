// /components/GlosbeSearchCard.js

import { useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'

/**
 * Glosbe 在线词典搜索卡片 - 高端美化版
 * - 支持缅中双向互译切换
 * - 通过回调函数将搜索 URL 传递给父组件，以尝试在站内 iframe 中显示
 * - 提供了更具现代感和交互性的 UI 设计
 */
const GlosbeSearchCard = ({ onSearch }) => {
  const [word, setWord] = useState('')
  const [searchDirection, setSearchDirection] = useState('my2zh')

  // 切换翻译方向
  const toggleDirection = () => {
    setSearchDirection(prev => (prev === 'my2zh' ? 'zh2my' : 'my2zh'))
    setWord('') // 切换时清空输入框
  }

  // 处理搜索动作，调用父组件传入的 onSearch 函数
  const handleSearch = () => {
    const trimmedWord = word.trim()
    if (trimmedWord) {
      const glosbeUrl = searchDirection === 'my2zh'
        ? `https://glosbe.com/my/zh/${encodeURIComponent(trimmedWord)}`
        : `https://glosbe.com/zh/my/${encodeURIComponent(trimmedWord)}`
      
      if (onSearch) {
        onSearch(glosbeUrl)
      } else {
        // 如果没有提供 onSearch 回调，则作为备用方案直接打开新标签页
        window.open(glosbeUrl, '_blank')
      }
    }
  }

  // 处理输入框变化
  const handleInputChange = (e) => {
    setWord(e.target.value)
  }
  
  // 允许通过回车键触发搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }
  
  // 根据翻译方向动态显示占位符
  const placeholderText = searchDirection === 'my2zh' ? '请输入缅甸语...' : '请输入中文...'
  const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文'
  const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语'

  return (
    <div className="relative w-full rounded-2xl shadow-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-6 border dark:border-gray-700/50 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 dark:bg-blue-400/10 rounded-full blur-2xl"></div>
      
      <h2 className="text-xl font-bold mb-5 text-center text-gray-800 dark:text-white relative z-10">汉缅互译词典</h2>
      
      {/* 搜索输入框 */}
      <div className="relative flex items-center group">
        <Search className="absolute left-4 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none transition-colors duration-300 group-focus-within:text-blue-500" />
        <input
          type="text"
          value={word}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="w-full pl-12 pr-4 py-3 text-lg text-gray-800 dark:text-gray-200 bg-white/50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
        />
      </div>

      {/* 底部操作区：语言切换和搜索按钮 */}
      <div className="flex justify-between items-center mt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
          <span className="font-semibold">{fromLang}</span>
          <button
            onClick={toggleDirection}
            title="切换翻译方向"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-300 transform active:scale-90 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ArrowLeftRight size={18} />
          </button>
          <span className="font-semibold">{toLang}</span>
        </div>
        
        <button
          onClick={handleSearch}
          className="px-6 py-2.5 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          查 询
        </button>
      </div>
    </div>
  )
}

export default GlosbeSearchCard
