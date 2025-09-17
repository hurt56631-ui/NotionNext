// themes/heo/components/ChatMessage.js (最终对齐修复版)

import { useAuth } from '@/lib/AuthContext'

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    // 【核心修复】: 在这里重新加入了 isMe 的判断，来决定 justify-start 或 justify-end
    <div className={`flex items-end gap-2 my-2 flex-shrink-0 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <img
          src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
          alt={otherUser?.displayName}
          className="rounded-full w-10 h-10 object-cover"
        />
      )}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
        }`}
      >
        <p>{message.text}</p>
      </div>
       {isMe && (
        <img
          src={user?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
          alt={user?.displayName}
          className="rounded-full w-14 h-14 object-cover"
        />
      )}
    </div>
  )
}

export default ChatMessage
