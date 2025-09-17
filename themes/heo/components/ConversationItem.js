// themes/heo/components/ConversationItem.js
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getUserProfile } from '@/lib/chat'
import Image from 'next/image'

const ConversationItem = ({ conversation, onClick, isActive }) => {
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState(null)

  useEffect(() => {
    // 从对话参与者中找出另一个人的UID
    const otherUserId = conversation.participants.find(uid => uid !== user.uid)
    if (otherUserId) {
      getUserProfile(otherUserId).then(setOtherUser)
    }
  }, [conversation, user.uid])

  if (!otherUser) {
    return <div>加载中...</div>; // 或者一个骨架屏
  }
  
  const lastMessage = conversation.lastMessage || '...'
  const timestamp = conversation.lastMessageTimestamp?.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || ''
  
  return (
    <div
      onClick={onClick}
      className={`flex items-center p-3 cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-blue-50' : 'hover:bg-gray-100'
      }`}
    >
      <Image
        src={otherUser.photoURL || 'https://via.placeholder.com/150'}
        alt={otherUser.displayName}
        width={48}
        height={48}
        className="rounded-full object-cover"
      />
      <div className="flex-1 ml-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-gray-800 truncate">{otherUser.displayName}</p>
          <p className="text-xs text-gray-500 flex-shrink-0">{timestamp}</p>
        </div>
        <p className="text-sm text-gray-600 truncate">{lastMessage}</p>
      </div>
    </div>
  )
}

export default ConversationItem
