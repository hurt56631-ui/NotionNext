// pages/forum/messages/[chatId].js (最终简化版)

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
    if (chatId && user) {
      const getConversationData = async () => {
        const docRef = doc(db, 'chats', chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().participants.includes(user.uid)) {
          setConversation({ id: docSnap.id, ...docSnap.data() });
        } else {
          router.replace('/forum/messages');
        }
      };
      getConversationData();
    }
  }, [chatId, user, router]);

  return (
    // 不需要传递任何特殊 prop，LayoutBase 会自动处理
    <LayoutBase>
      {(loading || !conversation) && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录。</div>}
      {!loading && user && conversation && (
        <ChatWindow chatId={chatId} conversation={conversation} />
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage
