import { useAuth } from '@/lib/AuthContext'

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    <div className={`flex items-end gap-2 my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <img
          src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
          alt={otherUser?.displayName}
          width={32}
          height={32}
          className="rounded-full w-8 h-8"
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
          width={32}
          height={32}
          className="rounded-full w-8 h-8"
        />
      )}
    </div>
  )
}

export default ChatMessage
