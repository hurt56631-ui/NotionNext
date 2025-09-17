// themes/heo/components/ChatMessage.js
import { useAuth } from '@/lib/AuthContext'
import Image from 'next/image'

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    <div className={`flex items-end gap-2 my-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <Image
          src={otherUser?.photoURL || 'https://via.placeholder.com/150'}
          alt={otherUser?.displayName}
          width={32}
          height={32}
          className="rounded-full"
        />
      )}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
          isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <p className="break-words">{message.text}</p>
      </div>
       {isMe && (
        <Image
          src={user?.photoURL || 'https://via.placeholder.com/150'}
          alt={user?.displayName}
          width={32}
          height={32}
          className="rounded-full"
        />
      )}
    </div>
  )
}

export default ChatMessage
