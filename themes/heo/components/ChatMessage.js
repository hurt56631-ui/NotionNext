// themes/heo/components/ChatMessage.js (路径修正版)

import { useAuth } from '@/lib/AuthContext' // 修正了这里的路径

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    <div className={`flex items-end gap-2 my-2 flex-shrink-0`}>
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
          className="rounded-full w-10 h-10 object-cover"
        />
      )}
    </div>
  )
}

export default ChatMessage
