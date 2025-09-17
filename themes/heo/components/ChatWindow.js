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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white">{otherUser?.displayName || '加载中...'}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} otherUser={otherUser} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <ChatInput chatId={chatId} />
      </div>
    </div>
  )
}

export default ChatWindow
