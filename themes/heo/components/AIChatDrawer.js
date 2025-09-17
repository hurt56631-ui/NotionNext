// themes/heo/components/AIChatDrawer.js

import { Transition } from '@headlessui/react'
import { Fragment } from 'react'

/**
 * AI 聊天全屏抽屉组件
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭时的回调函数
 */
const AIChatDrawer = ({ isOpen, onClose }) => {
  // 这里是你的 AI 聊天界面的占位符
  // 你应该把你真实的 AI 聊天组件放在这里
  const YourActualChatComponent = () => {
    return (
      <div className='flex flex-col h-full'>
        {/* 消息展示区 */}
        <div className='flex-1 p-4 overflow-y-auto'>
          <div className='bg-gray-100 dark:bg-gray-700 p-3 rounded-lg max-w-xs mb-2'>
            你好！有什么可以帮你的吗？
          </div>
          <div className='bg-blue-500 text-white p-3 rounded-lg max-w-xs ml-auto mb-2'>
            你好，我想了解一下 NotionNext。
          </div>
          {/* ...更多消息 */}
        </div>
        {/* 输入框区域 */}
        <div className='p-4 border-t dark:border-gray-700'>
          <div className='flex items-center gap-2'>
            <input
              type='text'
              placeholder='输入消息...'
              className='flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button className='px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors'>
              发送
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className='fixed inset-0 z-50'>
        <Transition.Child
          as={Fragment}
          enter='ease-in-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in-out duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          {/* 背景遮罩 */}
          <div className='absolute inset-0 bg-black bg-opacity-30' />
        </Transition.Child>

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
              <h2 className='text-lg font-bold'>AI 助手</h2>
              <button
                onClick={onClose}
                aria-label='关闭'
                className='p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <i className='fas fa-times text-xl' />
              </button>
            </div>

            {/* 聊天内容区 */}
            <div className='flex-1 overflow-hidden'>
              <YourActualChatComponent />
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

export default AIChatDrawer
