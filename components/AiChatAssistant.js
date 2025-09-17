// components/AiChatAssistant.js

import { Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'

/**
 * AI 聊天助手全屏抽屉
 * @param {boolean} isOpen - 是否显示
 * @param {function} onClose - 关闭时的回调函数
 */
const AiChatAssistant = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('')
  const [tempApiKey, setTempApiKey] = useState('')
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'ai', text: '你好！有什么可以帮助你的吗？请先在设置中填入你的 Gemini API Key。' }
  ])
  const [input, setInput] = useState('')

  // 组件加载时，从 localStorage 读取 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key')
    if (savedKey) {
      setApiKey(savedKey)
      setTempApiKey(savedKey)
    }
  }, [])

  const handleSaveKey = () => {
    setApiKey(tempApiKey)
    localStorage.setItem('gemini_api_key', tempApiKey)
    setSettingsOpen(false)
    // 可以在这里加一个提示，比如 alert('API Key 已保存！')
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    // TODO: 在这里实现调用 Gemini API 的逻辑
    // 1. 将用户消息添加到 messages 列表
    const userMessage = { from: 'user', text: input }
    setMessages(prev => [...prev, userMessage])

    // 2. 清空输入框
    setInput('')

    // 3. 显示 AI 加载中的提示
    setMessages(prev => [...prev, { from: 'ai', text: '思考中...' }])

    // 4. 使用 apiKey 和 input 调用你的 API 端点
    // ... fetch(...)

    console.log('Sending message with key:', apiKey, 'and input:', input)
  }

  // 设置界面
  const SettingsView = () => (
    <div className='p-6'>
      <h3 className='text-xl font-semibold mb-4'>设置</h3>
      <div className='space-y-2'>
        <label htmlFor='apiKey' className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
          Gemini API Key
        </label>
        <input
          id='apiKey'
          type='password'
          value={tempApiKey}
          onChange={(e) => setTempApiKey(e.target.value)}
          placeholder='在此输入你的 API Key'
          className='w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>
      <button
        onClick={handleSaveKey}
        className='mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors'
      >
        保存
      </button>
      <button
        onClick={() => setSettingsOpen(false)}
        className='mt-2 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
      >
        返回聊天
      </button>
    </div>
  )

  // 聊天界面
  const ChatView = () => (
    <div className='flex flex-col h-full'>
      {/* 消息展示区 */}
      <div className='flex-1 p-4 overflow-y-auto'>
        {messages.map((msg, index) => (
          <div key={index} className={`flex mb-4 ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs lg:max-w-md ${
              msg.from === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      {/* 输入框区域 */}
      <div className='p-4 border-t dark:border-gray-700'>
        <form onSubmit={handleSendMessage} className='flex items-center gap-2'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={apiKey ? '输入消息...' : '请先设置 API Key'}
            disabled={!apiKey}
            className='flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
          />
          <button
            type='submit'
            disabled={!apiKey}
            className='px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed'
          >
            发送
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className='fixed inset-0 z-50'>
        {/* 背景遮罩 */}
        <Transition.Child
          as={Fragment}
          enter='ease-in-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in-out duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='absolute inset-0 bg-black bg-opacity-30' />
        </Transition.Child>

        {/* 主要内容面板 */}
        <Transition.Child
          as={Fragment}
          enter='transform transition ease-in-out duration-300'
          enterFrom='translate-y-full'
          enterTo='translate-y-0'
          leave='transform transition ease-in-out duration-200'
          leaveFrom='translate-y-0'
          leaveTo='translate-y-full'
        >
          <div className='fixed inset-0 flex flex-col bg-white dark:bg-[#18171d]'>
            {/* 顶部标题栏 */}
            <div className='flex-shrink-0 flex items-center justify-between px-4 h-16 border-b dark:border-gray-800'>
              <div className='flex items-center gap-2'>
                <h2 className='text-lg font-bold'>AI 助手</h2>
                {/* 设置按钮 */}
                <button
                  onClick={() => setSettingsOpen(!isSettingsOpen)}
                  aria-label='设置'
                  className='p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                >
                  <i className='fas fa-cog' />
                </button>
              </div>
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                aria-label='关闭'
                className='p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <i className='fas fa-times text-xl' />
              </button>
            </div>

            {/* 内容区: 根据 isSettingsOpen 切换视图 */}
            <div className='flex-1 overflow-hidden'>
              {isSettingsOpen ? <SettingsView /> : <ChatView />}
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

export default AiChatAssistant
