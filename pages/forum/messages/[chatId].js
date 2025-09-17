// pages/forum/messages/[chatId].js (加固版)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
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
    <LayoutBase>
      {(loading || !conversation) && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录。</div>}
      {!loading && user && conversation && (
        // 关键修复：确保这个容器能正确地撑开高度
        <div className="md:hidden" style={{ height: 'calc(100vh - 4rem)' }}> {/* 假设Header高度是4rem */}
           <ChatWindow chatId={chatId} conversation={conversation} />
        </div>
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage
