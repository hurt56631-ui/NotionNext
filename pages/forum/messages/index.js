// pages/forum/messages/index.js (最终修正版)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
// 修正 1: 使用正确的命名导入
import { LayoutBase } from '@/themes/heo' 
import ConversationList from '@/themes/heo/components/ConversationList'
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getConversationsForUser } from '@/lib/chat'

const MessagesPage = () => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { chatId } = router.query
  const [activeChatId, setActiveChatId] = useState(chatId || null)
  const [conversations, setConversations] = useState([]);
  
  useEffect(() => {
    setActiveChatId(chatId || null)
  }, [chatId])

  useEffect(() => {
    if (user) {
      const unsubscribe = getConversationsForUser(user.uid, setConversations);
      return () => unsubscribe();
    }
  }, [user]);

  const handleSelectChat = (selectedChatId) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/forum/messages/${selectedChatId}`)
    } else {
      router.push(`/forum/messages?chatId=${selectedChatId}`, undefined, { shallow: true })
    }
  }

  const activeConversation = conversations.find(c => c.id === activeChatId);

  return (
    // 修正 2: 将 <Layout> 改回 <LayoutBase>
    <LayoutBase>
      {loading && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录以查看消息。</div>}
      {!loading && user && (
        <div className="flex h-full min-h-[calc(100vh-10rem)]">
          <div className={`w-full md:w-1/3 md:flex-shrink-0 ${activeChatId && 'hidden md:block'}`}>
            <ConversationList onSelectChat={handleSelectChat} activeChatId={activeChatId} />
          </div>
          <div className="hidden md:flex flex-1">
            <ChatWindow chatId={activeChatId} conversation={activeConversation} />
          </div>
        </div>
      )}
    </LayoutBase>
  )
}

export default MessagesPage
