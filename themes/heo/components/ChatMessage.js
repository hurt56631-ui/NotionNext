// themes/heo/components/ChatMessage.js (UI微调版)

import { useAuth } from '@/lib/Auth-context' // 修正路径

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    // 添加 flex-shrink-0 确保消息不会被压缩
    <div className={`flex items-end gap-2 my-2 flex-shrink-0`}>
      {!isMe && (
        // 关键修改: 增大头像尺寸 w-10 h-10 (等于 40px)
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
        // 关键修改: 增大头像尺寸 w-10 h-10
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
