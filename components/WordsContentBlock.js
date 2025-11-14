// /components/WordsContentBlock.js

import React, { useState } from 'react'
import { GraduationCap, Coffee, Bus, Briefcase, Hospital, UtensilsCrossed, Plane, Film, ShoppingCart, Music } from 'lucide-react'
import SmartLink from './SmartLink'

// 模拟数据：HSK 等级
const hskLevels = [
  { level: 1, title: '入门级', wordCount: 150, progress: 75, color: 'from-green-400 to-cyan-500' },
  { level: 2, title: '初级', wordCount: 300, progress: 40, color: 'from-sky-400 to-blue-500' },
  { level: 3, title: '进阶级', wordCount: 600, progress: 15, color: 'from-indigo-400 to-purple-500' },
  { level: 4, title: '中级', wordCount: 1200, progress: 5, color: 'from-orange-400 to-red-500' },
  { level: 5, title: '高级', wordCount: 2500, progress: 0, color: 'from-rose-500 to-pink-600' },
  { level: 6, title: '精通级', wordCount: 5000, progress: 0, color: 'from-gray-600 to-black' }
]

// 模拟数据：主题场景
const themes = [
  { name: '餐厅用餐', englishName: 'Dining', wordCount: 50, Icon: UtensilsCrossed, color: 'bg-orange-500' },
  { name: '交通出行', englishName: 'Transport', wordCount: 65, Icon: Bus, color: 'bg-blue-500' },
  { name: '日常购物', englishName: 'Shopping', wordCount: 80, Icon: ShoppingCart, color: 'bg-green-500' },
  { name: '商务会话', englishName: 'Business', wordCount: 120, Icon: Briefcase, color: 'bg-gray-700' },
  { name: '机场出行', englishName: 'Airport', wordCount: 75, Icon: Plane, color: 'bg-sky-500' },
  { name: '医院看病', englishName: 'Hospital', wordCount: 90, Icon: Hospital, color: 'bg-red-500' },
  { name: '校园生活', englishName: 'Campus', wordCount: 110, Icon: GraduationCap, color: 'bg-indigo-500' },
  { name: '休闲娱乐', englishName: 'Leisure', wordCount: 60, Icon: Film, color: 'bg-purple-500' }
]

// HSK 等级卡片网格
const HskLevelGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {hskLevels.map(level => (
      <SmartLink href={`/words/hsk/${level.level}`} key={level.level} className="group block">
        <div className={`relative p-6 rounded-2xl shadow-lg text-white bg-gradient-to-br ${level.color} overflow-hidden transform transition-transform duration-300 group-hover:scale-105`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold">HSK {level.level}</h3>
              <p className="opacity-80">{level.title}</p>
            </div>
            <span className="bg-white/20 text-xs font-semibold px-2 py-1 rounded-full">{level.wordCount} 词汇</span>
          </div>
          <div className="mt-8">
            <p className="text-sm opacity-90 mb-1">{`已学习 ${level.progress}%`}</p>
            <div className="w-full bg-black/20 rounded-full h-2.5">
              <div className="bg-white rounded-full h-2.5" style={{ width: `${level.progress}%` }}></div>
            </div>
          </div>
        </div>
      </SmartLink>
    ))}
  </div>
)

// 主题场景卡片网格
const ThemeGrid = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {themes.map(theme => (
      <SmartLink href={`/words/theme/${theme.englishName.toLowerCase()}`} key={theme.name} className="group block">
        <div className={`flex flex-col items-center justify-center text-center p-4 rounded-2xl shadow-md ${theme.color} text-white transform transition-transform duration-300 group-hover:-translate-y-1.5`}>
          <theme.Icon size={32} className="mb-2 opacity-90" />
          <h4 className="font-semibold">{theme.name}</h4>
          <p className="text-xs opacity-70">{theme.wordCount} 词</p>
        </div>
      </SmartLink>
    ))}
  </div>
)


// 主组件
const WordsContentBlock = () => {
  const [activeView, setActiveView] = useState('level') // 'level' or 'theme'

  const buttonBaseStyle = "w-1/2 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-300 focus:outline-none"
  const activeButtonStyle = "bg-white dark:bg-gray-700 text-blue-500 shadow"
  const inactiveButtonStyle = "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-500/10"

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4">
      {/* 切换器 */}
      <div className="mb-8 flex justify-center">
        <div className="w-full max-w-xs p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex">
          <button
            onClick={() => setActiveView('level')}
            className={`${buttonBaseStyle} ${activeView === 'level' ? activeButtonStyle : inactiveButtonStyle}`}
          >
            按等级
          </button>
          <button
            onClick={() => setActiveView('theme')}
            className={`${buttonBaseStyle} ${activeView === 'theme' ? activeButtonStyle : inactiveButtonStyle}`}
          >
            按主题
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div>
        {activeView === 'level' ? <HskLevelGrid /> : <ThemeGrid />}
      </div>
    </div>
  )
}

export default WordsContentBlock
