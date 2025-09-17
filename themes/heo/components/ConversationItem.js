// themes/heo/components/ConversationItem.js (抽屉模式最终版)

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getUserProfile } from '@/lib/chat'

const ConversationItem = ({ conversation, onClick }) => { // 移除了 isActive prop
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState(null)

  useEffect(() => {
    // 核心修改：确保 user 对象存在，并且 conversation 数据也存在
    if (user && conversation?.participants) {
      const otherUserId = conversation.participants.find(uid => uid !== user.uid)
      if (otherUserId) {
        getUserProfile(otherUserId).then(setOtherUser)
      }
    }
  }, [conversation, user]) // 依赖项加入 user，确保登录后才执行

  if (!otherUser) {
    return <div className="h-[76px] bg-gray-50 dark:bg-gray-800 animate-pulse"></div>;
  }
  
  const lastMessage = conversation.lastMessage || '...'
  const timestamp = conversation.lastMessageTimestamp?.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || ''
  
  return (
    // onClick 现在由父组件决定行为
    <div
      onClick={onClick}
      className="flex items-center p-3 cursor-pointer transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <img
        src={otherUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
        alt={otherUser.displayName}
        className="rounded-full object-cover w-16 h-16"
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
