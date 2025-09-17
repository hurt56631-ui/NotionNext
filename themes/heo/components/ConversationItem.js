// themes/heo/components/ConversationItem.js (UI微調版)

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext' // 修正路径
import { getUserProfile } from '@/lib/chat'

const ConversationItem = ({ conversation, onClick, isActive }) => {
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState(null)

  useEffect(() => {
    const otherUserId = conversation.participants.find(uid => uid !== user.uid)
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser)
    }
  }, [conversation, user.uid])

  if (!otherUser) {
    return <div className="h-[76px] bg-gray-50 animate-pulse"></div>;
  }
  
  const lastMessage = conversation.lastMessage || '...'
  const timestamp = conversation.lastMessageTimestamp?.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || ''
  
  return (
    <div
      onClick={onClick}
      className={`flex items-center p-3 cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-blue-50 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {/* 关键修改: 增大头像尺寸 w-12 h-12 (等于 48px) */}
      <img
        src={otherUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
        alt={otherUser.displayName}
        className="rounded-full object-cover w-12 h-12"
      />
      <div className="flex-1 ml-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{otherUser.displayName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{timestamp}</p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{lastMessage}</p>
      </div>
    </div>
  )
}

export default ConversationItem
