// themes/heo/components/StartChatButton.js (抽屉模式最终版)

import { useAuth } from '@/lib/AuthContext'
import { startChat } from '@/lib/chat'
import { useDrawer } from '@/lib/DrawerContext' // 1. 引入 useDrawer

const StartChatButton = ({ targetUserId }) => {
  const { user } = useAuth()
  const { openDrawer } = useDrawer() // 2. 获取 openDrawer 方法

  const handleStartChat = async () => {
    if (!user) {
      alert('请先登录！')
      return
    }
    
    // 3. 调用新的 startChat，它会返回对话数据
    const conversation = await startChat(user.uid, targetUserId);
    if (conversation) {
      // 4. 用获取到的对话数据，打开聊天抽屉
      openDrawer({ type: 'chat', conversation: conversation });
    } else {
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
