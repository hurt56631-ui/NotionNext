// themes/heo/components/StartChatButton.js
import { useAuth } from '@/lib/AuthContext'
import { startChat } from '@/lib/chat'
import { useRouter } from 'next/router'
import { FaPaperPlane } from 'react-icons/fa'

const StartChatButton = ({ targetUserId }) => {
  const { user } = useAuth()
  const router = useRouter()

  const handleStartChat = () => {
    if (!user) {
      alert('请先登录！')
      return
    }
    startChat(user.uid, targetUserId, router.push)
  }

  // 如果目标是自己，就不显示按钮
  if (user && user.uid === targetUserId) {
    return null
  }

  return (
    <button
      onClick={handleStartChat}
      className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
    >
      <FaPaperPlane />
      <span>私信</span>
    </button>
  )
}

export default StartChatButton
