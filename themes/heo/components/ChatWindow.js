// themes/heo/components/ChatWindow.js
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

  // 滚动到底部的函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // 每次消息更新后，自动滚动到底部
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!chatId || !conversation) {
      setMessages([])
      setOtherUser(null)
      return
    }

    // 获取对方用户信息
    const otherUserId = conversation.participants.find(uid => uid !== user.uid)
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser)
    }

    // 监听消息
    const unsubscribe = getMessagesForChat(chatId, setMessages)
    return () => unsubscribe()
  }, [chatId, conversation, user.uid])

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
        <p>从左侧选择一个对话开始聊天</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部，显示对方名字 */}
      <div className="p-4 border-b bg-white shadow-sm">
        <h2 className="font-bold text-lg">{otherUser?.displayName || '加载中...'}</h2>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} otherUser={otherUser} />
        ))}
        {/* 这个空div是用来定位滚动条的 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框区域 */}
      <div className="p-4 border-t bg-white">
        <ChatInput chatId={chatId} />
      </div>
    </div>
  )
}

export default ChatWindow
