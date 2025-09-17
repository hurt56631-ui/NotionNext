// themes/heo/components/ChatInput.js
import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { sendMessage } from '@/lib/chat'
import { FaPaperPlane } from 'react-icons/fa'

const ChatInput = ({ chatId }) => {
  const { user } = useAuth()
  const [text, setText] = useState('')

  const handleSend = (e) => {
    e.preventDefault()
    if (!chatId || !user) return
    sendMessage(chatId, text, user.uid)
    setText('')
  }

  return (
    <form onSubmit={handleSend} className="flex items-center space-x-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入消息..."
        className="flex-1 p-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-3 bg-blue-500 text-white rounded-full disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
      >
        <FaPaperPlane />
      </button>
    </form>
  )
}

export default ChatInput
