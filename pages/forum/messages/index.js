// pages/forum/messages/index.js (最终健壮版)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo'
import ConversationList from '@/themes/heo/components/ConversationList'
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getConversationsForUser } from '@/lib/chat'
import { doc, getDoc } from 'firebase/firestore' // 1. 引入 getDoc
import { db } from '@/lib/firebase' // 2. 引入 db

const MessagesPage = () => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { chatId } = router.query
  const [activeChatId, setActiveChatId] = useState(null)
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  
  // 监听路由变化
  useEffect(() => {
    setActiveChatId(chatId || null)
  }, [chatId])

  // 监听对话列表
  useEffect(() => {
    if (user) {
      const unsubscribe = getConversationsForUser(user.uid, setConversations);
      return () => unsubscribe();
    }
  }, [user]);

  // 【核心修复】当 activeChatId 或对话列表变化时，更新 activeConversation
  useEffect(() => {
    if (activeChatId) {
      const convInList = conversations.find(c => c.id === activeChatId);
      if (convInList) {
        setActiveConversation(convInList);
      } else {
        // 如果列表里没有，说明是新创建的，单独去获取一次
        const fetchConversation = async () => {
          const convDoc = await getDoc(doc(db, 'chats', activeChatId));
          if (convDoc.exists()) {
            setActiveConversation({ id: convDoc.id, ...convDoc.data() });
          }
        };
        fetchConversation();
      }
    } else {
      setActiveConversation(null);
    }
  }, [activeChatId, conversations]);

  const handleSelectChat = (selectedChatId) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/forum/messages/${selectedChatId}`)
    } else {
      router.push(`/forum/messages?chatId=${selectedChatId}`, undefined, { shallow: true })
    }
  }

  return (
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
