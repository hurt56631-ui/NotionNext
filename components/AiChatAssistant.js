// components/AiChatAssistant.js

import { Transition } from '@headlessui/react'
import { Fragment } from 'react'

/**
 * AI 聊天助手全屏抽屉组件
 * @param {object} props
 * @param {boolean} props.isOpen - 抽屉是否打开
 * @param {function} props.onClose - 关闭抽屉的回调函数
 */
const AiChatAssistant = ({ isOpen, onClose }) => {
  // 这是一个占位符组件，您需要在这里替换成您真实的 AI 聊天应用。
  // 它包含了基本的布局：消息区和输入框。
  const YourActualChatComponent = () => {
    return (
      <div className='flex flex-col h-full bg-white dark:bg-[#1a191d]'>
        {/* 1. 消息展示区域 */}
        <div className='flex-1 p-4 overflow-y-auto'>
          {/* 示例消息 */}
          <div className='mb-4'>
            <div className='flex items-end'>
              <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0'></div>
              <div className='ml-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg max-w-xs'>
                <p className='text-sm text-gray-800 dark:text-gray-200'>
                  你好！有什么可以帮助你的吗？
                </p>
              </div>
            </div>
          </div>
          <div className='mb-4'>
            <div className='flex items-end justify-end'>
              <div className='mr-3 bg-blue-500 text-white p-3 rounded-lg max-w-xs'>
                <p className='text-sm'>
                  你好，我想了解一下关于这个网站的技术栈。
                </p>
              </div>
              <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0'></div>
            </div>
          </div>
          {/* ... 可以在这里渲染更多的消息 */}
        </div>

        {/* 2. 底部输入框区域 */}
        <div className='p-4 border-t border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-2'>
            <input
              type='text'
              placeholder='输入你的问题...'
              className='flex-1 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
            />
            <button className='px-5 py-2 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
              发送
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className='fixed inset-0 z-50' role='dialog' aria-modal='true'>
        {/* 背景遮罩层 */}
        <Transition.Child
          as={Fragment}
          enter='ease-in-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in-out duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='absolute inset-0 bg-black bg-opacity-30 transition-opacity' />
        </Transition.Child>

        {/* 主要内容区，从底部滑入 */}
        <Transition.Child
          as={Fragment}
          enter='transform transition ease-in-out duration-300'
          enterFrom='translate-y-full'
          enterTo='translate-y-0'
          leave='transform transition ease-in-out duration-200'
          leaveFrom='translate-y-0'
          leaveTo='translate-y-full'
        >
          <div className='fixed inset-0 flex flex-col bg-white dark:bg-[#1a191d]'>
            {/* 顶部标题栏 */}
            <header className='flex-shrink-0 flex items-center justify-between px-4 h-16 border-b dark:border-gray-800'>
              <h2 className='text-lg font-bold text-gray-900 dark:text-gray-100'>AI 助手</h2>
              <button
                onClick={onClose}
                aria-label='关闭AI助手'
                className='p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <i className='fas fa-times text-xl' />
              </button>
            </header>

            {/* AI 聊天界面 */}
            <main className='flex-1 overflow-hidden'>
              <YourActualChatComponent />
            </main>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

export default AiChatAssistant
