// pages/forum/messages/[chatId].js (最终全屏UI版)

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
    // 使用一个特殊的 prop (fullScreen) 来通知 LayoutBase
    <LayoutBase fullScreen={true}>
      {(loading || !conversation) && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录。</div>}
      {!loading && user && conversation && (
        // ChatWindow 会填充 LayoutBase 提供的全屏空间
        <ChatWindow chatId={chatId} conversation={conversation} />
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage
