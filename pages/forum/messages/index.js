// pages/forum/messages/index.js (抽屉触发版 - 彻底清理)

import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo'
import ConversationList from '@/themes/heo/components/ConversationList'
// 【核心修改】: 彻底移除对 useDrawer 的引用
// import { useDrawer } from '@/lib/DrawerContext' 

const MessagesPage = () => {
  const { user, loading } = useAuth()
  // 【核心修改】: 不再获取 useDrawer

  // 这个页面的唯一职责就是显示对话列表
  // 点击对话后的行为，完全由 ConversationList 和 BottomNavBar 内部处理
  return (
    <LayoutBase>
      {loading && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录以查看消息。</div>}
      {!loading && user && (
        <ConversationList />
      )}
    </LayoutBase>
  )
}

export default MessagesPage
