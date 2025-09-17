import { useAuth } from '@/lib/AuthContext'
import { startChat } from '@/lib/chat'
import { useRouter } from 'next/router'

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

  if (!user || user.uid === targetUserId) {
    return null
  }

  return (
    <button
      onClick={handleStartChat}
      className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
    >
      <i className="fas fa-paper-plane"></i>
      <span>私信</span>
    </button>
  )
}
export default StartChatButton
