// themes/heo/components/ChatWindow.js (最终优化版)

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getMessagesForChat, getUserProfile } from '@/lib/chat'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

const ChatWindow = ({ chatId, conversation }) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }) // 改为 auto 立即滚动
  }

  useEffect(() => {
    // 延迟一小段时间再滚动，确保DOM渲染完成
    setTimeout(scrollToBottom, 100);
  }, [messages])

  useEffect(() => {
    if (!chatId || !conversation) {
      setMessages([])
      setOtherUser(null)
      return
    }

    const otherUserId = conversation.participants.find(uid => uid !== user.uid)
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser)
    }

    const unsubscribe = getMessagesForChat(chatId, setMessages)
    return () => unsubscribe()
  }, [chatId, conversation, user.uid])

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50 dark:bg-gray-900">
        <p>从左侧选择一个对话开始聊天</p>
      </div>
    )
  }

  return (
    // 关键修复 1: 确保父容器是 flex 布局且高度100%
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white">{otherUser?.displayName || '加载中...'}</h2>
      </div>

      {/* 关键修复 2: 消息区域 */}
      <div className="flex-grow overflow-y-auto p-4">
        {messages.length === 0 ? (
          // 用户体验优化：显示空状态提示
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>还没有消息，开始对话吧！</p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} otherUser={otherUser} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 关键修复 3: 输入框区域 */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <ChatInput chatId={chatId} />
      </div>
    </div>
  )
}

export default ChatWindow
