// pages/forum/messages/index.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import LayoutBase from '@/themes/heo/LayoutBase'
import ConversationList from '@/themes/heo/components/ConversationList'
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getConversationsForUser } from '@/lib/chat'

const MessagesPage = () => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { chatId } = router.query

  const [activeChatId, setActiveChatId] = useState(chatId || null)
  const [conversations, setConversations] = useState([]);
  
  // 监听路由变化，更新activeChatId
  useEffect(() => {
    setActiveChatId(chatId || null)
  }, [chatId])

  // 获取对话列表，以便传递给 ChatWindow
  useEffect(() => {
    if (user) {
      const unsubscribe = getConversationsForUser(user.uid, setConversations);
      return () => unsubscribe();
    }
  }, [user]);

  const handleSelectChat = (selectedChatId) => {
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      router.push(`/forum/messages/${selectedChatId}`)
    } else {
      // 使用 shallow routing，只更新URL参数，不重新加载页面
      router.push(`/forum/messages?chatId=${selectedChatId}`, undefined, { shallow: true })
    }
  }

  if (loading) return <LayoutBase><div>加载中...</div></LayoutBase>
  if (!user && !loading) return <LayoutBase><div>请先登录以查看消息。</div></LayoutBase>

  const activeConversation = conversations.find(c => c.id === activeChatId);

  return (
    <LayoutBase>
      <div className="flex h-[calc(100vh-4rem)]"> {/* 假设Header高度为4rem */}
        {/* 左侧对话列表 (手机上，如果选了聊天，则隐藏) */}
        <div className={`w-full md:w-1/3 md:flex-shrink-0 ${activeChatId ? 'hidden md:block' : 'block'}`}>
          <ConversationList onSelectChat={handleSelectChat} activeChatId={activeChatId} />
        </div>

        {/* 右侧聊天窗口 (仅在电脑端显示) */}
        <div className="hidden md:flex flex-1">
          <ChatWindow chatId={activeChatId} conversation={activeConversation} />
        </div>
      </div>
    </LayoutBase>
  )
}

export default MessagesPage
