// themes/heo/components/StartChatButton.js (抽屉模式最终版 - 最终清理)

import { useAuth } from '@/lib/AuthContext'
import { startChat } from '@/lib/chat'
// 不再需要 useDrawer

const StartChatButton = ({ targetUserId, onClick }) => { // 接收一个 onClick
  const { user } = useAuth()

  const handleStartChat = async () => {
    if (!user) {
      alert('请先登录！')
      return
    }
    const conversation = await startChat(user.uid, targetUserId);
    if (conversation && onClick) {
      // 调用从外部传入的 onClick 函数，并把对话数据传出去
      onClick(conversation); 
    } else if (!conversation) {
      alert('无法开启对话，请稍后再试。');
    }
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
