// pages/forum/messages/[chatId].js (最终修正版)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
// 修正 1: 使用正确的命名导入
import { LayoutBase } from '@/themes/heo' 
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ChatDetailPage = () => {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { chatId } = router.query
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    if (chatId) {
      const getConversationData = async () => {
        const docRef = doc(db, 'chats', chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConversation({ id: docSnap.id, ...docSnap.data() });
        } else {
          router.replace('/forum/messages');
        }
      };
      getConversationData();
    }
  }, [chatId, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace(`/forum/messages?chatId=${chatId}`)
    }
  }, [chatId, router])

  return (
    // 修正 2: 将 <Layout> 改回 <LayoutBase>
    <LayoutBase>
      {(loading || !conversation) && <div>加载中...</div>}
      {!loading && !user && <div>请先登录。</div>}
      {!loading && user && conversation && (
        <div className="md:hidden flex flex-col h-screen fixed inset-0 bg-white dark:bg-gray-900 z-50">
          <div className="flex-shrink-0 flex items-center p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm sticky top-0">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <i className="fas fa-arrow-left"></i>
            </button>
          </div>
          <div className="flex-1">
             <ChatWindow chatId={chatId} conversation={conversation} />
          </div>
        </div>
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage
