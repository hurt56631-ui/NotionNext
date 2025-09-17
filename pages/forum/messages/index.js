// pages/forum/messages/index.js (抽屉触发版)

import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo'
import ConversationList from '@/themes/heo/components/ConversationList'
import { useDrawer } from '@/lib/DrawerContext' // 引入 useDrawer

const MessagesPage = () => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { openDrawer } = useDrawer(); // 获取 openDrawer 方法

  const handleSelectChat = (conversation) => {
    // 点击对话时，不再跳转页面，而是打开聊天抽屉
    openDrawer({ type: 'chat', conversation: conversation });
  }

  return (
    <LayoutBase>
      {loading && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录以查看消息。</div>}
      {!loading && user && (
        // 我们不再需要复杂的左右分栏，直接显示列表即可
        <ConversationList onSelectChat={handleSelectChat} />
      )}
    </LayoutBase>
  )
}

export default MessagesPage
